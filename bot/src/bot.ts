import { getConfig } from "./config";
import { getAllUsernames } from "./users";
import { getStreamStatus, getUserInfo, type StreamInfo } from "./twitch";
import { sendNotification, updateNotification, sendOfflineNotification, updateToOfflineNotification } from "./discord";
import { logEvent } from "./logger";

export interface BotStatus {
  running: boolean;
  lastCheck: string | null;
  lastError: string | null;
  isLive: boolean;
  currentStream: StreamInfo | null;
  notificationsSent: number;
  startTime: number;
}

interface StreamState {
  wasLive: boolean;
  cachedAvatarUrl?: string;
  lastMessageId: string | null;
  lastUpdateTime: number;
}

let interval: Timer | null = null;
const streamStates = new Map<string, StreamState>(); // twitchUsername -> state

export const status: BotStatus = {
  running: false,
  lastCheck: null,
  lastError: null,
  isLive: false,
  currentStream: null,
  notificationsSent: 0,
  startTime: 0,
};

function getOrCreateState(username: string): StreamState {
  if (!streamStates.has(username)) {
    streamStates.set(username, {
      wasLive: false,
      cachedAvatarUrl: undefined,
      lastMessageId: null,
      lastUpdateTime: 0,
    });
  }
  return streamStates.get(username)!;
}

async function tickUser(platform: string, username: string): Promise<void> {
  // Currently only Twitch is supported, but the structure is ready for more platforms
  if (platform !== "twitch") {
    console.log(`[bot] Skipping ${platform} user ${username} (not yet supported)`);
    return;
  }

  const config = getConfig();

  try {
    const stream = await getStreamStatus(username);
    const state = getOrCreateState(username);

    status.lastCheck = new Date().toISOString();
    status.isLive = stream.isLive;
    status.currentStream = stream;
    status.lastError = null;

    if (stream.isLive && !state.wasLive) {
      // ── Went live → fetch avatar once, send new notification ──────────────
      logEvent("🔴 LIVE", `${username} is now live on ${platform}: ${stream.title || "No title"} (${stream.gameName || "Unknown"})`);
      console.log(`[bot] ${username} went live on ${platform}! Sending notification...`);

      if (!state.cachedAvatarUrl) {
        try {
          const user = await getUserInfo(username);
          state.cachedAvatarUrl = user?.profile_image_url;
        } catch {}
      }

      const msgId = await sendNotification(stream, username, state.cachedAvatarUrl);
      if (msgId) {
        state.lastMessageId = msgId;
        status.notificationsSent++;
        logEvent("✓ Notification", `Sent/updated for ${username} (message ${msgId})`);
        console.log(`[bot] Notification sent ✓ for ${username} (message ${msgId})`);
      } else {
        state.lastMessageId = null;
        console.warn(`[bot] Failed to send notification for ${username}`);
      }
    } else if (stream.isLive && state.wasLive && state.lastMessageId) {
      // ── Already live → edit existing embed with fresh data ─────────────────
      const now = Date.now();
      const updateIntervalMs = config.updateIntervalMinutes * 60 * 1000;

      if (now - state.lastUpdateTime >= updateIntervalMs) {
        await updateNotification(state.lastMessageId, stream, username, state.cachedAvatarUrl);
        state.lastUpdateTime = now;
        console.log(`[bot] Notification updated for ${username} (${Math.round(config.updateIntervalMinutes)}min interval)`);
      }
    } else if (!stream.isLive && state.wasLive) {
      // ── Went offline → update existing notification or send new offline message ──
      logEvent("⚫ OFFLINE", `${username} ended their stream on ${platform}`);
      console.log(`[bot] ${username} went offline on ${platform}`);

      if (state.lastMessageId) {
        // Update existing live message to show offline status
        const success = await updateToOfflineNotification(
          state.lastMessageId,
          username,
          state.cachedAvatarUrl
        );
        if (success) {
          logEvent("✓ Offline Update", `Updated notification for ${username} (message ${state.lastMessageId})`);
          console.log(`[bot] Offline notification updated ✓ for ${username} (message ${state.lastMessageId})`);
        } else {
          console.warn(`[bot] Failed to update offline notification for ${username}`);
        }
      } else {
        // No existing message, send a new offline notification
        const msgId = await sendOfflineNotification(username, state.cachedAvatarUrl);
        if (msgId) {
          state.lastMessageId = msgId;
          logEvent("✓ Offline Notification", `Sent for ${username} (message ${msgId})`);
          console.log(`[bot] Offline notification sent ✓ for ${username} (message ${msgId})`);
        } else {
          console.warn(`[bot] Failed to send offline notification for ${username}`);
        }
      }

      state.lastUpdateTime = 0;
    }

    state.wasLive = stream.isLive;
  } catch (err: any) {
    status.lastError = err.message;
    console.error(`[bot] tickUser error for ${username}:`, err.message);
  }
}

async function tick() {
  const usernames = getAllUsernames();
  if (usernames.length === 0) {
    status.lastError = "No users configured. Use /setup add <platform> <username> in Discord.";
    return;
  }

  // Poll all configured users in parallel
  await Promise.all(usernames.map(({ platform, username }) => tickUser(platform, username)));
}

export function startBot() {
  if (interval) return;
  const config = getConfig();
  status.running = true;
  status.startTime = Date.now();
  logEvent("▶ START", `Bot started with ${config.pollIntervalSeconds}s polling interval`);
  console.log(`[bot] Starting, polling every ${config.pollIntervalSeconds}s`);
  tick();
  interval = setInterval(tick, config.pollIntervalSeconds * 1000);
}

export function stopBot() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
  status.running = false;
  logEvent("⏹ STOP", "Bot stopped");
  console.log("[bot] Stopped");
}

/**
 * Restart the bot — preserves all stream states so no duplicate notifications.
 */
export function restartBot() {
  stopBot();
  startBot();
}

/**
 * Full cold restart — resets all stream states.
 */
export function coldRestartBot() {
  stopBot();
  for (const [, state] of streamStates) {
    state.wasLive = false;
    state.lastMessageId = null;
    state.lastUpdateTime = 0;
    state.cachedAvatarUrl = undefined;
  }
  startBot();
}

import { getConfig } from "./config";
import { getAllTwitchUsernames } from "./users";
import { getStreamStatus, getUserInfo, type StreamInfo } from "./twitch";
import { sendNotification, updateNotification } from "./discord";

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

async function tickUser(twitchUsername: string): Promise<void> {
  const config = getConfig();

  try {
    const stream = await getStreamStatus(twitchUsername);
    const state = getOrCreateState(twitchUsername);

    status.lastCheck = new Date().toISOString();
    status.isLive = stream.isLive;
    status.currentStream = stream;
    status.lastError = null;

    if (stream.isLive && !state.wasLive) {
      // ── Went live → fetch avatar once, send new notification ──────────────
      console.log(`[bot] ${twitchUsername} went live! Sending notification...`);

      if (!state.cachedAvatarUrl) {
        try {
          const user = await getUserInfo(twitchUsername);
          state.cachedAvatarUrl = user?.profile_image_url;
        } catch {}
      }

      const msgId = await sendNotification(stream, twitchUsername, state.cachedAvatarUrl);
      if (msgId) {
        state.lastMessageId = msgId;
        status.notificationsSent++;
        console.log(`[bot] Notification sent ✓ for ${twitchUsername} (message ${msgId})`);
      } else {
        state.lastMessageId = null;
        console.warn(`[bot] Failed to send notification for ${twitchUsername}`);
      }
    } else if (stream.isLive && state.wasLive && state.lastMessageId) {
      // ── Already live → edit existing embed with fresh data ─────────────────
      const now = Date.now();
      const updateIntervalMs = config.updateIntervalMinutes * 60 * 1000;

      if (now - state.lastUpdateTime >= updateIntervalMs) {
        await updateNotification(state.lastMessageId, stream, twitchUsername, state.cachedAvatarUrl);
        state.lastUpdateTime = now;
        console.log(`[bot] Notification updated for ${twitchUsername} (${Math.round(config.updateIntervalMinutes)}min interval)`);
      }
    } else if (!stream.isLive && state.wasLive) {
      // ── Went offline → clear stored message ID ─────────────────────────────
      console.log(`[bot] ${twitchUsername} went offline`);
      state.lastMessageId = null;
      state.lastUpdateTime = 0;
    }

    state.wasLive = stream.isLive;
  } catch (err: any) {
    status.lastError = err.message;
    console.error(`[bot] tickUser error for ${twitchUsername}:`, err.message);
  }
}

async function tick() {
  const usernames = getAllTwitchUsernames();
  if (usernames.length === 0) {
    status.lastError = "No Twitch users configured. Use /setup twitch <username> in Discord.";
    return;
  }

  // Poll all configured users in parallel
  await Promise.all(usernames.map((username) => tickUser(username)));
}

export function startBot() {
  if (interval) return;
  const config = getConfig();
  status.running = true;
  status.startTime = Date.now();
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

import { getConfig } from "./config";
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

let interval: Timer | null = null;
let wasLive = false;
let cachedAvatarUrl: string | undefined;
let lastMessageId: string | null = null;
let lastUpdateTime = 0;

export const status: BotStatus = {
  running: false,
  lastCheck: null,
  lastError: null,
  isLive: false,
  currentStream: null,
  notificationsSent: 0,
  startTime: 0,
};

async function tick() {
  const config = getConfig();
  if (!config.twitchUsername || !config.twitchClientId) {
    status.lastError = "Twitch not configured";
    return;
  }

  try {
    const stream = await getStreamStatus(config.twitchUsername);
    status.lastCheck = new Date().toISOString();
    status.isLive = stream.isLive;
    status.currentStream = stream;
    status.lastError = null;

    if (stream.isLive && !wasLive) {
      // ── Went live → fetch avatar once, send new notification ──────────────
      console.log(`[bot] ${config.twitchUsername} went live! Sending notification...`);

      if (!cachedAvatarUrl) {
        try {
          const user = await getUserInfo(config.twitchUsername);
          cachedAvatarUrl = user?.profile_image_url;
        } catch {}
      }

      const msgId = await sendNotification(stream, config.twitchUsername, cachedAvatarUrl);
      if (msgId) {
        lastMessageId = msgId;
        status.notificationsSent++;
        console.log(`[bot] Notification sent ✓ (message ${msgId})`);
      } else {
        lastMessageId = null;
        console.warn(`[bot] Failed to send notification`);
      }
    } else if (stream.isLive && wasLive && lastMessageId) {
      // ── Already live → edit existing embed with fresh data ─────────────────
      const now = Date.now();
      const updateIntervalMs = config.updateIntervalMinutes * 60 * 1000;
      
      if (now - lastUpdateTime >= updateIntervalMs) {
        await updateNotification(lastMessageId, stream, config.twitchUsername, cachedAvatarUrl);
        lastUpdateTime = now;
        console.log(`[bot] Notification updated (${Math.round(config.updateIntervalMinutes)}min interval)`);
      }
    } else if (!stream.isLive && wasLive) {
      // ── Went offline → clear stored message ID ─────────────────────────────
      console.log(`[bot] ${config.twitchUsername} went offline`);
      lastMessageId = null;
      lastUpdateTime = 0;
    }

    wasLive = stream.isLive;
  } catch (err: any) {
    status.lastError = err.message;
    console.error("[bot] tick error:", err.message);
  }
}

export function startBot() {
  if (interval) return;
  const config = getConfig();
  status.running = true;
  status.startTime = Date.now();
  // Don't reset wasLive here — it's preserved from restartBot() when needed.
  // Only reset cachedAvatarUrl so it's refreshed after a restart.
  cachedAvatarUrl = undefined;
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
 * Restart the bot.
 * Preserves wasLive so a config-save while the stream is live doesn't
 * trigger a duplicate notification on the very next tick.
 */
export function restartBot() {
  const currentlyLive = wasLive;
  stopBot();
  wasLive = currentlyLive; // keep state across config-save restarts
  startBot();
}

/**
 * Full cold restart — resets all state including wasLive.
 * Use this when you actually want the bot to re-detect the stream from scratch.
 */
export function coldRestartBot() {
  stopBot();
  wasLive = false;
  lastMessageId = null;
  lastUpdateTime = 0;
  cachedAvatarUrl = undefined;
  startBot();
}

import { getConfig } from "./config";
import { getStreamStatus, type StreamInfo } from "./twitch";
import { sendNotification } from "./discord";

export interface BotStatus {
  running: boolean;
  lastCheck: string | null;
  lastError: string | null;
  isLive: boolean;
  currentStream: StreamInfo | null;
  notificationsSent: number;
  uptime: number;
}

let interval: Timer | null = null;
let wasLive = false;
let startTime = Date.now();

export const status: BotStatus = {
  running: false,
  lastCheck: null,
  lastError: null,
  isLive: false,
  currentStream: null,
  notificationsSent: 0,
  uptime: 0,
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
    status.uptime = Math.floor((Date.now() - startTime) / 1000);

    // Went live → send notification
    if (stream.isLive && !wasLive) {
      console.log(`[bot] ${config.twitchUsername} went live! Sending notification...`);
      const sent = await sendNotification(stream, config.twitchUsername);
      if (sent) {
        status.notificationsSent++;
        console.log(`[bot] Notification sent ✓`);
      } else {
        console.warn(`[bot] Failed to send notification`);
      }
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
  startTime = Date.now();
  wasLive = false;
  console.log(`[bot] Starting, polling every ${config.pollIntervalSeconds}s`);
  tick(); // immediate first check
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

export function restartBot() {
  stopBot();
  startBot();
}

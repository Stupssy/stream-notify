import "./logger"; // Must be first - wraps console methods to capture all output
import { initDb } from "./db";
import { initConfig, getConfig } from "./config";
import { initUsers, getAllUsernames } from "./users";
import { startBot } from "./bot";
import { startGateway } from "./gateway";
import { createServer } from "./server";

console.log("╔════════════════════════════╗");
console.log("║     stream-notify bot      ║");
console.log("╚════════════════════════════╝");

async function main() {
  // 1. Initialize database
  await initDb();

  // 2. Load config from DB
  const config = await initConfig();
  console.log(`[init] Config loaded. API Key: ${config.apiKey}`);

  // 3. Load users from DB
  await initUsers();

  // 4. Start HTTP API server
  const PORT = parseInt(process.env.PORT ?? "3001");
  const app = createServer();
  app.listen(PORT, () => {
    console.log(`[server] API running on port ${PORT}`);
  });

  // ── Keepalive ──────────────────────────────────────────────────────────────────
  // Render free tier spins down web services after ~15 min of no incoming traffic.
  // RENDER_EXTERNAL_URL is set automatically by Render for web services.
  // We self-ping every 14 minutes to stay alive.
  const KEEPALIVE_URL =
    process.env.RENDER_EXTERNAL_URL ??
    process.env.PUBLIC_URL ??
    null;

  if (KEEPALIVE_URL) {
    const pingUrl = `${KEEPALIVE_URL}/health`;
    console.log(`[keepalive] Self-ping active → ${pingUrl} (every 14 min)`);
    setInterval(async () => {
      try {
        await fetch(pingUrl);
        console.log(`[keepalive] Ping ok`);
      } catch (err: any) {
        console.warn(`[keepalive] Ping failed: ${err.message}`);
      }
    }, 14 * 60 * 1000);
  } else {
    console.log("[keepalive] No RENDER_EXTERNAL_URL/PUBLIC_URL set — self-ping disabled");
    console.log("[keepalive] Tip: set PUBLIC_URL=https://your-bot.onrender.com to prevent spin-down");
  }

  // ── Discord Gateway ────────────────────────────────────────────────────────────
  if (config.discordBotToken) {
    startGateway();
  } else {
    console.log("[init] No Discord token yet — configure via WebUI");
  }

  // ── Auto-start polling bot ─────────────────────────────────────────────────────
  const { enabled } = config;
  const users = getAllUsernames();
  if (enabled && users.length > 0) {
    const userList = users.map(u => `${u.platform}:${u.username}`).join(", ");
    console.log(`[init] Auto-starting bot for ${users.length} user(s): ${userList}`);
    startBot();
  } else {
    console.log("[init] Bot not started — configure via WebUI or /setup add in Discord");
  }
}

main().catch((err) => {
  console.error("[init] Fatal error:", err.message);
  process.exit(1);
});

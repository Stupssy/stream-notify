import { loadConfig, getConfig } from "./config";
import { startBot } from "./bot";
import { createServer } from "./server";

console.log("╔════════════════════════════╗");
console.log("║     stream-notify bot      ║");
console.log("╚════════════════════════════╝");

// Load config from disk
const config = loadConfig();
console.log(`[init] Config loaded. API Key: ${config.apiKey}`);

// Start HTTP API server
const PORT = parseInt(process.env.PORT ?? "3001");
const app = createServer();
app.listen(PORT, () => {
  console.log(`[server] API running on port ${PORT}`);
});

// Auto-start bot if enabled and configured
if (config.enabled && config.twitchUsername && config.twitchClientId) {
  console.log(`[init] Auto-starting bot for @${config.twitchUsername}`);
  startBot();
} else {
  console.log("[init] Bot not started (not configured or disabled). Use WebUI to configure.");
}

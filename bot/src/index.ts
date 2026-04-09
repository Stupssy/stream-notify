import { loadConfig, getConfig } from "./config";
import { startBot } from "./bot";
import { startGateway } from "./gateway";
import { createServer } from "./server";

console.log("╔════════════════════════════╗");
console.log("║     stream-notify bot      ║");
console.log("╚════════════════════════════╝");

const config = loadConfig();
console.log(`[init] Config loaded. API Key: ${config.apiKey}`);

// Start HTTP API server
const PORT = parseInt(process.env.PORT ?? "3001");
const app = createServer();
app.listen(PORT, () => {
  console.log(`[server] API running on port ${PORT}`);
});

// Start Discord Gateway (bot appears online in server)
if (config.discordBotToken) {
  startGateway();
} else {
  console.log("[init] No Discord token yet — configure via WebUI");
}

// Auto-start polling bot if configured
if (config.enabled && config.twitchUsername && config.twitchClientId) {
  console.log(`[init] Auto-starting bot for @${config.twitchUsername}`);
  startBot();
} else {
  console.log("[init] Bot not started — configure via WebUI");
}

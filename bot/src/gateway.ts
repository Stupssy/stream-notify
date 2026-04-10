import { Client, GatewayIntentBits, ActivityType, Events } from "discord.js";
import { getConfig } from "./config";
import { registerCommands, handleInteraction } from "./commands";

let client: Client | null = null;

export async function startGateway(): Promise<void> {
  const { discordBotToken } = getConfig();
  if (!discordBotToken) {
    console.log("[gateway] No token, skipping Gateway connection");
    return;
  }

  if (client) {
    client.destroy();
    client = null;
  }

  client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  client.once("clientReady", async (c) => {
    console.log(`[gateway] Logged in as ${c.user.tag} ✓`);
    c.user.setPresence({
      status: "online",
      activities: [{ name: "Twitch 👁", type: ActivityType.Watching }],
    });

    // Register slash commands once on startup
    await registerCommands();
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    await handleInteraction(interaction);
  });

  client.on("error", (err) => {
    console.error("[gateway] Error:", err.message);
  });

  try {
    await client.login(discordBotToken);
  } catch (err: any) {
    console.error("[gateway] Login failed:", err.message);
    client = null;
  }
}

export function stopGateway(): void {
  if (client) {
    client.destroy();
    client = null;
    console.log("[gateway] Disconnected");
  }
}

export function restartGateway(): void {
  stopGateway();
  startGateway();
}

import { join } from "path";

const CONFIG_PATH = join(import.meta.dir, "../config.json");

export interface Config {
  // Discord
  discordBotToken: string;
  discordGuildId: string;
  discordChannelId: string;
  discordStreamerRoleId: string;
  discordNotifyRoleId: string;
  // Twitch
  twitchClientId: string;
  twitchClientSecret: string;
  twitchUsername: string;
  // Notification
  notifyMessage: string;
  embedColor: string;
  embedTitle: string;
  // Bot settings
  pollIntervalSeconds: number;
  enabled: boolean;
  // Internal — never exposed to frontend
  apiKey: string;
}

const defaults: Config = {
  discordBotToken: "",
  discordGuildId: "",
  discordChannelId: "",
  discordStreamerRoleId: "",
  discordNotifyRoleId: "",
  twitchClientId: "",
  twitchClientSecret: "",
  twitchUsername: "",
  notifyMessage: "🔴 **{username}** ist jetzt live auf Twitch!",
  embedColor: "#9146FF",
  embedTitle: "{username} streamt jetzt!",
  pollIntervalSeconds: 60,
  enabled: false,
  apiKey: process.env.API_KEY ?? crypto.randomUUID(),
};

// Secrets that can also be provided via environment variables.
// Env vars take priority over config.json — they survive Render deploys.
const ENV_OVERRIDES: Partial<Record<keyof Config, string>> = {
  discordBotToken:    "DISCORD_BOT_TOKEN",
  twitchClientId:     "TWITCH_CLIENT_ID",
  twitchClientSecret: "TWITCH_CLIENT_SECRET",
  twitchUsername:     "TWITCH_USERNAME",
  discordGuildId:     "DISCORD_GUILD_ID",
  discordChannelId:   "DISCORD_CHANNEL_ID",
  discordNotifyRoleId:"DISCORD_NOTIFY_ROLE_ID",
  discordStreamerRoleId:"DISCORD_STREAMER_ROLE_ID",
  apiKey:             "API_KEY",
};

let _config: Config = { ...defaults };

function applyEnvOverrides(cfg: Config): Config {
  for (const [key, envVar] of Object.entries(ENV_OVERRIDES)) {
    const val = process.env[envVar as string];
    if (val) (cfg as any)[key] = val;
  }
  return cfg;
}

export function loadConfig(): Config {
  // Start from defaults
  _config = { ...defaults };

  // Layer 1: config.json (if it exists and is readable)
  try {
    const file = Bun.file(CONFIG_PATH);
    if (file.size > 0) {
      const raw = JSON.parse(Bun.readFileSync(CONFIG_PATH).toString());
      _config = { ..._config, ...raw };
    }
  } catch {
    // No config.json yet — that's fine, we write it below
    saveConfig(_config);
  }

  // Layer 2: env vars always win (survive redeploys)
  applyEnvOverrides(_config);

  return _config;
}

export function getConfig(): Config {
  return _config;
}

/**
 * Save config to disk.
 * - Never overwrites fields that have an env var set (those are always authoritative).
 * - Never stores the apiKey from a client call (it's always sourced from env/defaults).
 */
export function saveConfig(incoming: Partial<Config>): Config {
  // Merge into current config
  _config = { ..._config, ...incoming };

  // Env vars always win — re-apply after merge
  applyEnvOverrides(_config);

  // Persist to disk (without apiKey — that lives in env)
  const toDisk = { ..._config } as any;
  delete toDisk.apiKey;
  try {
    Bun.write(CONFIG_PATH, JSON.stringify(toDisk, null, 2));
  } catch (e: any) {
    console.warn(`[config] Could not write config.json: ${e.message}`);
  }

  return _config;
}
import { getPool } from "./db";

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
  // Notification
  notifyMessage: string;
  embedColor: string;
  embedTitle: string;
  offlineMessage: string;
  offlineEmbedTitle: string;
  // Bot settings
  pollIntervalSeconds: number;
  updateIntervalMinutes: number;
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
  notifyMessage: "🔴 **{username}** ist jetzt live auf Twitch!",
  embedTitle: "{username} streamt jetzt!",
  offlineMessage: "⚫ **{username}** ist jetzt offline.",
  offlineEmbedTitle: "{username} ist nicht mehr live.",
  embedColor: "#9146FF",
  pollIntervalSeconds: 60,
  updateIntervalMinutes: 5,
  enabled: false,
  apiKey: process.env.API_KEY ?? crypto.randomUUID(),
};

// Secrets that can also be provided via environment variables.
// Env vars take priority over DB — they survive Render deploys.
const ENV_OVERRIDES: Partial<Record<keyof Config, string>> = {
  discordBotToken:    "DISCORD_BOT_TOKEN",
  twitchClientId:     "TWITCH_CLIENT_ID",
  twitchClientSecret: "TWITCH_CLIENT_SECRET",
  discordGuildId:     "DISCORD_GUILD_ID",
  discordChannelId:   "DISCORD_CHANNEL_ID",
  discordNotifyRoleId:"DISCORD_NOTIFY_ROLE_ID",
  discordStreamerRoleId:"DISCORD_STREAMER_ROLE_ID",
  apiKey:             "API_KEY",
};

// All non-string keys that need type coercion
const NUMBER_KEYS: (keyof Config)[] = ["pollIntervalSeconds", "updateIntervalMinutes"];
const BOOL_KEYS: (keyof Config)[] = ["enabled"];

let _config: Config = { ...defaults };
let _initialized = false;

function applyEnvOverrides(cfg: Config): Config {
  for (const [key, envVar] of Object.entries(ENV_OVERRIDES)) {
    const val = process.env[envVar as string];
    if (val) (cfg as any)[key] = val;
  }
  return cfg;
}

/**
 * Load config from the database and merge into memory.
 * Must be called once at startup (before any getConfig() calls).
 */
export async function initConfig(): Promise<Config> {
  const pool = getPool();

  // Start from defaults
  _config = { ...defaults };

  // Load from DB
  try {
    const { rows } = await pool.query("SELECT key, value FROM app_config");
    for (const row of rows) {
      const key = row.key as keyof Config;
      let value: any = row.value;

      // Coerce types
      if (NUMBER_KEYS.includes(key)) {
        value = Number(value);
        if (isNaN(value)) continue;
      } else if (BOOL_KEYS.includes(key)) {
        value = value === "true";
      }

      (_config as any)[key] = value;
    }
    console.log("[config] Loaded from database ✓");
  } catch (e: any) {
    console.error("[config] Failed to load config from DB:", e.message);
  }

  // Env vars always win
  applyEnvOverrides(_config);
  _initialized = true;

  return _config;
}

export function getConfig(): Config {
  if (!_initialized) {
    // Fallback: return defaults if called before initConfig()
    return { ...defaults };
  }
  return _config;
}

/**
 * Save config to the database (UPSERT per key).
 * - Never overwrites fields that have an env var set (those are always authoritative).
 * - Never stores the apiKey (it's always sourced from env/defaults).
 */
export async function saveConfig(incoming: Partial<Config>): Promise<Config> {
  const pool = getPool();

  // Merge into current config
  _config = { ..._config, ...incoming };

  // Env vars always win — re-apply after merge
  applyEnvOverrides(_config);

  // Persist to DB (without apiKey)
  const toSave = { ..._config } as any;
  delete toSave.apiKey;

  try {
    const values: string[] = [];
    const queries: Promise<any>[] = [];

    for (const [key, value] of Object.entries(toSave)) {
      values.push(value != null ? String(value) : "");
    }

    // Build UPSERT queries
    const keys = Object.keys(toSave) as (keyof Config)[];
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const value = toSave[key];
      queries.push(
        pool.query(
          "INSERT INTO app_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2",
          [key, value != null ? String(value) : ""]
        )
      );
    }

    await Promise.all(queries);
  } catch (e: any) {
    console.warn(`[config] Could not write config to DB: ${e.message}`);
  }

  return _config;
}

import { join } from "path";

const CONFIG_PATH = join(import.meta.dir, "../config.json");

export interface Config {
  // Discord
  discordBotToken: string;
  discordGuildId: string;
  discordChannelId: string;
  discordStreamerRoleId: string;  // filter: only notify if streamer has this role
  discordNotifyRoleId: string;    // ping: mention this role in the notification
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
  // API auth
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
  // API key: use env var if set (survives redeploys), otherwise generate once
  apiKey: process.env.API_KEY ?? crypto.randomUUID(),
};

let _config: Config = { ...defaults };

export function loadConfig(): Config {
  try {
    const file = Bun.file(CONFIG_PATH);
    if (file.size > 0) {
      const raw = JSON.parse(Bun.readFileSync(CONFIG_PATH).toString());
      _config = { ...defaults, ...raw };
      // Always prefer env var for API key
      if (process.env.API_KEY) _config.apiKey = process.env.API_KEY;
    }
  } catch {
    saveConfig(_config);
  }
  return _config;
}

export function getConfig(): Config {
  return _config;
}

export function saveConfig(config: Partial<Config>): Config {
  _config = { ..._config, ...config };
  // Never overwrite API key from env var
  if (process.env.API_KEY) _config.apiKey = process.env.API_KEY;
  Bun.write(CONFIG_PATH, JSON.stringify(_config, null, 2));
  return _config;
}

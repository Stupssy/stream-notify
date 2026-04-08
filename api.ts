const BASE = import.meta.env.VITE_BOT_URL ?? "http://localhost:3001";

function getApiKey() {
  return localStorage.getItem("sn_api_key") ?? "";
}

async function api(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": getApiKey(),
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export const botApi = {
  health: () => api("/health"),
  status: () => api("/api/status"),
  getConfig: () => api("/api/config"),
  saveConfig: (config: Record<string, unknown>) =>
    api("/api/config", { method: "POST", body: JSON.stringify(config) }),
  start: () => api("/api/bot/start", { method: "POST" }),
  stop: () => api("/api/bot/stop", { method: "POST" }),
  restart: () => api("/api/bot/restart", { method: "POST" }),
  validateDiscord: () => api("/api/validate/discord"),
  validateTwitch: () => api("/api/validate/twitch"),
};

export function setApiKey(key: string) {
  localStorage.setItem("sn_api_key", key);
}

export function setBotUrl(url: string) {
  localStorage.setItem("sn_bot_url", url);
}

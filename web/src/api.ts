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
  coldRestart: () => api("/api/bot/cold-restart", { method: "POST" }),
  validateDiscord: () => api("/api/validate/discord"),
  validateTwitch: () => api("/api/validate/twitch"),
};

export function setApiKey(key: string) {
  localStorage.setItem("sn_api_key", key);
}

export function setBotUrl(url: string) {
  localStorage.setItem("sn_bot_url", url);
}

export async function exportConfig(): Promise<void> {
  const BASE = localStorage.getItem("sn_bot_url") ?? "";
  const key = localStorage.getItem("sn_api_key") ?? "";
  const res = await fetch(`${BASE}/api/config/export`, {
    headers: { "X-API-Key": key },
  });
  if (!res.ok) throw new Error("Export fehlgeschlagen");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "stream-notify-config.json";
  a.click();
  URL.revokeObjectURL(url);
}

export async function importConfig(json: string): Promise<void> {
  const BASE = localStorage.getItem("sn_bot_url") ?? "";
  const key = localStorage.getItem("sn_api_key") ?? "";
  const res = await fetch(`${BASE}/api/config/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": key },
    body: json,
  });
  if (!res.ok) throw new Error("Import fehlgeschlagen");
}

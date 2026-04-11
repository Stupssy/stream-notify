const BASE = import.meta.env.VITE_BOT_URL ?? "http://localhost:3001";

function getBaseUrl(): string {
  return localStorage.getItem("sn_bot_url") ?? BASE;
}

function getApiKey(): string {
  return localStorage.getItem("sn_api_key") ?? "";
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": getApiKey(),
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<T>;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface LogEntry {
  id: number;
  timestamp: string;
  level: "info" | "warn" | "error" | "command" | "event";
  message: string;
}

export interface BotStatusResponse {
  running: boolean;
  lastCheck: string | null;
  lastError: string | null;
  isLive: boolean;
  notificationsSent: number;
  uptime: number;
  currentStream: {
    title?: string;
    gameName?: string;
    viewerCount?: number;
  } | null;
  version?: string;
}

export const botApi = {
  health: () => api<{ ok: boolean; ts: number }>("/health"),
  status: () => api<BotStatusResponse>("/api/status"),
  getConfig: () => api<Record<string, unknown>>("/api/config"),
  saveConfig: (config: Record<string, unknown>) =>
    api<{ ok: boolean; message: string }>("/api/config", { method: "POST", body: JSON.stringify(config) }),
  start: () => api<{ ok: boolean }>("/api/bot/start", { method: "POST" }),
  stop: () => api<{ ok: boolean }>("/api/bot/stop", { method: "POST" }),
  restart: () => api<{ ok: boolean }>("/api/bot/restart", { method: "POST" }),
  coldRestart: () => api<{ ok: boolean; message?: string }>("/api/bot/cold-restart", { method: "POST" }),
  validateDiscord: () => api<ValidationResult>("/api/validate/discord"),
  getLogs: () => api<LogEntry[]>("/api/logs"),
};

export function createLogStream(): EventSource {
  const url = `${getBaseUrl()}/api/logs/stream`;
  const eventSource = new EventSource(`${url}?api_key=${getApiKey()}`);
  return eventSource;
}

export function setApiKey(key: string) {
  localStorage.setItem("sn_api_key", key);
}

export function setBotUrl(url: string) {
  localStorage.setItem("sn_bot_url", url);
}

export async function exportConfig(): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/api/config/export`, {
    headers: { "X-API-Key": getApiKey() },
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

const MAX_IMPORT_SIZE = 1024 * 1024; // 1MB

export async function importConfig(json: string): Promise<void> {
  if (json.length > MAX_IMPORT_SIZE) throw new Error("Datei zu groß (max 1MB)");
  const res = await fetch(`${getBaseUrl()}/api/config/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": getApiKey() },
    body: json,
  });
  if (!res.ok) throw new Error("Import fehlgeschlagen");
}

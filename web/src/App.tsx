import { useState, useEffect, useCallback } from "react";
import { botApi, setApiKey, setBotUrl } from "./api";

// ─── types ───────────────────────────────────────────────────────────────────
interface BotStatus {
  running: boolean;
  lastCheck: string | null;
  lastError: string | null;
  isLive: boolean;
  notificationsSent: number;
  currentStream: {
    title?: string;
    gameName?: string;
    viewerCount?: number;
  } | null;
}

interface Config {
  discordBotToken: string;
  discordGuildId: string;
  discordChannelId: string;
  discordStreamerRoleId: string;
  discordNotifyRoleId: string;
  twitchClientId: string;
  twitchClientSecret: string;
  twitchUsername: string;
  notifyMessage: string;
  embedColor: string;
  embedTitle: string;
  pollIntervalSeconds: number;
  enabled: boolean;
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [url, setUrl] = useState(localStorage.getItem("sn_bot_url") ?? "");
  const [key, setKey] = useState(localStorage.getItem("sn_api_key") ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    setError("");
    try {
      localStorage.setItem("sn_bot_url", url);
      localStorage.setItem("sn_api_key", key);
      // Force api.ts to pick up new values via reload trick
      (window as any).__botUrl = url;
      await fetch(`${url}/health`);
      onLogin();
    } catch {
      setError("Bot nicht erreichbar. URL prüfen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-box">
        <div className="login-logo">
          <span className="logo-bracket">[</span>
          <span className="logo-text">stream-notify</span>
          <span className="logo-bracket">]</span>
        </div>
        <p className="login-sub">Control Panel</p>
        <div className="field-group">
          <label>BOT URL</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-bot.onrender.com"
            spellCheck={false}
          />
        </div>
        <div className="field-group">
          <label>API KEY</label>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            type="password"
            placeholder="aus der Bot-Konsole"
          />
        </div>
        {error && <div className="login-error">{error}</div>}
        <button className="btn-primary" onClick={handleLogin} disabled={loading}>
          {loading ? "VERBINDE..." : "CONNECT →"}
        </button>
      </div>
    </div>
  );
}

// ─── Status Card ──────────────────────────────────────────────────────────────
function StatusCard({ status, onStart, onStop, onRestart }: {
  status: BotStatus | null;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
}) {
  if (!status) return <div className="card skeleton" />;

  return (
    <div className="card">
      <div className="card-header">
        <span>STATUS</span>
        <span className={`dot ${status.running ? "dot-green" : "dot-red"}`} />
      </div>
      <div className="status-grid">
        <div className="stat">
          <span className="stat-label">BOT</span>
          <span className={`stat-value ${status.running ? "green" : "red"}`}>
            {status.running ? "ONLINE" : "OFFLINE"}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">STREAM</span>
          <span className={`stat-value ${status.isLive ? "live" : "dim"}`}>
            {status.isLive ? "● LIVE" : "○ OFFLINE"}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">NOTIFICATIONS</span>
          <span className="stat-value accent">{status.notificationsSent}</span>
        </div>
        <div className="stat">
          <span className="stat-label">LETZTER CHECK</span>
          <span className="stat-value dim">
            {status.lastCheck
              ? new Date(status.lastCheck).toLocaleTimeString("de-DE")
              : "—"}
          </span>
        </div>
      </div>

      {status.isLive && status.currentStream && (
        <div className="live-bar">
          <span className="live-tag">LIVE</span>
          <span className="live-info">
            {status.currentStream.title} · {status.currentStream.gameName} · {status.currentStream.viewerCount} viewers
          </span>
        </div>
      )}

      {status.lastError && (
        <div className="error-bar">⚠ {status.lastError}</div>
      )}

      <div className="btn-row">
        <button className="btn-sm btn-green" onClick={onStart} disabled={status.running}>START</button>
        <button className="btn-sm btn-red" onClick={onStop} disabled={!status.running}>STOP</button>
        <button className="btn-sm" onClick={onRestart}>RESTART</button>
      </div>
    </div>
  );
}

// ─── Config Form ──────────────────────────────────────────────────────────────
function ConfigForm({ onSaved }: { onSaved: () => void }) {
  const [config, setConfig] = useState<Partial<Config>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<"discord" | "twitch" | "notify" | "bot">("twitch");

  useEffect(() => {
    botApi.getConfig().then((c) => {
      setConfig(c);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function update(key: keyof Config, value: string | number | boolean) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      await botApi.saveConfig(config as Record<string, unknown>);
      setMsg("✓ Gespeichert & Bot neugestartet");
      onSaved();
    } catch {
      setMsg("✗ Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="card skeleton" style={{ height: 300 }} />;

  return (
    <div className="card">
      <div className="card-header"><span>KONFIGURATION</span></div>
      <div className="tabs">
        {(["twitch", "discord", "notify", "bot"] as const).map((t) => (
          <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="form-fields">
        {tab === "twitch" && <>
          <Field label="Twitch Username" value={config.twitchUsername ?? ""} onChange={(v) => update("twitchUsername", v)} placeholder="stupssy" />
          <Field label="Client ID" value={config.twitchClientId ?? ""} onChange={(v) => update("twitchClientId", v)} placeholder="von dev.twitch.tv" />
          <Field label="Client Secret" value={config.twitchClientSecret ?? ""} onChange={(v) => update("twitchClientSecret", v)} type="password" placeholder="••••••••" />
          <ValidateBtn label="Twitch testen" action={() => botApi.validateTwitch()} />
        </>}

        {tab === "discord" && <>
          <Field label="Bot Token" value={config.discordBotToken ?? ""} onChange={(v) => update("discordBotToken", v)} type="password" placeholder="Bot Token aus Developer Portal" />
          <Field label="Server (Guild) ID" value={config.discordGuildId ?? ""} onChange={(v) => update("discordGuildId", v)} placeholder="123456789" />
          <Field label="Channel ID" value={config.discordChannelId ?? ""} onChange={(v) => update("discordChannelId", v)} placeholder="Notification Channel ID" />
          <Field label="Ping Rollen-ID (optional)" value={config.discordNotifyRoleId ?? ""} onChange={(v) => update("discordNotifyRoleId", v)} placeholder="Rolle die gepingt wird (leer = kein Ping)" />
          <Field label="Streamer Rollen-ID (optional)" value={config.discordStreamerRoleId ?? ""} onChange={(v) => update("discordStreamerRoleId", v)} placeholder="Leer lassen = kein Filter" />
          <ValidateBtn label="Discord testen" action={() => botApi.validateDiscord()} />
        </>}

        {tab === "notify" && <>
          <Field label="Nachricht" value={config.notifyMessage ?? ""} onChange={(v) => update("notifyMessage", v)} placeholder="{username} ist live!" />
          <Field label="Embed Titel" value={config.embedTitle ?? ""} onChange={(v) => update("embedTitle", v)} />
          <Field label="Embed Farbe" value={config.embedColor ?? "#9146FF"} onChange={(v) => update("embedColor", v)} type="color" />
          <p className="hint">Variablen: {"{username}"} {"{title}"} {"{game}"} {"{viewers}"}</p>
        </>}

        {tab === "bot" && <>
          <Field label="Poll Interval (Sekunden)" value={String(config.pollIntervalSeconds ?? 60)} onChange={(v) => update("pollIntervalSeconds", parseInt(v))} type="number" />
          <div className="toggle-row">
            <label>Bot aktiviert</label>
            <button
              className={`toggle ${config.enabled ? "on" : "off"}`}
              onClick={() => update("enabled", !config.enabled)}
            >
              {config.enabled ? "AN" : "AUS"}
            </button>
          </div>
        </>}
      </div>

      {msg && <div className={`save-msg ${msg.startsWith("✓") ? "ok" : "err"}`}>{msg}</div>}
      <button className="btn-primary" onClick={save} disabled={saving}>
        {saving ? "SPEICHERE..." : "SPEICHERN →"}
      </button>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div className="field-group">
      <label>{label}</label>
      {type === "color"
        ? <div className="color-row">
            <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
            <span className="color-val">{value}</span>
          </div>
        : <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} spellCheck={false} />
      }
    </div>
  );
}

function ValidateBtn({ label, action }: { label: string; action: () => Promise<any> }) {
  const [state, setState] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");

  async function run() {
    setState("loading");
    try {
      const res = await action();
      if (res.valid === false) {
        setState("err");
        setMsg(res.error ?? "Ungültig");
      } else {
        setState("ok");
        setMsg(res.isLive !== undefined ? (res.isLive ? "Live!" : "Offline (aber valide)") : "OK!");
      }
    } catch {
      setState("err");
      setMsg("Verbindungsfehler");
    }
  }

  return (
    <div className="validate-row">
      <button className="btn-sm" onClick={run} disabled={state === "loading"}>
        {state === "loading" ? "..." : label}
      </button>
      {state === "ok" && <span className="green">✓ {msg}</span>}
      {state === "err" && <span className="red">✗ {msg}</span>}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [status, setStatus] = useState<BotStatus | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const s = await botApi.status();
      setStatus(s);
    } catch {}
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    fetchStatus();
    const id = setInterval(fetchStatus, 10_000);
    return () => clearInterval(id);
  }, [loggedIn, fetchStatus]);

  if (!loggedIn) {
    return <LoginScreen onLogin={() => setLoggedIn(true)} />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          <span className="logo-bracket">[</span>
          <span className="logo-text">stream-notify</span>
          <span className="logo-bracket">]</span>
        </div>
        <div className="topbar-right">
          <span className={`dot ${status?.running ? "dot-green" : "dot-red"}`} />
          <span className="dim">{status?.running ? "BOT ONLINE" : "BOT OFFLINE"}</span>
          <button className="btn-xs" onClick={() => setLoggedIn(false)}>DISCONNECT</button>
        </div>
      </header>

      <main className="main-grid">
        <StatusCard
          status={status}
          onStart={async () => { await botApi.start(); fetchStatus(); }}
          onStop={async () => { await botApi.stop(); fetchStatus(); }}
          onRestart={async () => { await botApi.restart(); fetchStatus(); }}
        />
        <ConfigForm onSaved={fetchStatus} />
      </main>
    </div>
  );
}

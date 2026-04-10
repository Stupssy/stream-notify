import { useState, useEffect, useCallback, useRef } from "react";
import { botApi, exportConfig, importConfig, type ValidationResult } from "./api";

interface BotStatus {
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
}

interface ConfigFormData {
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

const MASKED = "__masked__";

function isMasked(v: string | undefined) {
  return v === MASKED;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [url, setUrl] = useState(localStorage.getItem("sn_bot_url") ?? "");
  const [key, setKey] = useState(localStorage.getItem("sn_api_key") ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    setError("");
    try {
      localStorage.setItem("sn_bot_url", url.replace(/\/$/, ""));
      localStorage.setItem("sn_api_key", key);
      const res = await fetch(`${url.replace(/\/$/, "")}/health`);
      if (!res.ok) throw new Error("not ok");
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
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-bot.onrender.com" spellCheck={false} />
        </div>
        <div className="field-group">
          <label>API KEY</label>
          <input value={key} onChange={(e) => setKey(e.target.value)} type="password" placeholder="aus Render Environment" />
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
function StatusCard({ status, onStart, onStop, onRestart, onColdRestart, actionDisabled }: {
  status: BotStatus | null;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onColdRestart: () => void;
  actionDisabled: boolean;
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
          <span className={`stat-value ${status.running ? "green" : "red"}`}>{status.running ? "ONLINE" : "OFFLINE"}</span>
        </div>
        <div className="stat">
          <span className="stat-label">STREAM</span>
          <span className={`stat-value ${status.isLive ? "live" : "dim"}`}>{status.isLive ? "● LIVE" : "○ OFFLINE"}</span>
        </div>
        <div className="stat">
          <span className="stat-label">NOTIFICATIONS</span>
          <span className="stat-value accent">{status.notificationsSent}</span>
        </div>
        <div className="stat">
          <span className="stat-label">UPTIME</span>
          <span className="stat-value dim">{status.running ? formatUptime(status.uptime ?? 0) : "—"}</span>
        </div>
        <div className="stat" style={{ gridColumn: "1 / -1" }}>
          <span className="stat-label">LETZTER CHECK</span>
          <span className="stat-value dim">{status.lastCheck ? new Date(status.lastCheck).toLocaleTimeString("de-DE") : "—"}</span>
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
      {status.lastError && <div className="error-bar">⚠ {status.lastError}</div>}
      <div className="btn-row">
        <button className="btn-sm btn-green" onClick={onStart} disabled={status.running || actionDisabled}>START</button>
        <button className="btn-sm btn-red" onClick={onStop} disabled={!status.running || actionDisabled}>STOP</button>
        <button className="btn-sm" onClick={onRestart} disabled={actionDisabled} title="Neustart — behält Stream-Status (kein Doppel-Ping)">RESTART</button>
        <button className="btn-sm btn-orange" onClick={onColdRestart} disabled={actionDisabled} title="Cold Restart — setzt alles zurück. Sendet Notification wenn Stream gerade live ist.">COLD↺</button>
      </div>
    </div>
  );
}

// ─── Secret Field ─────────────────────────────────────────────────────────────
// For fields that arrive as "__masked__" from the server.
// Shows a "SET ✓" badge + "Ändern"-button instead of the masked placeholder.
// Only sends a new value if the user explicitly clicked "Ändern" and typed something.
function SecretField({ label, value, onChange, placeholder, id }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const fieldId = id ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const isSet = isMasked(value);

  if (isSet && !editing) {
    return (
      <div className="field-group">
        <label htmlFor={fieldId}>{label}</label>
        <div className="secret-set-row">
          <span className="secret-set-badge">SET ✓</span>
          <span className="secret-set-hint">via Render Env Var oder gespeichert</span>
          <button className="btn-xs" id={`btn-${fieldId}`} onClick={() => { setDraft(""); setEditing(true); }}>ÄNDERN</button>
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="field-group">
        <label htmlFor={fieldId}>{label}</label>
        <div className="secret-edit-row">
          <input
            type="password"
            id={fieldId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder ?? "Neuen Wert eingeben..."}
            autoFocus
            spellCheck={false}
          />
          <button className="btn-xs btn-xs-green" onClick={() => {
            if (draft.trim()) { onChange(draft.trim()); }
            setEditing(false);
          }}>OK</button>
          <button className="btn-xs" onClick={() => {
            setEditing(false);
            if (isSet) onChange(MASKED);
          }}>✕</button>
        </div>
      </div>
    );
  }

  // Not masked, not editing — normal password input (new value being entered)
  return (
    <div className="field-group">
      <label htmlFor={fieldId}>{label}</label>
      <input
        type="password"
        id={fieldId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
      />
    </div>
  );
}

// ─── Config Form ──────────────────────────────────────────────────────────────
function ConfigForm({ onSaved }: { onSaved: () => void }) {
  const [config, setConfig] = useState<Partial<ConfigFormData>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<"twitch" | "discord" | "notify" | "bot">("twitch");
  const [importMsg, setImportMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    botApi.getConfig()
      .then((c) => { setConfig(c as Partial<ConfigFormData>); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function update<K extends keyof ConfigFormData>(key: K, value: ConfigFormData[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true); setMsg("");
    try {
      // Build payload — strip masked values so server keeps existing secrets
      const payload: Record<string, unknown> = { ...config };
      if (payload.discordBotToken === MASKED) delete payload.discordBotToken;
      if (payload.twitchClientSecret === MASKED) delete payload.twitchClientSecret;

      await botApi.saveConfig(payload);
      // Reload from server so masked fields are correctly reflected
      const fresh = await botApi.getConfig();
      setConfig(fresh);
      setMsg("✓ Gespeichert & Bot neugestartet");
      onSaved();
    } catch {
      setMsg("✗ Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  async function handleExport() {
    try {
      await exportConfig();
      setImportMsg("✓ Export gestartet");
    } catch { setImportMsg("✗ Export fehlgeschlagen"); }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      JSON.parse(text); // validate
      await importConfig(text);
      const c = await botApi.getConfig();
      setConfig(c);
      setImportMsg("✓ Config importiert & Bot neugestartet");
      onSaved();
    } catch { setImportMsg("✗ Import fehlgeschlagen — gültige JSON-Datei?"); }
    if (fileRef.current) fileRef.current.value = "";
  }

  if (loading) return <div className="card skeleton" style={{ height: 300 }} />;

  return (
    <div className="card">
      <div className="card-header">
        <span>KONFIGURATION</span>
        <div className="header-actions">
          <button className="btn-xs" onClick={handleExport} title="Config als JSON exportieren">↓ EXPORT</button>
          <button className="btn-xs" onClick={() => fileRef.current?.click()} title="Config aus JSON importieren">↑ IMPORT</button>
          <input ref={fileRef} type="file" accept=".json" style={{ display: "none" }} onChange={handleImport} />
        </div>
      </div>

      {importMsg && (
        <div className={`save-msg ${importMsg.startsWith("✓") ? "ok" : "err"}`}>{importMsg}</div>
      )}

      <div className="tabs">
        {(["twitch", "discord", "notify", "bot"] as const).map((t) => (
          <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="form-fields">
        {tab === "twitch" && <>
          <Field label="Twitch Username" value={config.twitchUsername ?? ""} onChange={(v) => update("twitchUsername", v)} placeholder="stupssy" id="twitch-username" />
          <Field label="Client ID" value={config.twitchClientId ?? ""} onChange={(v) => update("twitchClientId", v)} placeholder="von dev.twitch.tv" id="twitch-client-id" />
          <SecretField label="Client Secret" value={config.twitchClientSecret ?? ""} onChange={(v) => update("twitchClientSecret", v)} placeholder="Twitch Client Secret" id="twitch-client-secret" />
          <ValidateBtn label="Twitch testen" action={() => botApi.validateTwitch()} resetKey={`${config.twitchUsername ?? ""}${config.twitchClientId ?? ""}${config.twitchClientSecret ?? ""}`} />
        </>}

        {tab === "discord" && <>
          <SecretField label="Bot Token" value={config.discordBotToken ?? ""} onChange={(v) => update("discordBotToken", v)} placeholder="Bot Token aus Developer Portal" id="discord-bot-token" />
          <Field label="Server (Guild) ID" value={config.discordGuildId ?? ""} onChange={(v) => update("discordGuildId", v)} placeholder="123456789" id="discord-guild-id" />
          <Field label="Channel ID" value={config.discordChannelId ?? ""} onChange={(v) => update("discordChannelId", v)} placeholder="Notification Channel ID" id="discord-channel-id" />
          <Field label="Ping Rollen-ID (optional)" value={config.discordNotifyRoleId ?? ""} onChange={(v) => update("discordNotifyRoleId", v)} placeholder="Rolle die gepingt wird (leer = kein Ping)" id="discord-notify-role-id" />
          <Field label="Streamer Rollen-ID (optional)" value={config.discordStreamerRoleId ?? ""} onChange={(v) => update("discordStreamerRoleId", v)} placeholder="Leer lassen = kein Filter" id="discord-streamer-role-id" />
          <ValidateBtn label="Discord testen" action={() => botApi.validateDiscord()} resetKey={`${config.discordBotToken ?? ""}${config.discordGuildId ?? ""}`} />
        </>}

        {tab === "notify" && <>
          <Field label="Nachricht" value={config.notifyMessage ?? ""} onChange={(v) => update("notifyMessage", v)} placeholder="{username} ist live!" />
          <Field label="Embed Titel" value={config.embedTitle ?? ""} onChange={(v) => update("embedTitle", v)} />
          <Field label="Embed Farbe" value={config.embedColor ?? "#9146FF"} onChange={(v) => update("embedColor", v)} type="color" />
          <p className="hint">Variablen: {"{username}"} {"{title}"} {"{game}"} {"{viewers}"}</p>
        </>}

        {tab === "bot" && <>
          <Field label="Poll Interval (Sekunden, min. 30)" value={String(config.pollIntervalSeconds ?? 60)} onChange={(v) => update("pollIntervalSeconds", Math.max(30, parseInt(v) || 60))} type="number" />
          <div className="toggle-row">
            <label>Bot aktiviert</label>
            <button className={`toggle ${config.enabled ? "on" : "off"}`} onClick={() => update("enabled", !config.enabled)}>
              {config.enabled ? "AN" : "AUS"}
            </button>
          </div>
          <div className="info-box">
            <p className="hint" style={{ borderColor: "var(--dim)" }}>
              💡 Secrets (Token, Client Secret) können auch als Render Env Vars gesetzt werden:<br />
              <code>DISCORD_BOT_TOKEN</code> · <code>TWITCH_CLIENT_ID</code> · <code>TWITCH_CLIENT_SECRET</code><br />
              Env Vars überschreiben immer die gespeicherte Config und überleben Redeploys.
            </p>
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

function Field({ label, value, onChange, type = "text", placeholder, id }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; id?: string;
}) {
  const fieldId = id ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div className="field-group">
      <label htmlFor={fieldId}>{label}</label>
      {type === "color"
        ? <div className="color-row">
            <input type="color" id={fieldId} value={value} onChange={(e) => onChange(e.target.value)} />
            <span className="color-val">{value}</span>
          </div>
        : <input type={type} id={fieldId} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} spellCheck={false} />
      }
    </div>
  );
}

function ValidateBtn({ label, action, resetKey = "" }: { label: string; action: () => Promise<ValidationResult>; resetKey?: string }) {
  const [state, setState] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");

  // Reset validation state when the underlying form data changes
  useEffect(() => {
    setState("idle");
    setMsg("");
  }, [resetKey]);

  async function run() {
    setState("loading");
    try {
      const res = await action();
      if (res.valid === false) { setState("err"); setMsg(res.error ?? "Ungültig"); }
      else { setState("ok"); setMsg(res.isLive !== undefined ? (res.isLive ? "Live!" : "Offline (valide)") : "OK!"); }
    } catch { setState("err"); setMsg("Verbindungsfehler"); }
  }

  return (
    <div className="validate-row">
      <button className="btn-sm" onClick={run} disabled={state === "loading"}>{state === "loading" ? "..." : label}</button>
      {state === "ok" && <span className="green">✓ {msg}</span>}
      {state === "err" && <span className="red">✗ {msg}</span>}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 10_000;

type ActionState = "idle" | "loading";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [pollError, setPollError] = useState(false);
  const [actionState, setActionState] = useState<ActionState>("idle");

  const fetchStatus = useCallback(async () => {
    try {
      setStatus(await botApi.status());
      setPollError(false);
    } catch {
      setPollError(true);
    }
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    fetchStatus();
    const id = setInterval(fetchStatus, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [loggedIn, fetchStatus]);

  async function withAction(action: () => Promise<unknown>) {
    setActionState("loading");
    try {
      await action();
      await fetchStatus();
    } finally {
      setActionState("idle");
    }
  }

  if (!loggedIn) return <LoginScreen onLogin={() => setLoggedIn(true)} />;

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          <span className="logo-bracket">[</span>
          <span className="logo-text">stream-notify</span>
          <span className="logo-bracket">]</span>
        </div>
        <div className="topbar-right">
          <span className={`dot ${pollError ? "dot-red" : status?.running ? "dot-green" : "dot-red"}`} />
          <span className="dim">
            {pollError ? "POLL ERROR" : status?.running ? "BOT ONLINE" : "BOT OFFLINE"}
          </span>
          <button className="btn-xs" onClick={() => setLoggedIn(false)}>DISCONNECT</button>
        </div>
      </header>
      <main className="main-grid">
        <StatusCard
          status={status}
          onStart={() => withAction(botApi.start)}
          onStop={() => { if (window.confirm("Bot wirklich stoppen?")) withAction(botApi.stop); }}
          onRestart={() => { if (window.confirm("Bot neustarten?")) withAction(botApi.restart); }}
          onColdRestart={() => { if (window.confirm("Cold Restart: Bot komplett neustarten? Stream-Status wird zurückgesetzt.")) withAction(botApi.coldRestart); }}
          actionDisabled={actionState === "loading"}
        />
        <ConfigForm onSaved={fetchStatus} />
      </main>
    </div>
  );
}
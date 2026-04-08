import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const css = `
  :root {
    --bg: #0a0a0f;
    --bg2: #0f0f1a;
    --bg3: #141422;
    --border: #1e1e35;
    --text: #c8c8e0;
    --dim: #5a5a80;
    --accent: #7c6af7;
    --green: #3dffa0;
    --red: #ff4757;
    --live: #ff3c5f;
    --font-mono: 'JetBrains Mono', monospace;
    --font-display: 'Syne', sans-serif;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 13px;
    min-height: 100vh;
  }

  /* scrollbar */
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

  /* ── Login ─────────────────────────── */
  .login-screen {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background:
      radial-gradient(ellipse 60% 50% at 50% 0%, rgba(124,106,247,0.12) 0%, transparent 70%),
      var(--bg);
  }

  .login-box {
    width: 360px;
    background: var(--bg2);
    border: 1px solid var(--border);
    padding: 40px 36px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .login-logo {
    font-family: var(--font-display);
    font-size: 26px;
    font-weight: 800;
    text-align: center;
    letter-spacing: -0.5px;
  }

  .logo-bracket { color: var(--accent); }
  .logo-text { color: var(--text); margin: 0 4px; }

  .login-sub {
    text-align: center;
    color: var(--dim);
    font-size: 11px;
    letter-spacing: 3px;
    text-transform: uppercase;
    margin-top: -12px;
  }

  .login-error {
    background: rgba(255,71,87,0.1);
    border: 1px solid rgba(255,71,87,0.3);
    color: var(--red);
    padding: 8px 12px;
    font-size: 12px;
  }

  /* ── Layout ────────────────────────── */
  .app { min-height: 100vh; display: flex; flex-direction: column; }

  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 24px;
    border-bottom: 1px solid var(--border);
    background: var(--bg2);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .topbar-left .logo-bracket { color: var(--accent); }
  .topbar-left .logo-text { font-family: var(--font-display); font-weight: 700; font-size: 15px; margin: 0 3px; }

  .topbar-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .main-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    padding: 24px;
    max-width: 1100px;
    width: 100%;
    margin: 0 auto;
  }

  @media (max-width: 700px) {
    .main-grid { grid-template-columns: 1fr; }
  }

  /* ── Cards ─────────────────────────── */
  .card {
    background: var(--bg2);
    border: 1px solid var(--border);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .card.skeleton {
    animation: pulse 1.5s ease infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }

  .header-actions { display: flex; gap: 6px; }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 10px;
    letter-spacing: 3px;
    color: var(--dim);
    border-bottom: 1px solid var(--border);
    padding-bottom: 12px;
  }

  /* ── Status ────────────────────────── */
  .status-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px;
    background: var(--bg3);
    border: 1px solid var(--border);
  }

  .stat-label {
    font-size: 9px;
    letter-spacing: 2px;
    color: var(--dim);
  }

  .stat-value { font-size: 15px; font-weight: 600; }

  .green { color: var(--green); }
  .red { color: var(--red); }
  .accent { color: var(--accent); }
  .dim { color: var(--dim); font-size: 11px; }

  .live { color: var(--live); animation: blink 1.5s step-end infinite; }
  @keyframes blink {
    50% { opacity: 0.4; }
  }

  .live-bar {
    background: rgba(255,60,95,0.08);
    border: 1px solid rgba(255,60,95,0.25);
    padding: 8px 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    overflow: hidden;
  }

  .live-tag {
    background: var(--live);
    color: #000;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 2px;
    padding: 2px 6px;
    flex-shrink: 0;
  }

  .live-info {
    color: var(--dim);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .error-bar {
    background: rgba(255,71,87,0.08);
    border: 1px solid rgba(255,71,87,0.2);
    color: var(--red);
    padding: 8px 12px;
    font-size: 12px;
  }

  /* ── Dots ──────────────────────────── */
  .dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .dot-green { background: var(--green); box-shadow: 0 0 6px var(--green); }
  .dot-red { background: var(--red); box-shadow: 0 0 6px var(--red); }

  /* ── Tabs ──────────────────────────── */
  .tabs {
    display: flex;
    gap: 2px;
    background: var(--bg);
    padding: 3px;
  }

  .tab {
    background: none;
    border: none;
    color: var(--dim);
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 2px;
    padding: 6px 12px;
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
  }

  .tab:hover { color: var(--text); }
  .tab.active { background: var(--bg3); color: var(--accent); border-bottom: 1px solid var(--accent); }

  /* ── Forms ─────────────────────────── */
  .form-fields {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 180px;
  }

  .field-group {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .field-group label {
    font-size: 9px;
    letter-spacing: 2px;
    color: var(--dim);
  }

  .field-group input,
  .field-group input[type="text"],
  .field-group input[type="password"],
  .field-group input[type="number"] {
    background: var(--bg3);
    border: 1px solid var(--border);
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 12px;
    padding: 8px 10px;
    outline: none;
    transition: border-color 0.15s;
    width: 100%;
  }

  .field-group input:focus {
    border-color: var(--accent);
  }

  .color-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .color-row input[type="color"] {
    width: 40px;
    height: 32px;
    padding: 2px;
    border: 1px solid var(--border);
    background: var(--bg3);
    cursor: pointer;
  }

  .color-val { color: var(--dim); font-size: 12px; }

  .hint {
    color: var(--dim);
    font-size: 11px;
    padding: 6px 10px;
    background: var(--bg3);
    border-left: 2px solid var(--accent);
  }

  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px;
    background: var(--bg3);
    border: 1px solid var(--border);
  }

  .toggle {
    border: 1px solid;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 2px;
    padding: 4px 14px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .toggle.on { border-color: var(--green); color: var(--green); background: rgba(61,255,160,0.08); }
  .toggle.off { border-color: var(--dim); color: var(--dim); background: none; }

  .validate-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .save-msg {
    padding: 8px 12px;
    font-size: 12px;
    border: 1px solid;
  }
  .save-msg.ok { color: var(--green); border-color: rgba(61,255,160,0.3); background: rgba(61,255,160,0.05); }
  .save-msg.err { color: var(--red); border-color: rgba(255,71,87,0.3); background: rgba(255,71,87,0.05); }

  /* ── Buttons ───────────────────────── */
  .btn-primary {
    background: var(--accent);
    border: none;
    color: #fff;
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 2px;
    padding: 12px 20px;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.1s;
    align-self: stretch;
  }

  .btn-primary:hover { opacity: 0.85; }
  .btn-primary:active { transform: translateY(1px); }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

  .btn-row { display: flex; gap: 6px; }

  .btn-sm {
    background: var(--bg3);
    border: 1px solid var(--border);
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 1.5px;
    padding: 6px 12px;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }

  .btn-sm:hover { border-color: var(--accent); color: var(--accent); }
  .btn-sm:disabled { opacity: 0.3; cursor: not-allowed; }
  .btn-sm.btn-green:not(:disabled):hover { border-color: var(--green); color: var(--green); }
  .btn-sm.btn-red:not(:disabled):hover { border-color: var(--red); color: var(--red); }

  .btn-xs {
    background: none;
    border: 1px solid var(--border);
    color: var(--dim);
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 1.5px;
    padding: 4px 8px;
    cursor: pointer;
    transition: border-color 0.15s;
  }

  .btn-xs:hover { border-color: var(--red); color: var(--red); }
`;

const style = document.createElement("style");
style.textContent = css;
document.head.appendChild(style);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

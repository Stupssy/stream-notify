# stream-notify — Komplettes Setup

Schritt-für-Schritt-Anleitung für Discord Bot, Twitch API, Render Hosting, Persistent Storage und WebUI.

---

## Übersicht der Komponenten

| Komponente | Hosting | Zweck |
|---|---|---|
| **Bot** (Bun + Elysia API) | Render Web Service | Twitch-Checks, Discord-Nachrichten, REST-API |
| **WebUI** (React + Vite) | Render Static Site | Konfigurationsoberfläche |
| **Persistent Disk** | Render Volume | Speichert `config.json` und `users.json` |
| **Keepalive** | cron-job.org | Verhindert Render Spin-Down (Free Tier) |

---

## 1. Discord Bot erstellen

### App & Bot anlegen

1. **Discord Developer Portal** öffnen: https://discord.com/developers/applications
2. **New Application** klicken → Namen vergeben (z.B. `stream-notify`)
3. Linkes Menü → **Bot**
4. **Reset Token** → **Copy** → **Token sicher speichern** (nur einmal sichtbar!)
5. Bot-Einstellungen:
   - `Public Bot`: **AUS** (nur dein Server)
   - `Presence Intent`: **AN**
   - `Server Members Intent`: **AN**
   - `Message Content Intent`: **AN**

### Bot einladen

1. Linkes Menü → **OAuth2 → URL Generator**
2. **Scopes:** `bot`
3. **Bot Permissions:**
   - `Send Messages`
   - `Embed Links`
   - `Mention Everyone`
   - `Manage Roles`
   - `Use Slash Commands`
4. Generierten Link kopieren → im Browser öffnen → Server auswählen → **Autorisieren**

### IDs ermitteln

**Entwicklermodus aktivieren:** Discord → Einstellungen → Erweitert → Entwicklermodus → **AN**

| ID | So findest du sie |
|---|---|
| **Guild ID** | Rechtsklick auf Server-Icon → ID kopieren |
| **Channel ID** | Rechtsklick auf Text-Channel → ID kopieren |
| **Role ID** | Servereinstellungen → Rollen → Rechtsklick auf Rolle → ID kopieren |

> **Empfohlene Rollen:**
> - `Ping Role`: Eine Rolle die `@everyone` pingen soll (z.B. `@Live-Ping`)
> - `Streamer Role`: Eine Rolle die Nutzer via `/setup` bekommen (z.B. `@Streamer`)

---

## 2. Twitch App erstellen

1. **Twitch Developer Console** öffnen: https://dev.twitch.tv/console
2. **Register Your Application** klicken
3. Formular ausfüllen:
   | Feld | Wert |
   |---|---|
   | Name | `stream-notify` (frei wählbar) |
   | OAuth Redirect URL | `http://localhost` |
   | Kategorie | `Chat Bot` |
   | Client-Typ | `Vertraulich` (Confidential) |
4. **Erstellen** → **Client ID** kopieren
5. Auf der App-Seite → **New Secret** → **Client Secret** kopieren
   > ⚠️ Das Secret wird **nur einmal** angezeigt! Sofort speichern.

---

## 3. Render — Persistent Disk erstellen

1. **Render Dashboard** öffnen: https://dashboard.render.com
2. **New → Persistent Disk**
3. Formular:
   | Feld | Wert |
   |---|---|
   | Name | `stream-notify-data` |
   | Region | Nächste zu dir (z.B. `Frankfurt`) |
   | Mount Path | `/data` |
   | Größe | `1 GB` (Free Tier) |
4. **Create Disk** → **Mount Path notieren** (`/data`)

> **Wichtig:** Ohne Persistent Disk gehen alle Einstellungen (`config.json`, `users.json`) nach jedem Redeploy verloren.

---

## 4. Render — Bot (Web Service) deployen

### Service erstellen

1. **Render Dashboard** → **New → Web Service**
2. Repository verbinden (GitHub) oder Public Repo-URL eingeben
3. Einstellungen:
   | Feld | Wert |
   |---|---|
   | Name | `stream-notify-bot` |
   | Region | Gleiche Region wie Persistent Disk |
   | Branch | `main` |
   | Root Directory | `bot` |
   | Runtime | `Node` |
   | Build Command | `bun install` |
   | Start Command | `bun run src/index.ts` |
   | Instance Type | **Free** |

### Environment Variables setzen

Im Render Dashboard → Bot Service → **Environment**:

| Key | Wert | Required? | Beschreibung |
|---|---|---|---|
| `API_KEY` | Beliebiger zufälliger String (z.B. via `openssl rand -hex 16`) | **Ja** | Authentifizierung WebUI ↔ Bot |
| `DATA_DIR` | `/data` | **Ja** | Pfad zum Persistent Disk |
| `DISCORD_BOT_TOKEN` | Aus Schritt 1 | Nein | Discord Bot Token (kann auch über WebUI gesetzt werden) |
| `TWITCH_CLIENT_ID` | Aus Schritt 2 | Nein | Twitch Client ID (kann auch über WebUI gesetzt werden) |
| `TWITCH_CLIENT_SECRET` | Aus Schritt 2 | Nein | Twitch Client Secret (kann auch über WebUI gesetzt werden) |
| `DISCORD_GUILD_ID` | Aus Schritt 1 | Nein | Discord Server ID |
| `DISCORD_CHANNEL_ID` | Aus Schritt 1 | Nein | Discord Channel ID für Notifications |
| `DISCORD_NOTIFY_ROLE_ID` | Aus Schritt 1 | Nein | Rolle die bei Go-Live gepingt wird |
| `DISCORD_STREAMER_ROLE_ID` | Aus Schritt 1 | Nein | Rolle die via `/setup` zugewiesen wird |

> **Hinweis:** Nur `API_KEY` und `DATA_DIR` sind zwingend erforderlich. Alle anderen Werte können auch später über die WebUI konfiguriert werden.
>
> **Wichtig:** Environment Variables überschreiben **immer** die Werte aus `config.json` auf dem Disk. Das ist gewollt — Secrets bleiben so auch nach Redeploys erhalten.

### Persistent Disk mounten

1. Im Render Dashboard → Bot Service → **Disks**
2. **Attach Disk** → Das erstellte Disk (`stream-notify-data`) auswählen
3. **Mount Path:** `/data` (sollte automatisch übernommen werden)

### Deployen

1. **Deploy** klicken
2. Logs beobachten → `[server] API running on port 3001` bedeutet: erfolgreich
3. **Service URL notieren** (z.B. `https://stream-notify-bot.onrender.com`)

---

## 5. Render — WebUI (Static Site) deployen

### Service erstellen

1. **Render Dashboard** → **New → Static Site**
2. Repository verbinden
3. Einstellungen:
   | Feld | Wert |
   |---|---|
   | Name | `stream-notify-web` |
   | Root Directory | `web` |
   | Build Command | `npm install && npm run build` |
   | Publish Directory | `dist` |
   | Instance Type | **Free** |

### Environment Variables setzen

Im Render Dashboard → WebUI Service → **Environment**:

| Key | Wert | Beschreibung |
|---|---|---|
| `VITE_BOT_URL` | `https://dein-bot.onrender.com` | URL des Bot Web Service (aus Schritt 4) |

### Deployen

1. **Deploy** klicken
2. Nach dem Build: **Site URL notieren** (z.B. `https://stream-notify-web.onrender.com`)

---

## 6. Keepalive einrichten (cron-job.org)

Render Free Tier lässt Web Services nach ~15 Minuten ohne Traffic einschlafen. Ein Cronjob hält den Bot wach.

1. https://cron-job.org → **Kostenlos registrieren**
2. **Create Cronjob**
3. Einstellungen:
   | Feld | Wert |
   |---|---|
   | Title | `stream-notify keepalive` |
   | URL | `https://dein-bot.onrender.com/health` |
   | Schedule | `Every 5 minutes` (`*/5 * * * *`) |
4. **Create Cronjob**

> **Tipp:** Der `/health` Endpunkt antwortet sofort mit `{"ok":true}` — minimaler Overhead.

---

## 7. Erster Start über die WebUI

1. **WebUI öffnen:** `https://dein-webui.onrender.com`
2. **Bot URL** eingeben: `https://dein-bot.onrender.com`
3. **API Key** eingeben: (der Wert aus `API_KEY` Env Var)
4. **Connect** klicken
   > URL und API Key werden im Browser gespeichert — beim nächsten Mal nur noch Connect klicken.
5. **Discord Tab:**
   - Bot Token eintragen
   - Server ID, Channel ID, Rollen-IDs eintragen
   - **Speichern**
6. **Twitch Tab:**
   - Client ID und Client Secret eintragen
   - **Speichern**
7. **Notification Tab:**
   - Nachricht, Embed-Titel und Farbe anpassen (optional)
   - **Speichern**
8. **Bot Tab:**
   - Poll Interval: `60` (Sekunden, mindestens 30 empfohlen)
   - Update Interval: `5` (Minuten, wie oft das Embed aktualisiert wird)
   - **Bot aktiviert:** AN
   - **Speichern**

Der Bot startet automatisch und beginnt mit dem Polling.

---

## 8. Discord Slash Commands verwenden

Nachdem der Bot auf dem Server ist und die WebUI konfiguriert wurde:

### Für alle Nutzer

| Befehl | Beschreibung |
|---|---|
| `/setup twitch <username>` | Twitch-Username speichern + Streamer-Rolle zuweisen |
| `/setup remove` | Eigene Konfiguration löschen + Rolle entfernen |
| `/setup list` | Eigenen konfigurierten Twitch-Username anzeigen |

### Für Admins (Manage Roles Permission)

| Befehl | Beschreibung |
|---|---|
| `/admin list-all` | Alle konfigurierten Nutzer auflisten |
| `/admin remove-user @user` | Konfiguration eines Nutzers löschen |

> **Ablauf:** Jeder Nutzer führt `/setup twitch ihrname` aus. Der Bot speichert die Zuordnung persistent auf dem Disk und weist automatisch die `DISCORD_STREAMER_ROLE_ID` zu. Ab dann wird der Kanal auf Live-Status überwacht.

---

## Environment Variables — Vollständige Referenz

### Bot (Web Service)

| Key | Required | Typ | Beispiel | Beschreibung |
|---|---|---|---|---|
| `API_KEY` | **Ja** | String | `a1b2c3d4e5f6...` | Authentifizierung WebUI ↔ Bot. Zufälliger String, min. 16 Zeichen |
| `DATA_DIR` | **Ja** | Pfad | `/data` | Mount Path des Persistent Disks auf Render |
| `PORT` | Nein | Number | `3001` | Interner Port. Default: `3001` |
| `DISCORD_BOT_TOKEN` | Nein | String | `OTA...xyz` | Discord Bot Token aus dem Developer Portal |
| `TWITCH_CLIENT_ID` | Nein | String | `abc123...` | Twitch App Client ID |
| `TWITCH_CLIENT_SECRET` | Nein | String | `def456...` | Twitch App Client Secret |
| `TWITCH_USERNAME` | Nein | String | `stupssy` | Twitch Username für Single-User-Setup (Legacy) |
| `DISCORD_GUILD_ID` | Nein | String | `123456789` | Discord Server ID |
| `DISCORD_CHANNEL_ID` | Nein | String | `987654321` | Discord Channel ID für Notifications |
| `DISCORD_NOTIFY_ROLE_ID` | Nein | String | `111222333` | Discord Role ID für @Ping bei Go-Live |
| `DISCORD_STREAMER_ROLE_ID` | Nein | String | `444555666` | Discord Role ID die via `/setup` zugewiesen wird |

### WebUI (Static Site)

| Key | Required | Typ | Beispiel | Beschreibung |
|---|---|---|---|---|
| `VITE_BOT_URL` | **Ja** | URL | `https://dein-bot.onrender.com` | URL des Bot Web Service |

---

## Persistent Storage — Dateistruktur

Beide Dateien liegen auf dem Persistent Disk unter `/data`:

### `/data/config.json`

Enthält alle Einstellungen aus der WebUI (Discord, Twitch, Notifications, Bot-Settings).

```json
{
  "discordBotToken": "OTA...",
  "discordGuildId": "123456789",
  "discordChannelId": "987654321",
  "discordStreamerRoleId": "444555666",
  "discordNotifyRoleId": "111222333",
  "twitchClientId": "abc123...",
  "twitchClientSecret": "def456...",
  "twitchUsername": "",
  "notifyMessage": "🔴 **{username}** ist jetzt live auf Twitch!",
  "embedColor": "#9146FF",
  "embedTitle": "{username} streamt jetzt!",
  "pollIntervalSeconds": 60,
  "updateIntervalMinutes": 5,
  "enabled": true
}
```

> `apiKey` wird **nicht** in `config.json` gespeichert — kommt immer aus der Env Var.

### `/data/users.json`

Enthält die Discord User → Twitch Username Mappings (via `/setup` erstellt).

```json
[
  {
    "discordUserId": "555666777",
    "discordUsername": "MaxMustermann",
    "twitchUsername": "stupssy",
    "addedAt": "2025-04-10T12:00:00.000Z"
  }
]
```

---

## IDs in Discord finden

**Entwicklermodus aktivieren:**
Discord → Einstellungen (Zahnrad) → Erweitert → Entwicklermodus → **AN**

Dann:
- **Server ID:** Rechtsklick auf Server-Icon → ID kopieren
- **Channel ID:** Rechtsklick auf Channel-Name → ID kopieren
- **Role ID:** Servereinstellungen → Rollen → Rechtsklick auf Rolle → ID kopieren
- **User ID:** Rechtsklick auf Nutzer → ID kopieren

---

## WebUI Felder erklärt

### Discord Tab

| Feld | Beschreibung |
|---|---|
| Bot Token | Aus dem Discord Developer Portal (Schritt 1) |
| Server (Guild) ID | Rechtsklick auf Server → ID kopieren |
| Channel ID | Rechtsklick auf Channel → ID kopieren |
| Ping Rollen-ID | Rolle die bei Go-Live gepingt wird (leer = kein Ping) |
| Streamer Rollen-ID | Rolle die via `/setup twitch` zugewiesen wird |

### Twitch Tab

| Feld | Beschreibung |
|---|---|
| Client ID | Aus der Twitch Developer Console (Schritt 2) |
| Client Secret | Aus der Twitch Developer Console (nur einmal sichtbar!) |

### Notification Tab

| Feld | Beschreibung |
|---|---|
| Nachricht | Text über dem Embed. Variablen: `{username}` `{title}` `{game}` `{viewers}` |
| Embed Titel | Titel des Discord-Embeds. Variablen: `{username}` `{title}` `{game}` `{viewers}` |
| Embed Farbe | Hex-Farbe des Embed-Streifens (Default: `#9146FF` = Twitch Lila) |

### Bot Tab

| Feld | Beschreibung |
|---|---|
| Poll Interval | Wie oft Twitch gecheckt wird (Sekunden, min. 30 empfohlen) |
| Update Interval | Wie oft das Embed aktualisiert wird (Minuten) |
| Bot aktiviert | An/Aus Toggle |

---

## Troubleshooting

### Bot startet nicht / Spin-Down

- **Problem:** Render Free Tier schläft nach ~15 Min ohne Traffic ein
- **Lösung:** Cronjob bei cron-job.org einrichten (Schritt 6)
- **Test:** `https://dein-bot.onrender.com/health` im Browser aufrufen → muss `{"ok":true}` zurückgeben

### Notifications werden nicht gesendet

- **Checkliste:**
  1. Bot Token korrekt? → WebUI → Discord Tab → Speichern
  2. Channel ID korrekt? → Rechtsklick auf Channel → ID kopieren
  3. Bot hat Permission im Channel? → `Send Messages` + `Embed Links`
  4. Bot ist online? → Discord → Onlinestatus prüfen
  5. Twitch Credentials korrekt? → WebUI → Twitch Tab → Client ID + Secret prüfen
  6. Mindestens ein Nutzer via `/setup twitch <username>` konfiguriert?

### `/setup` Befehl erscheint nicht

- **Lösung:** Bis zu 5 Minuten warten (Discord cachte Slash Commands)
- **Erzwingen:** Server verlassen → Bot neu einladen (OAuth2 URL aus Schritt 1)

### Config geht nach Redeploy verloren

- **Ursache:** Persistent Disk nicht gemountet oder `DATA_DIR` falsch
- **Lösung:** Render Dashboard → Bot Service → Disks → Prüfen ob `/data` gemountet ist
- **Env Var `DATA_DIR`** muss auf `/data` stehen

### Twitch API Fehler

- **401 Unauthorized:** Client ID oder Secret falsch → Twitch Developer Console prüfen
- **404 Not Found:** Twitch Username existiert nicht → Groß-/Kleinschreibung prüfen
- **429 Too Many Requests:** Poll Interval zu niedrig → Mindestens 30 Sekunden empfehlen

---

## Architektur

```
┌─────────────┐     POST /api/config      ┌──────────────────┐
│   WebUI     │ ─────────────────────────→ │  Bot (Elysia)    │
│  (React)    │ ←───────────────────────── │  Port 3001       │
└─────────────┘    GET  /api/status       │                  │
                                        │  /health          │
┌─────────────┐     Every 5 min          │  /api/*           │
│ cron-job.org│ ────────────────────────→│                  │
└─────────────┘    /health               │                  │
                                        │  /data/config.json│
┌─────────────┐     Discord REST API    │  /data/users.json │
│   Discord   │ ←───────────────────────┤                  │
└─────────────┘                         └──────────────────┘
                                               ↓
┌─────────────┐     Twitch Helix API    ┌──────────────────┐
│    Twitch   │ ←──────────────────────→│  Persistent Disk │
└─────────────┘   OAuth2 Token Refresh  │  Render Volume   │
                                        └──────────────────┘
```

---

## Sicherheitshinweise

- **API_KEY:** Wie ein Passwort behandeln. Nicht im Code committen.
- **DISCORD_BOT_TOKEN:** Niemals öffentlich teilen. Bot Token zurücksetzen wenn kompromittiert.
- **TWITCH_CLIENT_SECRET:** Wird nur einmal angezeigt. Sicher speichern.
- **`.env` Dateien:** Werden via `.gitignore` nicht committen. Nur `.env.example` mit leeren Platzhaltern.

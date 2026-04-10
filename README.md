# stream-notify

Custom Streamcord-Alternative: Twitch Live → Discord Notifications via Discord Slash Commands & WebUI.

## Features

- **Multi-User Support** — Beliebige Streamer über Discord `/setup` Befehl hinzufügen
- **Persistent Storage** — Daten überleben Redeploys via Render Persistent Disk
- **WebUI** — Zentrale Konfiguration für Discord & Twitch API
- **Auto-Updating Embeds** — Viewer-Count & Titel aktualisieren sich live

## Struktur

```
stream-notify/
├── bot/   # Bun-Bot + REST API (→ Render Web Service)
└── web/   # React WebUI         (→ Render Static Site)
```

---

## Render Setup

### 1. Persistent Disk erstellen
| Feld | Wert |
|---|---|
| Name | z.B. `stream-notify-data` |
| Mount Path | `/data` |
| Größe | 1 GB (Free Tier) |

> **Wichtig:** Das Disk speichert `config.json` und `users.json`. Ohne Persistent Disk gehen alle Einstellungen nach einem Redeploy verloren.

### 2. Bot (Web Service)
| Feld | Wert |
|---|---|
| Root Directory | `bot` |
| Build Command | `bun install` |
| Start Command | `bun run src/index.ts` |
| Health Check Path | `/health` |

**Environment Variables (Bot):**
| Key | Required | Zweck |
|---|---|---|
| `API_KEY` | **Ja** | Authentifizierung zwischen WebUI und Bot |
| `DATA_DIR` | **Ja** | `/data` — Pfad zum Persistent Disk |
| `PUBLIC_URL` | Empfohlen | `https://dein-bot.onrender.com` — verhindert Spin-Down |
| `DISCORD_BOT_TOKEN` | Nein | Discord Bot Token (kann auch über WebUI gesetzt werden) |
| `TWITCH_CLIENT_ID` | Nein | Twitch API Client ID (kann auch über WebUI gesetzt werden) |
| `TWITCH_CLIENT_SECRET` | Nein | Twitch API Secret (kann auch über WebUI gesetzt werden) |
| `DISCORD_GUILD_ID` | Nein | Discord Server ID (kann auch über WebUI gesetzt werden) |
| `DISCORD_CHANNEL_ID` | Nein | Discord Channel ID für Notifications (kann auch über WebUI gesetzt werden) |
| `DISCORD_NOTIFY_ROLE_ID` | Nein | Rolle die bei Go-Live gepingt wird (kann auch über WebUI gesetzt werden) |
| `DISCORD_STREAMER_ROLE_ID` | Nein | Rolle die Nutzern via `/setup` zugewiesen wird (kann auch über WebUI gesetzt werden) |

> **Hinweis:** Nur `API_KEY` und `DATA_DIR` sind zwingend erforderlich.
> Environment Variables haben **immer Vorrang** vor den Dateien auf dem Persistent Disk.

### 3. WebUI (Static Site)
| Feld | Wert |
|---|---|
| Root Directory | `web` |
| Build Command | `npm install && npm run build` |
| Publish Directory | `dist` |

**Environment Variables:**
| Key | Wert |
|---|---|
| `VITE_BOT_URL` | `https://dein-bot.onrender.com` (URL des Bot Service) |

---

## Erster Start

1. **Persistent Disk** erstellen → Mount Path `/data` notieren
2. Bot deployen → Render Dashboard → **Environment** → `API_KEY` + `DATA_DIR=/data` + `PUBLIC_URL` setzen → Redeploy
3. WebUI öffnen (`https://dein-web.onrender.com`)
4. Bot URL + API Key eingeben → Connect
5. Discord & Twitch konfigurieren → Speichern → Bot starten

> **Tipp:** Der API Key und die Bot URL werden nach dem ersten Connect im Browser gespeichert.

---

## Discord Slash Commands

Nachdem der Bot auf dem Server ist, stehen folgende Befehle zur Verfügung:

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

## Discord Bot erstellen

1. https://discord.com/developers/applications → **New Application**
2. Linkes Menü → **Bot** → Token kopieren
3. Linkes Menü → **OAuth2 → URL Generator**
   - Scopes: `bot`
   - Permissions: `Send Messages`, `Embed Links`, `Mention Everyone`, `Manage Roles`
4. Generierten Link öffnen → Bot in Server einladen

---

## Twitch App erstellen

1. https://dev.twitch.tv/console → **Register Your Application**
2. Name: beliebig (z.B. `stream-notify`)
3. OAuth Redirect URL: `http://localhost`
4. Kategorie: `Chat Bot`
5. Client-Typ: `Vertraulich`
6. → Erstellen → **Client ID** kopieren
7. → **Neues Geheimnis** → **Client Secret** kopieren (nur einmal sichtbar!)

---

## WebUI Felder erklärt

### Discord Tab
| Feld | Beschreibung |
|---|---|
| Bot Token | Aus dem Discord Developer Portal |
| Server (Guild) ID | Rechtsklick auf Server → ID kopieren |
| Channel ID | Rechtsklick auf Channel → ID kopieren |
| Ping Rollen-ID | Rolle die bei Go-Live gepingt wird (leer = kein Ping) |
| Streamer Rollen-ID | Rolle die via `/setup twitch` zugewiesen wird |

### Notification Tab
| Feld | Beschreibung |
|---|---|
| Nachricht | Text über dem Embed. Variablen: `{username}` `{title}` `{game}` `{viewers}` |
| Embed Titel | Titel des Discord-Embeds |
| Embed Farbe | Farbe des Embed-Streifens |

### Bot Tab
| Feld | Beschreibung |
|---|---|
| Poll Interval | Wie oft Twitch gecheckt wird (Sekunden, min. 30 empfohlen) |
| Update Interval | Wie oft das Embed aktualisiert wird (Minuten) |
| Bot aktiviert | An/Aus Toggle |

---

## IDs in Discord finden

Discord Entwicklermodus aktivieren: **Einstellungen → Erweitert → Entwicklermodus → AN**

Dann Rechtsklick auf Server / Channel / Rolle → **ID kopieren**

---

## Persistent Storage

| Datei | Speicherort | Inhalt |
|---|---|---|
| `config.json` | `$DATA_DIR/config.json` | Discord/Twitch Settings aus der WebUI |
| `users.json` | `$DATA_DIR/users.json` | Discord User ID → Twitch Username Mappings |

Beide Dateien liegen auf dem gemounteten Persistent Disk und überleben Redeploys & Spin-Downs.

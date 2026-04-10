# stream-notify

Custom Streamcord-Alternative: Twitch Live → Discord Notification mit WebUI.

## Struktur

```
stream-notify/
├── bot/   # Bun-Bot + REST API (→ Render Web Service)
└── web/   # React WebUI         (→ Render Static Site)
```

---

## Render Setup

### 1. Bot (Web Service)
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
| `PUBLIC_URL` | Empfohlen | `https://dein-bot.onrender.com` — verhindert Spin-Down |
| `DISCORD_BOT_TOKEN` | Nein | Discord Bot Token (kann auch über WebUI gesetzt werden) |
| `TWITCH_CLIENT_ID` | Nein | Twitch API Client ID (kann auch über WebUI gesetzt werden) |
| `TWITCH_CLIENT_SECRET` | Nein | Twitch API Secret (kann auch über WebUI gesetzt werden) |
| `TWITCH_USERNAME` | Nein | Twitch-Kanalname (kann auch über WebUI gesetzt werden) |
| `DISCORD_GUILD_ID` | Nein | Discord Server ID (kann auch über WebUI gesetzt werden) |
| `DISCORD_CHANNEL_ID` | Nein | Discord Channel ID (kann auch über WebUI gesetzt werden) |
| `DISCORD_NOTIFY_ROLE_ID` | Nein | Rolle die bei Go-Live gepingt wird (kann auch über WebUI gesetzt werden) |
| `DISCORD_STREAMER_ROLE_ID` | Nein | Streamer-Rolle als Filter (kann auch über WebUI gesetzt werden) |

> **Hinweis:** Nur `API_KEY` ist zwingend erforderlich. Alle Discord/Twitch Settings können
> alternativ über die WebUI konfiguriert und gespeichert werden.
> Environment Variables haben **immer Vorrang** vor `config.json` und überleben Redeploys.

### 2. WebUI (Static Site)
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

1. Bot deployen → Render Dashboard → **Environment** → `API_KEY` + `PUBLIC_URL` setzen → Redeploy
2. WebUI öffnen (`https://dein-web.onrender.com`)
3. Bot URL + API Key eingeben → Connect (wird im Browser gespeichert)
4. Twitch & Discord konfigurieren → Speichern → Bot starten

> **Tipp:** Der API Key und die Bot URL werden nach dem ersten Connect im Browser gespeichert.  
> Bei späteren Besuchen musst du sie nicht erneut eingeben.

---

## Discord Bot erstellen

1. https://discord.com/developers/applications → **New Application**
2. Linkes Menü → **Bot** → Token kopieren
3. Linkes Menü → **OAuth2 → URL Generator**
   - Scopes: `bot`
   - Permissions: `Send Messages`, `Embed Links`, `Mention Everyone` (für Rollen-Ping)
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

### Twitch Tab
| Feld | Beschreibung |
|---|---|
| Twitch Username | Dein Twitch-Kanalname (z.B. `stupssy`) |
| Client ID | Von dev.twitch.tv |
| Client Secret | Von dev.twitch.tv (einmalig sichtbar!) |

### Discord Tab
| Feld | Beschreibung |
|---|---|
| Bot Token | Aus dem Discord Developer Portal |
| Server (Guild) ID | Rechtsklick auf Server → ID kopieren |
| Channel ID | Rechtsklick auf Channel → ID kopieren |
| Ping Rollen-ID | Rolle die bei Go-Live gepingt wird (leer = kein Ping) |
| Streamer Rollen-ID | Filter: nur notifizieren wenn Streamer diese Rolle hat (leer = immer) |

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
| Bot aktiviert | An/Aus Toggle |

---

## IDs in Discord finden

Discord Entwicklermodus aktivieren: **Einstellungen → Erweitert → Entwicklermodus → AN**

Dann Rechtsklick auf Server / Channel / Rolle → **ID kopieren**

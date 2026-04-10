# stream-notify

Custom Streamcord-Alternative: Twitch Live → Discord Notifications via Discord Slash Commands & WebUI.

## Features

- **Multi-User Support** — Beliebige Streamer über Discord `/setup` Befehl hinzufügen
- **PostgreSQL Storage** — Daten überleben Redeploys via Render Free PostgreSQL Database
- **WebUI** — Zentrale Konfiguration für Discord & Twitch API
- **Auto-Updating Embeds** — Viewer-Count & Titel aktualisieren sich live

## Struktur

```
stream-notify/
├── bot/   # Bun-Bot + REST API (→ Render Web Service)
└── web/   # React WebUI         (→ Render Static Site)
```

---

## Quick Start

### 1. Keepalive einrichten (cron-job.org)

> Render Free Tier lässt den Bot nach ~15 Min ohne Traffic einschlafen. Ein kostenloser Cronjob hält ihn wach.

1. https://cron-job.org → Kostenlos registrieren
2. **Create Cronjob** → URL: `https://dein-bot.onrender.com/health`
3. **Schedule:** Every 5 minutes (`*/5 * * * *`)
4. Fertig — der Bot bleibt jetzt dauerhaft aktiv

### 2. Deployen

→ Siehe **[SETUP.md](SETUP.md)** für die vollständige Anleitung (Discord Bot, Twitch App, Render, PostgreSQL, WebUI).

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

> **Ablauf:** Jeder Nutzer führt `/setup twitch ihrname` aus. Der Bot speichert die Zuordnung persistent in der PostgreSQL-Datenbank und weist automatisch die `DISCORD_STREAMER_ROLE_ID` zu. Ab dann wird der Kanal auf Live-Status überwacht.

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

| Daten | Speicherort | Inhalt |
|---|---|---|
| `app_config` Tabelle | Render PostgreSQL (Free, 1 GB) | Discord/Twitch Einstellungen aus der WebUI |
| `users` Tabelle | Render PostgreSQL (Free, 1 GB) | Discord User ID → Twitch Username Mappings |

Beide Tabellen liegen in der Render PostgreSQL-Datenbank und überleben Redeploys & Spin-Downs.

# stream-notify

Custom Streamcord-Alternative: Twitch Live → Discord Notification.

## Struktur

```
stream-notify/
├── bot/   # Bun-Bot + REST API (→ Render Web Service)
└── web/   # React WebUI         (→ Render Static Site)
```

## Render Setup

### 1. Bot (Web Service)
- **Root Directory:** `bot`
- **Build Command:** `bun install`
- **Start Command:** `bun run src/index.ts`
- **Environment:** keine nötig (Port wird auto-gesetzt)

### 2. WebUI (Static Site)
- **Root Directory:** `web`
- **Build Command:** `npm install && npm run build`
- **Publish Directory:** `dist`
- **Environment Variable:** `VITE_BOT_URL=https://dein-bot.onrender.com`

## Erster Start

1. Bot deployen → Logs öffnen → **API Key** kopieren (steht beim Start in der Konsole)
2. WebUI öffnen → Bot URL + API Key eingeben
3. Twitch & Discord konfigurieren → Speichern

## Discord Bot erstellen

1. https://discord.com/developers/applications → New Application
2. Bot → Token kopieren
3. OAuth2 → URL Generator → `bot` scope → Permissions: `Send Messages`, `Embed Links`
4. Bot in Server einladen

## Twitch App erstellen

1. https://dev.twitch.tv/console → Register Your Application
2. OAuth Redirect: `http://localhost`
3. Client ID + Secret kopieren

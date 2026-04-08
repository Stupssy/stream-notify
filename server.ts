import { Elysia, t } from "elysia";
import { getConfig, saveConfig } from "./config";
import { status, startBot, stopBot, restartBot } from "./bot";
import { validateBotToken } from "./discord";
import { getStreamStatus, getUserInfo } from "./twitch";

function authCheck(apiKey: string | undefined): boolean {
  return apiKey === getConfig().apiKey;
}

export function createServer() {
  const app = new Elysia()

    // CORS for WebUI
    .onBeforeHandle(({ set }) => {
      set.headers["Access-Control-Allow-Origin"] = "*";
      set.headers["Access-Control-Allow-Headers"] = "Content-Type, X-API-Key";
      set.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, OPTIONS";
    })

    .options("/*", () => new Response(null, { status: 204 }))

    // Health check (no auth)
    .get("/health", () => ({ ok: true, ts: Date.now() }))

    // Status (no auth - safe to expose)
    .get("/api/status", () => ({
      ...status,
      uptime: Math.floor((Date.now() - (status.uptime || 0)) / 1000),
      version: "1.0.0",
    }))

    // Config GET (requires auth)
    .get("/api/config", ({ headers }) => {
      if (!authCheck(headers["x-api-key"])) return new Response("Unauthorized", { status: 401 });
      const config = { ...getConfig() };
      // Mask secrets partially
      if (config.discordBotToken) config.discordBotToken = config.discordBotToken.slice(0, 10) + "...";
      if (config.twitchClientSecret) config.twitchClientSecret = "***";
      return config;
    })

    // Config UPDATE (requires auth)
    .post("/api/config", ({ headers, body }) => {
      if (!authCheck(headers["x-api-key"])) return new Response("Unauthorized", { status: 401 });
      const updated = saveConfig(body as any);
      restartBot();
      return { ok: true, message: "Config saved & bot restarted" };
    })

    // Bot control
    .post("/api/bot/start", ({ headers }) => {
      if (!authCheck(headers["x-api-key"])) return new Response("Unauthorized", { status: 401 });
      startBot();
      return { ok: true };
    })
    .post("/api/bot/stop", ({ headers }) => {
      if (!authCheck(headers["x-api-key"])) return new Response("Unauthorized", { status: 401 });
      stopBot();
      return { ok: true };
    })
    .post("/api/bot/restart", ({ headers }) => {
      if (!authCheck(headers["x-api-key"])) return new Response("Unauthorized", { status: 401 });
      restartBot();
      return { ok: true };
    })

    // Validate Discord token
    .get("/api/validate/discord", async ({ headers }) => {
      if (!authCheck(headers["x-api-key"])) return new Response("Unauthorized", { status: 401 });
      const valid = await validateBotToken();
      return { valid };
    })

    // Test Twitch stream status
    .get("/api/validate/twitch", async ({ headers }) => {
      if (!authCheck(headers["x-api-key"])) return new Response("Unauthorized", { status: 401 });
      const { twitchUsername } = getConfig();
      if (!twitchUsername) return { valid: false, error: "No username configured" };
      try {
        const stream = await getStreamStatus(twitchUsername);
        const user = await getUserInfo(twitchUsername);
        return { valid: true, isLive: stream.isLive, user };
      } catch (e: any) {
        return { valid: false, error: e.message };
      }
    });

  return app;
}

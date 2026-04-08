import { Elysia } from "elysia";
import { getConfig, saveConfig } from "./config";
import { status, startBot, stopBot, restartBot } from "./bot";
import { validateBotToken } from "./discord";
import { getStreamStatus, getUserInfo } from "./twitch";

function authCheck(apiKey: string | undefined): boolean {
  return apiKey === getConfig().apiKey;
}

// Fields that are safe to export (secrets masked for display, but full value for import)
const SECRET_FIELDS = ["discordBotToken", "twitchClientSecret"];

export function createServer() {
  const app = new Elysia()

    .onBeforeHandle(({ set }) => {
      set.headers["Access-Control-Allow-Origin"] = "*";
      set.headers["Access-Control-Allow-Headers"] = "Content-Type, X-API-Key";
      set.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, OPTIONS";
    })

    .options("/*", () => new Response(null, { status: 204 }))

    .get("/health", () => ({ ok: true, ts: Date.now() }))

    .get("/api/status", () => ({
      ...status,
      uptime: Math.floor((Date.now() - (status.uptime || 0)) / 1000),
      version: "1.0.0",
    }))

    // Config GET (secrets partially masked for display)
    .get("/api/config", ({ headers }) => {
      if (!authCheck(headers["x-api-key"])) return new Response("Unauthorized", { status: 401 });
      const config = { ...getConfig() };
      if (config.discordBotToken) config.discordBotToken = config.discordBotToken.slice(0, 10) + "...";
      if (config.twitchClientSecret) config.twitchClientSecret = "***";
      return config;
    })

    // Config EXPORT — full values, for backup/import (still auth protected)
    .get("/api/config/export", ({ headers }) => {
      if (!authCheck(headers["x-api-key"])) return new Response("Unauthorized", { status: 401 });
      const config = { ...getConfig() };
      // Remove apiKey from export — shouldn't be portable
      delete (config as any).apiKey;
      return new Response(JSON.stringify(config, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="stream-notify-config.json"`,
        },
      });
    })

    // Config IMPORT — accepts full config JSON
    .post("/api/config/import", ({ headers, body }) => {
      if (!authCheck(headers["x-api-key"])) return new Response("Unauthorized", { status: 401 });
      try {
        const imported = body as any;
        // Never import apiKey
        delete imported.apiKey;
        saveConfig(imported);
        restartBot();
        return { ok: true, message: "Config importiert & Bot neugestartet" };
      } catch (e: any) {
        return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 400 });
      }
    })

    .post("/api/config", ({ headers, body }) => {
      if (!authCheck(headers["x-api-key"])) return new Response("Unauthorized", { status: 401 });
      saveConfig(body as any);
      restartBot();
      return { ok: true, message: "Config saved & bot restarted" };
    })

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

    .get("/api/validate/discord", async ({ headers }) => {
      if (!authCheck(headers["x-api-key"])) return new Response("Unauthorized", { status: 401 });
      const valid = await validateBotToken();
      return { valid };
    })

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

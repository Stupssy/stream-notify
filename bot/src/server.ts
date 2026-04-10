import { Elysia } from "elysia";
import { getConfig, saveConfig } from "./config";
import { status, startBot, stopBot, restartBot, coldRestartBot } from "./bot";
import { validateBotToken } from "./discord";
import { restartGateway } from "./gateway";
import { getStreamStatus, getUserInfo } from "./twitch";

function authCheck(apiKey: string | undefined): boolean {
  return apiKey === getConfig().apiKey;
}

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
      // Compute uptime on the fly from startTime — no stale stored value
      uptime: status.startTime > 0 ? Math.floor((Date.now() - status.startTime) / 1000) : 0,
      version: "1.0.0",
    }))

    // Config GET — secrets masked for display only
    .get("/api/config", ({ headers }) => {
      if (!authCheck(headers["x-api-key"])) return new Response("Unauthorized", { status: 401 });
      const config = { ...getConfig() } as any;
      config.discordBotToken = config.discordBotToken ? "__masked__" : "";
      config.twitchClientSecret = config.twitchClientSecret ? "__masked__" : "";
      return config;
    })

    // Config UPDATE — skips masked fields, preserves wasLive across restart
    .post("/api/config", ({ headers, body }) => {
      if (!authCheck(headers["x-api-key"])) return new Response("Unauthorized", { status: 401 });
      const incoming = body as Record<string, any>;
      if (incoming.discordBotToken === "__masked__") delete incoming.discordBotToken;
      if (incoming.twitchClientSecret === "__masked__") delete incoming.twitchClientSecret;
      saveConfig(incoming);
      restartBot();       // preserves wasLive — no duplicate notification
      restartGateway();
      return { ok: true, message: "Config saved & bot restarted" };
    })

    // Config EXPORT — full unmasked values
    .get("/api/config/export", ({ headers }) => {
      if (!authCheck(headers["x-api-key"])) return new Response("Unauthorized", { status: 401 });
      const config = { ...getConfig() } as any;
      delete config.apiKey;
      return new Response(JSON.stringify(config, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="stream-notify-config.json"`,
        },
      });
    })

    // Config IMPORT
    .post("/api/config/import", ({ headers, body }) => {
      if (!authCheck(headers["x-api-key"])) return new Response("Unauthorized", { status: 401 });
      try {
        const imported = body as any;
        delete imported.apiKey;
        saveConfig(imported);
        restartBot();
        restartGateway();
        return { ok: true, message: "Config importiert & Bot neugestartet" };
      } catch (e: any) {
        return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 400 });
      }
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
    // Cold restart: resets all state, will re-detect stream and send notification even if already live
    .post("/api/bot/cold-restart", ({ headers }) => {
      if (!authCheck(headers["x-api-key"])) return new Response("Unauthorized", { status: 401 });
      coldRestartBot();
      return { ok: true, message: "Cold restart — stream will be re-detected from scratch" };
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

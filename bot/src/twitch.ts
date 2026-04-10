import { getConfig } from "./config";

let accessToken: string | null = null;
let tokenExpiry = 0;

async function fetchNewToken(): Promise<string> {
  const { twitchClientId, twitchClientSecret } = getConfig();
  if (!twitchClientId || !twitchClientSecret) {
    throw new Error("Twitch Client ID / Secret not configured");
  }

  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${twitchClientId}&client_secret=${twitchClientSecret}&grant_type=client_credentials`,
    { method: "POST" }
  );

  const data = await res.json();

  if (!res.ok || !data.access_token) {
    // e.g. { status: 400, message: "invalid client" }
    throw new Error(
      `Twitch OAuth failed (${res.status}): ${data.message ?? JSON.stringify(data)}`
    );
  }

  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  console.log(`[twitch] New access token fetched, expires in ${data.expires_in}s`);
  return accessToken!;
}

async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;
  return fetchNewToken();
}

function invalidateToken() {
  accessToken = null;
  tokenExpiry = 0;
}

export interface StreamInfo {
  isLive: boolean;
  title?: string;
  gameName?: string;
  viewerCount?: number;
  thumbnailUrl?: string;
  startedAt?: string;
}

export async function getStreamStatus(username: string): Promise<StreamInfo> {
  const { twitchClientId } = getConfig();
  const token = await getAccessToken();

  const res = await fetch(
    `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(username)}`,
    {
      headers: {
        "Client-Id": twitchClientId,
        Authorization: `Bearer ${token}`,
      },
    }
  );

  // 401 = token expired/invalid → invalidate and retry once with a fresh token
  if (res.status === 401) {
    console.warn("[twitch] 401 on streams — invalidating token and retrying");
    invalidateToken();
    const freshToken = await fetchNewToken();
    const retry = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(username)}`,
      {
        headers: {
          "Client-Id": twitchClientId,
          Authorization: `Bearer ${freshToken}`,
        },
      }
    );
    if (!retry.ok) {
      const body = await retry.text().catch(() => retry.status.toString());
      throw new Error(`Twitch streams API error after retry (${retry.status}): ${body}`);
    }
    const retryData = await retry.json();
    return parseStream(retryData);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => res.status.toString());
    throw new Error(`Twitch streams API error (${res.status}): ${body}`);
  }

  const data = await res.json();
  return parseStream(data);
}

function parseStream(data: any): StreamInfo {
  const stream = data.data?.[0];
  if (!stream) return { isLive: false };

  return {
    isLive: true,
    title: stream.title,
    gameName: stream.game_name,
    viewerCount: stream.viewer_count,
    thumbnailUrl: stream.thumbnail_url
      ?.replace("{width}", "1280")
      .replace("{height}", "720"),
    startedAt: stream.started_at,
  };
}

export async function getUserInfo(username: string) {
  const { twitchClientId } = getConfig();
  const token = await getAccessToken();

  const res = await fetch(
    `https://api.twitch.tv/helix/users?login=${encodeURIComponent(username)}`,
    {
      headers: {
        "Client-Id": twitchClientId,
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (res.status === 401) {
    invalidateToken();
    const freshToken = await fetchNewToken();
    const retry = await fetch(
      `https://api.twitch.tv/helix/users?login=${encodeURIComponent(username)}`,
      {
        headers: {
          "Client-Id": twitchClientId,
          Authorization: `Bearer ${freshToken}`,
        },
      }
    );
    if (!retry.ok) return null;
    const d = await retry.json();
    return d.data?.[0] ?? null;
  }

  if (!res.ok) return null;
  const data = await res.json();
  return data.data?.[0] ?? null;
}
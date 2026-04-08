import { getConfig } from "./config";

let accessToken: string | null = null;
let tokenExpiry = 0;

async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;

  const { twitchClientId, twitchClientSecret } = getConfig();
  if (!twitchClientId || !twitchClientSecret) throw new Error("Twitch credentials not configured");

  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${twitchClientId}&client_secret=${twitchClientSecret}&grant_type=client_credentials`,
    { method: "POST" }
  );
  const data = await res.json();
  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return accessToken!;
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
  const token = await getAccessToken();
  const { twitchClientId } = getConfig();

  const res = await fetch(
    `https://api.twitch.tv/helix/streams?user_login=${username}`,
    {
      headers: {
        "Client-Id": twitchClientId,
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await res.json();
  const stream = data.data?.[0];

  if (!stream) return { isLive: false };

  return {
    isLive: true,
    title: stream.title,
    gameName: stream.game_name,
    viewerCount: stream.viewer_count,
    thumbnailUrl: stream.thumbnail_url?.replace("{width}", "1280").replace("{height}", "720"),
    startedAt: stream.started_at,
  };
}

export async function getUserInfo(username: string) {
  const token = await getAccessToken();
  const { twitchClientId } = getConfig();

  const res = await fetch(
    `https://api.twitch.tv/helix/users?login=${username}`,
    {
      headers: {
        "Client-Id": twitchClientId,
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await res.json();
  return data.data?.[0] ?? null;
}

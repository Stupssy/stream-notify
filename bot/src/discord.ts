import { getConfig } from "./config";
import type { StreamInfo } from "./twitch";

const BASE = "https://discord.com/api/v10";
const DISCORD_TIMEOUT_MS = 10_000; // 10 seconds

function headers() {
  return {
    Authorization: `Bot ${getConfig().discordBotToken}`,
    "Content-Type": "application/json",
  };
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DISCORD_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function hasMemberRole(userId: string): Promise<boolean> {
  const { discordGuildId, discordStreamerRoleId } = getConfig();
  if (!discordStreamerRoleId) return true;
  
  try {
    const res = await fetchWithTimeout(`${BASE}/guilds/${discordGuildId}/members/${userId}`, {
      headers: headers(),
    });
    if (!res.ok) return false;
    const member = await res.json();
    return member.roles?.includes(discordStreamerRoleId) ?? false;
  } catch (error) {
    console.error(`[discord] hasMemberRole error for ${userId}:`, error.message);
    return false;
  }
}

export async function getMemberByTwitchUsername(twitchUsername: string): Promise<string | null> {
  const { discordGuildId } = getConfig();
  
  try {
    const res = await fetchWithTimeout(
      `${BASE}/guilds/${discordGuildId}/members/search?query=${twitchUsername}&limit=5`,
      { headers: headers() }
    );
    if (!res.ok) return null;
    const members = await res.json();
    return members?.[0]?.user?.id ?? null;
  } catch (error) {
    console.error(`[discord] getMemberByTwitchUsername error for ${twitchUsername}:`, error.message);
    return null;
  }
}

/**
 * Embed layout (von oben nach unten):
 *
 * [content]    →  nur <@&RollenID> Ping (kein Text)
 *
 * author       →  Avatar + "stupssy" + Link
 * title        →  konfigurierbarer embedTitle
 * description  →  konfigurierbarer notifyMessage-Text
 * fields       →  Spiel | Zuschauer, dann Titel (volle Breite)
 * image        →  Stream-Thumbnail (groß)
 * footer       →  "stream-notify" + Timestamp
 */
function buildEmbed(
  stream: StreamInfo,
  twitchUsername: string,
  twitchAvatarUrl: string | undefined,
  config: ReturnType<typeof getConfig>
) {
  const { notifyMessage, embedColor, embedTitle, discordNotifyRoleId } = config;

  const fill = (s: string) =>
    s
      .replace(/\{username\}/g, twitchUsername)
      .replace(/\{title\}/g, stream.title ?? "")
      .replace(/\{game\}/g, stream.gameName ?? "")
      .replace(/\{viewers\}/g, String(stream.viewerCount ?? 0));

  const color = parseInt(embedColor.replace("#", ""), 16);
  const streamUrl = `https://twitch.tv/${twitchUsername}`;

  const image = stream.thumbnailUrl
    ? { url: `${stream.thumbnailUrl}?t=${Date.now()}` }
    : undefined;

  const fields = [
    { name: "Kategorie", value: stream.gameName || "Unbekannt", inline: true },
    { name: "Viewer", value: String(stream.viewerCount ?? 0), inline: true },
    ...(stream.title ? [{ name: "Title", value: stream.title, inline: false }] : []),
  ];

  const payload: Record<string, unknown> = {
    allowed_mentions: discordNotifyRoleId
      ? { roles: [discordNotifyRoleId] }
      : { parse: [] },
    embeds: [
      {
        author: {
          name: twitchUsername,
          url: streamUrl,
          icon_url: twitchAvatarUrl ?? null,
        },
        title: fill(embedTitle),
        url: streamUrl,
        color,
        description: fill(notifyMessage),
        fields,
        image,
        footer: {
          text: "stream-notify",
          icon_url: "https://static.twitchscdn.net/assets/favicon-32-e29e246c157142c1.png",
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  if (discordNotifyRoleId) payload.content = `<@&${discordNotifyRoleId}>`;
  return payload;
}

/**
 * Send a new notification. Returns Discord message ID for later edits, or null on failure.
 */
export async function sendNotification(
  stream: StreamInfo,
  twitchUsername: string,
  twitchAvatarUrl?: string
): Promise<string | null> {
  const config = getConfig();
  if (!config.discordChannelId) return null;

  const payload = buildEmbed(stream, twitchUsername, twitchAvatarUrl, config);
  
  try {
    const res = await fetchWithTimeout(`${BASE}/channels/${config.discordChannelId}/messages`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => res.status.toString());
      console.error(`[discord] sendNotification failed (${res.status}): ${err}`);
      return null;
    }

    const msg = await res.json();
    return msg.id ?? null;
  } catch (error) {
    console.error("[discord] sendNotification error:", error.message);
    return null;
  }
}

/**
 * Edit an existing notification with fresh stream data.
 * No re-ping — only the embed is patched.
 */
export async function updateNotification(
  messageId: string,
  stream: StreamInfo,
  twitchUsername: string,
  twitchAvatarUrl?: string
): Promise<boolean> {
  const config = getConfig();
  if (!config.discordChannelId) return false;

  const configNoPing = { ...config, discordNotifyRoleId: "" };
  const payload = buildEmbed(stream, twitchUsername, twitchAvatarUrl, configNoPing);

  try {
    const res = await fetchWithTimeout(
      `${BASE}/channels/${config.discordChannelId}/messages/${messageId}`,
      {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ embeds: payload.embeds }),
      }
    );

    if (!res.ok) {
      const err = await res.text().catch(() => res.status.toString());
      console.error(`[discord] updateNotification failed (${res.status}): ${err}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[discord] updateNotification error:", error.message);
    return false;
  }
}

/**
 * Build an offline embed to notify that a streamer has gone offline.
 */
function buildOfflineEmbed(
  twitchUsername: string,
  twitchAvatarUrl: string | undefined,
  config: ReturnType<typeof getConfig>
) {
  const { offlineMessage, embedColor, offlineEmbedTitle, discordNotifyRoleId } = config;

  const fill = (s: string) =>
    s
      .replace(/\{username\}/g, twitchUsername);

  const color = parseInt(embedColor.replace("#", ""), 16);
  const streamUrl = `https://twitch.tv/${twitchUsername}`;

  const fields = [
    { name: "Status", value: "Offline", inline: true },
  ];

  const payload: Record<string, unknown> = {
    allowed_mentions: discordNotifyRoleId
      ? { roles: [discordNotifyRoleId] }
      : { parse: [] },
    embeds: [
      {
        author: {
          name: twitchUsername,
          url: streamUrl,
          icon_url: twitchAvatarUrl ?? null,
        },
        title: fill(offlineEmbedTitle),
        url: streamUrl,
        color,
        description: fill(offlineMessage),
        fields,
        footer: {
          text: "stream-notify",
          icon_url: "https://static.twitchscdn.net/assets/favicon-32-e29e246c157142c1.png",
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  if (discordNotifyRoleId) payload.content = `<@&${discordNotifyRoleId}>`;
  return payload;
}

/**
 * Send a new offline notification. Returns Discord message ID for later edits, or null on failure.
 */
export async function sendOfflineNotification(
  twitchUsername: string,
  twitchAvatarUrl?: string
): Promise<string | null> {
  const config = getConfig();
  if (!config.discordChannelId) return null;

  const payload = buildOfflineEmbed(twitchUsername, twitchAvatarUrl, config);

  try {
    const res = await fetchWithTimeout(`${BASE}/channels/${config.discordChannelId}/messages`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => res.status.toString());
      console.error(`[discord] sendOfflineNotification failed (${res.status}): ${err}`);
      return null;
    }

    const msg = await res.json();
    return msg.id ?? null;
  } catch (error) {
    console.error("[discord] sendOfflineNotification error:", error.message);
    return null;
  }
}

/**
 * Edit an existing live notification to show offline status.
 * No re-ping — only the embed is patched.
 */
export async function updateToOfflineNotification(
  messageId: string,
  twitchUsername: string,
  twitchAvatarUrl?: string
): Promise<boolean> {
  const config = getConfig();
  if (!config.discordChannelId) return false;

  const configNoPing = { ...config, discordNotifyRoleId: "" };
  const payload = buildOfflineEmbed(twitchUsername, twitchAvatarUrl, configNoPing);

  try {
    const res = await fetchWithTimeout(
      `${BASE}/channels/${config.discordChannelId}/messages/${messageId}`,
      {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ embeds: payload.embeds }),
      }
    );

    if (!res.ok) {
      const err = await res.text().catch(() => res.status.toString());
      console.error(`[discord] updateToOfflineNotification failed (${res.status}): ${err}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[discord] updateToOfflineNotification error:", error.message);
    return false;
  }
}

export async function validateBotToken(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${BASE}/users/@me`, { headers: headers() });
    return res.ok;
  } catch {
    return false;
  }
}
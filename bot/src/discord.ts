import { getConfig } from "./config";
import type { StreamInfo } from "./twitch";

const BASE = "https://discord.com/api/v10";

function headers() {
  return {
    Authorization: `Bot ${getConfig().discordBotToken}`,
    "Content-Type": "application/json",
  };
}

export async function hasMemberRole(userId: string): Promise<boolean> {
  const { discordGuildId, discordStreamerRoleId } = getConfig();
  if (!discordStreamerRoleId) return true;

  const res = await fetch(`${BASE}/guilds/${discordGuildId}/members/${userId}`, {
    headers: headers(),
  });
  if (!res.ok) return false;
  const member = await res.json();
  return member.roles?.includes(discordStreamerRoleId) ?? false;
}

export async function getMemberByTwitchUsername(twitchUsername: string): Promise<string | null> {
  const { discordGuildId } = getConfig();
  const res = await fetch(
    `${BASE}/guilds/${discordGuildId}/members/search?query=${twitchUsername}&limit=5`,
    { headers: headers() }
  );
  if (!res.ok) return null;
  const members = await res.json();
  return members?.[0]?.user?.id ?? null;
}

function buildEmbed(
  stream: StreamInfo,
  twitchUsername: string,
  twitchAvatarUrl: string | undefined,
  config: ReturnType<typeof getConfig>
) {
  const { notifyMessage, embedColor, embedTitle, discordNotifyRoleId } = config;

  const fill = (s: string) =>
    s
      .replace("{username}", twitchUsername)
      .replace("{title}", stream.title ?? "")
      .replace("{game}", stream.gameName ?? "")
      .replace("{viewers}", String(stream.viewerCount ?? 0));

  const color = parseInt(embedColor.replace("#", ""), 16);
  const streamUrl = `https://twitch.tv/${twitchUsername}`;
  const thumbnail = twitchAvatarUrl ? { url: twitchAvatarUrl } : undefined;
  const image = stream.thumbnailUrl
    ? { url: stream.thumbnailUrl + `?t=${Date.now()}` }
    : undefined;

  return {
    content: discordNotifyRoleId
      ? `<@&${discordNotifyRoleId}> ${fill(notifyMessage)}`
      : fill(notifyMessage),
    allowed_mentions: discordNotifyRoleId
      ? { roles: [discordNotifyRoleId] }
      : { parse: [] },
    embeds: [
      {
        author: {
          name: `${twitchUsername} ist jetzt live auf Twitch!`,
          url: streamUrl,
          icon_url: twitchAvatarUrl,
        },
        title: fill(embedTitle),
        url: streamUrl,
        color,
        description: stream.title ? `[${stream.title}](${streamUrl})` : undefined,
        thumbnail,
        fields: [
          { name: "Game", value: stream.gameName ?? "Unbekannt", inline: true },
          { name: "Viewers", value: String(stream.viewerCount ?? 0), inline: true },
        ],
        image,
        footer: {
          text: "stream-notify",
          icon_url: "https://static.twitchscdn.net/assets/favicon-32-e29e246c157142c1.png",
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

/**
 * Send a new notification. Returns the Discord message ID (for later edits) or null on failure.
 */
export async function sendNotification(
  stream: StreamInfo,
  twitchUsername: string,
  twitchAvatarUrl?: string
): Promise<string | null> {
  const config = getConfig();
  if (!config.discordChannelId) return null;

  const payload = buildEmbed(stream, twitchUsername, twitchAvatarUrl, config);

  const res = await fetch(`${BASE}/channels/${config.discordChannelId}/messages`, {
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
}

/**
 * Edit an existing notification with fresh stream data (viewer count, title, game, thumbnail).
 * Keeps the original role-ping content unchanged — only the embed is updated.
 */
export async function updateNotification(
  messageId: string,
  stream: StreamInfo,
  twitchUsername: string,
  twitchAvatarUrl?: string
): Promise<boolean> {
  const config = getConfig();
  if (!config.discordChannelId) return false;

  // Build the same embed but skip re-pinging the role (edit = no new ping)
  const configNoPing = { ...config, discordNotifyRoleId: "" };
  const payload = buildEmbed(stream, twitchUsername, twitchAvatarUrl, configNoPing);

  // On edits we don't re-send the content/ping — only update the embed
  const editPayload = { embeds: payload.embeds };

  const res = await fetch(
    `${BASE}/channels/${config.discordChannelId}/messages/${messageId}`,
    {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify(editPayload),
    }
  );

  if (!res.ok) {
    const err = await res.text().catch(() => res.status.toString());
    console.error(`[discord] updateNotification failed (${res.status}): ${err}`);
    return false;
  }

  return true;
}

export async function validateBotToken(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/users/@me`, { headers: headers() });
    return res.ok;
  } catch {
    return false;
  }
}

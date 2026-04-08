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

export async function sendNotification(
  stream: StreamInfo,
  twitchUsername: string,
  twitchAvatarUrl?: string
): Promise<boolean> {
  const { discordChannelId, notifyMessage, embedColor, embedTitle, discordNotifyRoleId } = getConfig();
  if (!discordChannelId) return false;

  const fill = (s: string) => s
    .replace("{username}", twitchUsername)
    .replace("{title}", stream.title ?? "")
    .replace("{game}", stream.gameName ?? "")
    .replace("{viewers}", String(stream.viewerCount ?? 0));

  const color = parseInt(embedColor.replace("#", ""), 16);
  const rolePing = discordNotifyRoleId ? `<@&${discordNotifyRoleId}>` : "";
  const streamUrl = `https://twitch.tv/${twitchUsername}`;

  // Thumbnail: small image top-right in embed
  const thumbnail = twitchAvatarUrl ? { url: twitchAvatarUrl } : undefined;

  // Large preview image at bottom
  const image = stream.thumbnailUrl
    ? { url: stream.thumbnailUrl + `?t=${Date.now()}` }
    : undefined;

  const payload = {
    content: rolePing ? `${rolePing} ${fill(notifyMessage)}` : fill(notifyMessage),
    allowed_mentions: discordNotifyRoleId
      ? { roles: [discordNotifyRoleId] }
      : { parse: [] },
    embeds: [{
      // Author line: "Username is now live on Twitch!" with avatar
      author: {
        name: `${twitchUsername} ist jetzt live auf Twitch!`,
        url: streamUrl,
        icon_url: twitchAvatarUrl,
      },
      title: fill(embedTitle),
      url: streamUrl,
      color,
      // Stream title as description
      description: stream.title
        ? `[${stream.title}](${streamUrl})`
        : undefined,
      thumbnail,
      fields: [
        {
          name: "Game",
          value: stream.gameName ?? "Unbekannt",
          inline: true,
        },
        {
          name: "Viewers",
          value: String(stream.viewerCount ?? 0),
          inline: true,
        },
      ],
      image,
      footer: {
        text: "stream-notify",
        icon_url: "https://static.twitchscdn.net/assets/favicon-32-e29e246c157142c1.png",
      },
      timestamp: new Date().toISOString(),
    }],
  };

  const res = await fetch(`${BASE}/channels/${discordChannelId}/messages`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
  });

  return res.ok;
}

export async function validateBotToken(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/users/@me`, { headers: headers() });
    return res.ok;
  } catch {
    return false;
  }
}

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
  if (!discordStreamerRoleId) return true; // no role filter = notify everyone

  const res = await fetch(`${BASE}/guilds/${discordGuildId}/members/${userId}`, {
    headers: headers(),
  });
  if (!res.ok) return false;
  const member = await res.json();
  return member.roles?.includes(discordStreamerRoleId) ?? false;
}

export async function getMemberByTwitchUsername(twitchUsername: string): Promise<string | null> {
  // Search guild members for someone whose nickname/username matches
  const { discordGuildId } = getConfig();
  const res = await fetch(
    `${BASE}/guilds/${discordGuildId}/members/search?query=${twitchUsername}&limit=5`,
    { headers: headers() }
  );
  if (!res.ok) return null;
  const members = await res.json();
  return members?.[0]?.user?.id ?? null;
}

export async function sendNotification(stream: StreamInfo, twitchUsername: string): Promise<boolean> {
  const { discordChannelId, notifyMessage, embedColor, embedTitle } = getConfig();
  if (!discordChannelId) return false;

  const fill = (s: string) => s
    .replace("{username}", twitchUsername)
    .replace("{title}", stream.title ?? "")
    .replace("{game}", stream.gameName ?? "")
    .replace("{viewers}", String(stream.viewerCount ?? 0));

  const color = parseInt(embedColor.replace("#", ""), 16);

  const payload = {
    content: fill(notifyMessage),
    embeds: [{
      title: fill(embedTitle),
      url: `https://twitch.tv/${twitchUsername}`,
      color,
      description: stream.title,
      fields: [
        { name: "🎮 Spiel", value: stream.gameName ?? "Unbekannt", inline: true },
        { name: "👥 Zuschauer", value: String(stream.viewerCount ?? 0), inline: true },
      ],
      image: stream.thumbnailUrl ? { url: stream.thumbnailUrl + `?t=${Date.now()}` } : undefined,
      footer: { text: "stream-notify" },
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

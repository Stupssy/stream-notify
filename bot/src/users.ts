import { getPool } from "./db";

export interface UserConfig {
  /** Discord user ID */
  discordUserId: string;
  /** Discord username (for display only) */
  discordUsername: string;
  /** Platform: twitch, kick, youtube */
  platform: string;
  /** Username on the platform */
  username: string;
  /** Timestamp when the user was added */
  addedAt: string;
}

let _users: UserConfig[] = [];
let _initialized = false;

/**
 * Load users from the database into memory.
 * Must be called once at startup.
 */
export async function initUsers(): Promise<UserConfig[]> {
  const pool = getPool();

  try {
    const { rows } = await pool.query(
      "SELECT discord_user_id, discord_username, platform, username, added_at FROM users"
    );
    _users = rows.map((row) => ({
      discordUserId: row.discord_user_id,
      discordUsername: row.discord_username,
      platform: row.platform,
      username: row.username,
      addedAt: row.added_at.toISOString(),
    }));
    console.log(`[users] Loaded ${_users.length} user(s) from database ✓`);
  } catch (e: any) {
    // Table might not exist yet - that's ok, will be created on first add
    if (e.message.includes("relation") || e.message.includes("does not exist")) {
      console.log("[users] Users table not yet created (first run)");
    } else {
      console.error("[users] Failed to load users from DB:", e.message);
    }
    _users = [];
  }

  _initialized = true;
  return _users;
}

export function getAllUsers(platform?: string): UserConfig[] {
  if (!_initialized) return [];
  if (platform) {
    return _users.filter((u) => u.platform === platform.toLowerCase());
  }
  return [..._users];
}

export function getUsersByDiscordId(discordUserId: string): UserConfig[] {
  return _users.filter((u) => u.discordUserId === discordUserId);
}

export function getUsersByDiscordIdAndPlatform(discordUserId: string, platform: string): UserConfig[] {
  return _users.filter(
    (u) => u.discordUserId === discordUserId && u.platform === platform.toLowerCase()
  );
}

export function getUserByPlatform(platform: string, username: string): UserConfig | null {
  const normalizedPlatform = platform.toLowerCase();
  const normalizedUsername = username.toLowerCase();
  return _users.find(
    (u) => u.platform === normalizedPlatform && u.username.toLowerCase() === normalizedUsername
  ) ?? null;
}

/**
 * Add a user for a specific platform.
 * A Discord user can have one username per platform.
 */
export async function addUser(
  discordUserId: string,
  discordUsername: string,
  username: string,
  platform: string
): Promise<UserConfig> {
  const pool = getPool();
  const normalizedPlatform = platform.toLowerCase();
  const normalizedUsername = username.toLowerCase();

  // Remove existing entry for this Discord user + platform combo
  _users = _users.filter(
    (u) => !(u.discordUserId === discordUserId && u.platform === normalizedPlatform)
  );

  const entry: UserConfig = {
    discordUserId,
    discordUsername,
    platform: normalizedPlatform,
    username: normalizedUsername,
    addedAt: new Date().toISOString(),
  };
  _users.push(entry);

  // Persist to DB
  try {
    await pool.query(
      `INSERT INTO users (discord_user_id, discord_username, platform, username, added_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (discord_user_id, platform)
       DO UPDATE SET discord_username = $2, username = $4, added_at = $5`,
      [discordUserId, discordUsername, normalizedPlatform, normalizedUsername, entry.addedAt]
    );
  } catch (e: any) {
    console.warn(`[users] Could not save user to DB: ${e.message}`);
  }

  return entry;
}

/**
 * Remove user(s) by Discord ID. If platform is specified, only removes that platform.
 * Returns true if any entries were removed.
 */
export async function removeUserByDiscordId(discordUserId: string, platform?: string): Promise<boolean> {
  const pool = getPool();
  const before = _users.length;

  if (platform) {
    const normalizedPlatform = platform.toLowerCase();
    _users = _users.filter(
      (u) => !(u.discordUserId === discordUserId && u.platform === normalizedPlatform)
    );
  } else {
    _users = _users.filter((u) => u.discordUserId !== discordUserId);
  }

  if (_users.length !== before) {
    try {
      if (platform) {
        await pool.query(
          "DELETE FROM users WHERE discord_user_id = $1 AND platform = $2",
          [discordUserId, platform.toLowerCase()]
        );
      } else {
        await pool.query(
          "DELETE FROM users WHERE discord_user_id = $1",
          [discordUserId]
        );
      }
    } catch (e: any) {
      console.warn(`[users] Could not delete user from DB: ${e.message}`);
    }
    return true;
  }
  return false;
}

/**
 * Get all usernames for a specific platform to poll.
 */
export function getUsernamesByPlatform(platform: string): string[] {
  const normalizedPlatform = platform.toLowerCase();
  return _users
    .filter((u) => u.platform === normalizedPlatform)
    .map((u) => u.username);
}

/**
 * Get all usernames across all platforms (for polling).
 */
export function getAllUsernames(): { platform: string; username: string }[] {
  return _users.map((u) => ({ platform: u.platform, username: u.username }));
}

/**
 * Get all platforms that have configured users.
 */
export function getAllPlatforms(): string[] {
  const platforms = new Set(_users.map((u) => u.platform));
  return Array.from(platforms);
}

import { getPool } from "./db";

export interface UserConfig {
  /** Discord user ID */
  discordUserId: string;
  /** Discord username (for display only) */
  discordUsername: string;
  /** Twitch username to monitor */
  twitchUsername: string;
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
      "SELECT discord_user_id, discord_username, twitch_username, added_at FROM users"
    );
    _users = rows.map((row) => ({
      discordUserId: row.discord_user_id,
      discordUsername: row.discord_username,
      twitchUsername: row.twitch_username,
      addedAt: row.added_at.toISOString(),
    }));
    console.log(`[users] Loaded ${_users.length} user(s) from database ✓`);
  } catch (e: any) {
    console.error("[users] Failed to load users from DB:", e.message);
    _users = [];
  }

  _initialized = true;
  return _users;
}

export function getAllUsers(): UserConfig[] {
  if (!_initialized) return [];
  return [..._users];
}

export function getUserByDiscordId(discordUserId: string): UserConfig | null {
  return _users.find((u) => u.discordUserId === discordUserId) ?? null;
}

export function getUserByTwitchUsername(twitchUsername: string): UserConfig | null {
  return _users.find(
    (u) => u.twitchUsername.toLowerCase() === twitchUsername.toLowerCase()
  ) ?? null;
}

/**
 * Add or replace a user in memory and persist to DB.
 * Returns the user entry.
 */
export async function addUser(
  discordUserId: string,
  discordUsername: string,
  twitchUsername: string
): Promise<UserConfig> {
  const pool = getPool();

  // Remove existing entry for this Discord user if present
  _users = _users.filter((u) => u.discordUserId !== discordUserId);

  const entry: UserConfig = {
    discordUserId,
    discordUsername,
    twitchUsername: twitchUsername.toLowerCase(),
    addedAt: new Date().toISOString(),
  };
  _users.push(entry);

  // Persist to DB
  try {
    await pool.query(
      `INSERT INTO users (discord_user_id, discord_username, twitch_username, added_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (discord_user_id)
       DO UPDATE SET discord_username = $2, twitch_username = $3, added_at = $4`,
      [discordUserId, discordUsername, twitchUsername.toLowerCase(), entry.addedAt]
    );
  } catch (e: any) {
    console.warn(`[users] Could not save user to DB: ${e.message}`);
  }

  return entry;
}

/**
 * Remove a user by Discord ID. Returns true if removed.
 */
export async function removeUserByDiscordId(discordUserId: string): Promise<boolean> {
  const pool = getPool();
  const before = _users.length;
  _users = _users.filter((u) => u.discordUserId !== discordUserId);

  if (_users.length !== before) {
    try {
      await pool.query("DELETE FROM users WHERE discord_user_id = $1", [discordUserId]);
    } catch (e: any) {
      console.warn(`[users] Could not delete user from DB: ${e.message}`);
    }
    return true;
  }
  return false;
}

/**
 * Remove a user by Twitch username. Returns true if the list changed.
 */
export async function removeUserByTwitchUsername(twitchUsername: string): Promise<boolean> {
  const pool = getPool();
  const before = _users.length;
  const normalized = twitchUsername.toLowerCase();
  _users = _users.filter((u) => u.twitchUsername.toLowerCase() !== normalized);

  if (_users.length !== before) {
    try {
      // Find the discordUserId for the removed entry
      // Since we already filtered, we need to delete by twitch_username
      await pool.query("DELETE FROM users WHERE twitch_username = $1", [normalized]);
    } catch (e: any) {
      console.warn(`[users] Could not delete user from DB: ${e.message}`);
    }
    return true;
  }
  return false;
}

/** Get all Twitch usernames to poll */
export function getAllTwitchUsernames(): string[] {
  return _users.map((u) => u.twitchUsername);
}

import { join } from "path";
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "fs";

/**
 * Persistent storage directory.
 * On Render: set DATA_DIR env var to your mounted disk path (e.g. "/data").
 * Local dev fallbacks to project directory.
 */

/**
 * Resolve a writable data directory.
 * Tries DATA_DIR env first, falls back to project dir, then /tmp.
 */
function resolveDataDir(): string {
  const candidates = [
    process.env.DATA_DIR,                       // e.g. "/data" on Render with persistent disk
    join(import.meta.dir, ".."),                // project directory (local dev)
    "/tmp",                                     // last resort (ephemeral but writable)
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    try {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      // Verify it's actually writable
      const testPath = join(dir, ".write_test_" + Date.now());
      writeFileSync(testPath, "");
      unlinkSync(testPath);
      return dir;
    } catch (e: any) {
      console.warn(`[users] Data directory ${dir} not writable: ${e.message}`);
    }
  }

  return "/tmp";
}

const DATA_DIR = resolveDataDir();
const USERS_PATH = join(DATA_DIR, "users.json");

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

function load(): UserConfig[] {
  try {
    const file = Bun.file(USERS_PATH);
    if (file.size > 0) {
      _users = JSON.parse(Bun.readFileSync(USERS_PATH).toString());
    }
  } catch {
    // No file yet — that's fine
    _users = [];
  }
  return _users;
}

function save(): void {
  try {
    Bun.write(USERS_PATH, JSON.stringify(_users, null, 2));
  } catch (e: any) {
    console.warn(`[users] Could not write users.json: ${e.message}`);
  }
}

// Ensure loaded on first import
load();

export function getAllUsers(): UserConfig[] {
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

export function addUser(
  discordUserId: string,
  discordUsername: string,
  twitchUsername: string
): UserConfig {
  // Remove existing entry for this Discord user if present
  _users = _users.filter((u) => u.discordUserId !== discordUserId);

  const entry: UserConfig = {
    discordUserId,
    discordUsername,
    twitchUsername: twitchUsername.toLowerCase(),
    addedAt: new Date().toISOString(),
  };
  _users.push(entry);
  save();
  return entry;
}

export function removeUserByDiscordId(discordUserId: string): boolean {
  const before = _users.length;
  _users = _users.filter((u) => u.discordUserId !== discordUserId);
  if (_users.length !== before) {
    save();
    return true;
  }
  return false;
}

/** Returns true if the list changed */
export function removeUserByTwitchUsername(twitchUsername: string): boolean {
  const before = _users.length;
  _users = _users.filter(
    (u) => u.twitchUsername.toLowerCase() !== twitchUsername.toLowerCase()
  );
  if (_users.length !== before) {
    save();
    return true;
  }
  return false;
}

/** Get all Twitch usernames to poll */
export function getAllTwitchUsernames(): string[] {
  return _users.map((u) => u.twitchUsername);
}

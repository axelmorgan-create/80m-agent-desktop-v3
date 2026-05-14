import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { HERMES_HOME } from "./installer";
import { normalizeProfileName, profileHome, safeWriteFile } from "./utils";
import Database from "better-sqlite3";
import { t } from "../shared/i18n";
import { getAppLocale } from "./locale";

const CACHE_DIR = join(HERMES_HOME, "desktop");
const DEFAULT_CACHE_FILE = join(CACHE_DIR, "sessions.json");

export interface CachedSession {
  id: string;
  profile: string;
  title: string;
  startedAt: number;
  updatedAt: number;
  source: string;
  messageCount: number;
  model: string;
}

interface CacheData {
  sessions: CachedSession[];
  lastSync: number;
}

function cacheFileForProfile(profile?: string): string {
  const profileName = normalizeProfileName(profile);
  return profileName === "default"
    ? DEFAULT_CACHE_FILE
    : join(CACHE_DIR, `sessions-${profileName}.json`);
}

function dbPathForProfile(profile?: string): string {
  return join(profileHome(profile), "state.db");
}

// Generate a short, readable title from the first user message (like ChatGPT/Claude)
function generateTitle(message: string): string {
  if (!message || !message.trim())
    return t("sessions.newConversation", getAppLocale());

  // Clean up the message
  let text = message.trim();

  // Remove markdown formatting
  text = text.replace(/[#*_`~[\]()]/g, "");
  // Remove URLs
  text = text.replace(/https?:\/\/\S+/g, "");
  // Remove extra whitespace
  text = text.replace(/\s+/g, " ").trim();

  if (!text) return t("sessions.newConversation", getAppLocale());

  // If short enough, use as-is
  if (text.length <= 50) return text;

  // Take first meaningful chunk — aim for ~40-50 chars at word boundary
  const words = text.split(" ");
  let title = "";
  for (const word of words) {
    if ((title + " " + word).trim().length > 45) break;
    title = (title + " " + word).trim();
  }

  return title || text.slice(0, 45) + "...";
}

function readCache(profile?: string): CacheData {
  try {
    const cacheFile = cacheFileForProfile(profile);
    if (!existsSync(cacheFile)) return { sessions: [], lastSync: 0 };
    return JSON.parse(readFileSync(cacheFile, "utf-8"));
  } catch {
    return { sessions: [], lastSync: 0 };
  }
}

function writeCache(data: CacheData, profile?: string): void {
  try {
    safeWriteFile(cacheFileForProfile(profile), JSON.stringify(data));
  } catch {
    // non-fatal
  }
}

function getDb(profile?: string): Database.Database | null {
  const dbPath = dbPathForProfile(profile);
  if (!existsSync(dbPath)) return null;
  return new Database(dbPath, { readonly: true });
}

// Sync from the selected Hermes profile DB to local cache.
// We re-read the latest session set because resumed sessions can receive new
// messages long after their started_at timestamp.
export function syncSessionCache(profile?: string): CachedSession[] {
  const profileName = normalizeProfileName(profile);
  const cache = readCache(profileName);
  const db = getDb(profileName);
  if (!db) return cache.sessions;

  try {
    const rows = db
      .prepare(
        `SELECT
          s.id,
          s.started_at,
          s.source,
          s.message_count,
          s.model,
          s.title,
          COALESCE(
            (SELECT MAX(m.timestamp) FROM messages m WHERE m.session_id = s.id),
            s.ended_at,
            s.started_at
          ) AS updated_at
         FROM sessions s
         ORDER BY updated_at DESC, s.started_at DESC
         LIMIT 500`,
      )
      .all() as Array<{
      id: string;
      started_at: number;
      source: string;
      message_count: number;
      model: string;
      title: string | null;
      updated_at: number;
    }>;

    const syncedSessions: CachedSession[] = [];

    for (const row of rows) {
      // Generate title from first user message
      let title = row.title || "";
      if (!title) {
        try {
          const msg = db
            .prepare(
              `SELECT content FROM messages
               WHERE session_id = ? AND role = 'user' AND content IS NOT NULL
               ORDER BY timestamp, id LIMIT 1`,
            )
            .get(row.id) as { content: string } | undefined;
          title = msg
            ? generateTitle(msg.content)
            : t("sessions.newConversation", getAppLocale());
        } catch {
          title = t("sessions.newConversation", getAppLocale());
        }
      }

      syncedSessions.push({
        id: row.id,
        profile: profileName,
        title,
        startedAt: row.started_at,
        updatedAt: row.updated_at || row.started_at,
        source: row.source,
        messageCount: row.message_count,
        model: row.model || "",
      });
    }

    syncedSessions.sort(
      (a, b) => b.updatedAt - a.updatedAt || b.startedAt - a.startedAt,
    );

    const updated: CacheData = {
      sessions: syncedSessions,
      lastSync: Math.floor(Date.now() / 1000),
    };
    writeCache(updated, profileName);
    return updated.sessions;
  } catch {
    return cache.sessions;
  } finally {
    db.close();
  }
}

// Fast read from cache only (no DB access)
export function listCachedSessions(
  limit = 50,
  offset = 0,
  profile?: string,
): CachedSession[] {
  const cache = readCache(profile);
  return cache.sessions.slice(offset, offset + limit);
}

// Update title for a specific session
export function updateSessionTitle(
  sessionId: string,
  title: string,
  profile?: string,
): void {
  const cache = readCache(profile);
  const idx = cache.sessions.findIndex((s) => s.id === sessionId);
  if (idx >= 0) {
    cache.sessions[idx].title = title;
    writeCache(cache, profile);
  }
}

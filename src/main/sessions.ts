import Database from "better-sqlite3";
import { join } from "path";
import { existsSync, readdirSync } from "fs";
import { HERMES_HOME } from "./installer";
import { isValidProfileName, normalizeProfileName, profileHome } from "./utils";

function dbPathForProfile(profile?: string): string {
  return join(profileHome(profile), "state.db");
}

export interface SessionSummary {
  id: string;
  profile: string;
  source: string;
  startedAt: number;
  updatedAt: number;
  endedAt: number | null;
  messageCount: number;
  model: string;
  title: string | null;
  preview: string;
}

export interface SessionMessage {
  id: number;
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: number;
  tool_calls?: string;
  tool_name?: string;
}

export interface SearchResult {
  sessionId: string;
  profile: string;
  title: string | null;
  startedAt: number;
  updatedAt: number;
  source: string;
  messageCount: number;
  model: string;
  snippet: string;
}

function getDb(profile?: string): Database.Database | null {
  const dbPath = dbPathForProfile(profile);
  if (!existsSync(dbPath)) return null;
  return new Database(dbPath, { readonly: true });
}

export function listSessionProfiles(): string[] {
  const profiles = new Set<string>(["default"]);
  const profilesDir = join(HERMES_HOME, "profiles");
  if (existsSync(profilesDir)) {
    try {
      for (const entry of readdirSync(profilesDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const profile = normalizeProfileName(entry.name);
        if (!isValidProfileName(profile)) continue;
        if (existsSync(dbPathForProfile(profile))) profiles.add(profile);
      }
    } catch {
      // Profile discovery is best-effort; the default DB still works.
    }
  }
  return [...profiles];
}

function sessionProfileCandidates(profile?: string): string[] {
  if (profile !== undefined && profile !== null && profile !== "") {
    const normalized = normalizeProfileName(profile);
    return isValidProfileName(normalized) ? [normalized] : ["default"];
  }
  return listSessionProfiles();
}

export function findSessionProfile(sessionId: string): string | null {
  for (const profile of sessionProfileCandidates()) {
    const db = getDb(profile);
    if (!db) continue;
    try {
      const row = db
        .prepare("SELECT id FROM sessions WHERE id = ? LIMIT 1")
        .get(sessionId) as { id: string } | undefined;
      if (row) return profile;
    } catch {
      // Ignore profile DBs that are not initialized yet.
    } finally {
      db.close();
    }
  }
  return null;
}

export function listSessionProfileMappings(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const profile of sessionProfileCandidates()) {
    const db = getDb(profile);
    if (!db) continue;
    try {
      const rows = db.prepare("SELECT id FROM sessions").all() as Array<{
        id: string;
      }>;
      for (const row of rows) {
        map[row.id] = profile;
      }
    } catch {
      // Ignore profile DBs that are not initialized yet.
    } finally {
      db.close();
    }
  }
  return map;
}

export function listSessions(
  limit = 30,
  offset = 0,
  profile?: string,
): SessionSummary[] {
  const candidates = sessionProfileCandidates(profile);
  const sessions: SessionSummary[] = [];

  for (const profileName of candidates) {
    const db = getDb(profileName);
    if (!db) continue;

    try {
      const rows = db
        .prepare(
          `SELECT
            s.id,
            s.source,
            s.started_at,
            s.ended_at,
            COALESCE(
              (SELECT MAX(m.timestamp) FROM messages m WHERE m.session_id = s.id),
              s.ended_at,
              s.started_at
            ) AS updated_at,
            s.message_count,
            s.model,
            s.title
          FROM sessions s
          ORDER BY updated_at DESC, s.started_at DESC
          LIMIT ? OFFSET ?`,
        )
        .all(limit + offset, 0) as Array<{
        id: string;
        source: string;
        started_at: number;
        ended_at: number | null;
        updated_at: number;
        message_count: number;
        model: string;
        title: string | null;
      }>;

      sessions.push(
        ...rows.map((r) => ({
          id: r.id,
          profile: profileName,
          source: r.source,
          startedAt: r.started_at,
          updatedAt: r.updated_at || r.ended_at || r.started_at,
          endedAt: r.ended_at,
          messageCount: r.message_count,
          model: r.model || "",
          title: r.title,
          preview: "",
        })),
      );
    } catch {
      // Ignore profile DBs that are not initialized yet.
    } finally {
      db.close();
    }
  }

  return sessions
    .sort((a, b) => b.updatedAt - a.updatedAt || b.startedAt - a.startedAt)
    .slice(offset, offset + limit);
}

export function searchSessions(
  query: string,
  limit = 20,
  profile?: string,
): SearchResult[] {
  const results: SearchResult[] = [];

  for (const profileName of sessionProfileCandidates(profile)) {
    const db = getDb(profileName);
    if (!db) continue;

    try {
      // Check if FTS table exists
      const tableCheck = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='messages_fts'",
        )
        .get() as { name: string } | undefined;

      if (!tableCheck) continue;

      // Sanitize query for FTS5: wrap each word with quotes for safety, add * for prefix
      const sanitized = query
        .trim()
        .split(/\s+/)
        .filter((w) => w.length > 0)
        .map((w) => `"${w.replace(/"/g, "")}"*`)
        .join(" ");

      if (!sanitized) continue;

      const rows = db
        .prepare(
          `SELECT DISTINCT
            m.session_id,
            s.title,
            s.started_at,
            COALESCE(
              (SELECT MAX(m2.timestamp) FROM messages m2 WHERE m2.session_id = s.id),
              s.ended_at,
              s.started_at
            ) AS updated_at,
            s.source,
            s.message_count,
            s.model,
            snippet(messages_fts, 0, '<<', '>>', '...', 40) as snippet
          FROM messages_fts
          JOIN messages m ON m.id = messages_fts.rowid
          JOIN sessions s ON s.id = m.session_id
          WHERE messages_fts MATCH ?
          ORDER BY rank
          LIMIT ?`,
        )
        .all(sanitized, limit) as Array<{
        session_id: string;
        title: string | null;
        started_at: number;
        updated_at: number;
        source: string;
        message_count: number;
        model: string;
        snippet: string;
      }>;

      results.push(
        ...rows.map((r) => ({
          sessionId: r.session_id,
          profile: profileName,
          title: r.title,
          startedAt: r.started_at,
          updatedAt: r.updated_at || r.started_at,
          source: r.source,
          messageCount: r.message_count,
          model: r.model || "",
          snippet: r.snippet || "",
        })),
      );
    } catch {
      // Keep searching other profile DBs if one DB/query is unavailable.
    } finally {
      db.close();
    }
  }

  return results
    .sort((a, b) => b.updatedAt - a.updatedAt || b.startedAt - a.startedAt)
    .slice(0, limit);
}

export function getSessionMessages(
  sessionId: string,
  profile?: string,
): SessionMessage[] {
  for (const profileName of sessionProfileCandidates(profile)) {
    const db = getDb(profileName);
    if (!db) continue;

    try {
      const rows = db
        .prepare(
          `SELECT id, role, content, timestamp, tool_calls, tool_name
           FROM messages
           WHERE session_id = ? AND (content IS NOT NULL OR tool_calls IS NOT NULL)
           ORDER BY timestamp, id`,
        )
        .all(sessionId) as Array<{
        id: number;
        role: string;
        content: string;
        timestamp: number;
        tool_calls: string | null;
        tool_name: string | null;
      }>;

      if (rows.length === 0) continue;
      return rows.map((r) => ({
        id: r.id,
        role: r.role as "user" | "assistant" | "tool",
        content: r.content || "",
        timestamp: r.timestamp,
        tool_calls: r.tool_calls || undefined,
        tool_name: r.tool_name || undefined,
      }));
    } catch {
      // Try the next candidate if this DB is unavailable or unmigrated.
    } finally {
      db.close();
    }
  }

  return [];
}

export function hasSession(sessionId: string, profile?: string): boolean {
  const resolvedProfile = profile
    ? normalizeProfileName(profile)
    : findSessionProfile(sessionId);
  if (!resolvedProfile) return false;
  const db = getDb(resolvedProfile);
  if (!db) return false;

  try {
    const row = db
      .prepare("SELECT id FROM sessions WHERE id = ? LIMIT 1")
      .get(sessionId) as { id: string } | undefined;
    return Boolean(row);
  } catch {
    return false;
  } finally {
    db.close();
  }
}

import * as fs from "fs";
import { join } from "path";
import { HERMES_HOME } from "./installer";
import { listSessionProfileMappings } from "./sessions";
import { normalizeProfileName } from "./utils";

const SESSION_PROFILES_FILENAME = "session-profiles.json";

function sessionProfilesPath(): string {
  return join(HERMES_HOME, SESSION_PROFILES_FILENAME);
}

function readSessionProfiles(): Record<string, string> {
  try {
    const file = sessionProfilesPath();
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return {};
  }
}

export function recordSessionProfile(sessionId: string, profile: string): void {
  try {
    if (!fs.existsSync(HERMES_HOME)) {
      fs.mkdirSync(HERMES_HOME, { recursive: true });
    }
    const map = readSessionProfiles();
    map[sessionId] = normalizeProfileName(profile);
    fs.writeFileSync(
      sessionProfilesPath(),
      JSON.stringify(map, null, 2),
      "utf-8",
    );
  } catch (_) {
    // best-effort
  }
}

export function getSessionProfiles(): Record<string, string> {
  const explicit = readSessionProfiles();
  const discovered = listSessionProfileMappings();
  const merged = { ...discovered };
  for (const [sessionId, profile] of Object.entries(explicit)) {
    if (!merged[sessionId] || merged[sessionId] === "default") {
      merged[sessionId] = normalizeProfileName(profile);
    }
  }
  return merged;
}

export const getAllSessionProfiles = getSessionProfiles;

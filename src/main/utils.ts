import { join, dirname } from "path";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { HERMES_HOME } from "./installer";

/**
 * Strip ANSI escape codes from terminal output.
 * Used by hermes.ts, claw3d.ts, and installer.ts when processing
 * child process output for display in the renderer.
 */
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1B\[[0-9;]*[a-zA-Z]|\x1B\][^\x07]*\x07|\x1B\(B|\r/g;

export function stripAnsi(str: string): string {
  return str.replace(ANSI_RE, "");
}

const PROFILE_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export function normalizeProfileName(profile?: string | null): string {
  const name = String(profile || "default").trim();
  if (!name || name.toLowerCase() === "default") return "default";
  return name.toLowerCase();
}

export function isValidProfileName(profile?: string | null): boolean {
  const name = normalizeProfileName(profile);
  return name === "default" || PROFILE_ID_RE.test(name);
}

/**
 * Resolve the home directory for a given profile.
 * 'default' or undefined maps to ~/.hermes; named profiles
 * live under ~/.hermes/profiles/<name>.
 */
export function profileHome(profile?: string): string {
  const name = normalizeProfileName(profile);
  return name !== "default" ? join(HERMES_HOME, "profiles", name) : HERMES_HOME;
}

/**
 * Escape special regex characters in a string so it can be
 * safely interpolated into a RegExp constructor.
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Write a file, creating parent directories if they don't exist.
 * Prevents ENOENT crashes when ~/.hermes has been deleted or doesn't exist yet.
 */
export function safeWriteFile(filePath: string, content: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, content, "utf-8");
}

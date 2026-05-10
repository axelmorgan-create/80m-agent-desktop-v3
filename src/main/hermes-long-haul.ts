import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { readEnv, setEnvValue } from "./config";
import { profileHome, safeWriteFile } from "./utils";

const LONG_HAUL_ENV_MINIMUMS: Record<string, number> = {
  HERMES_MAX_ITERATIONS: 300,
  HERMES_API_TIMEOUT: 7200,
  HERMES_API_CALL_STALE_TIMEOUT: 7200,
  HERMES_STREAM_READ_TIMEOUT: 7200,
  HERMES_STREAM_STALE_TIMEOUT: 7200,
  TERMINAL_TIMEOUT: 3600,
  TERMINAL_LIFETIME_SECONDS: 86400,
  BROWSER_INACTIVITY_TIMEOUT: 1800,
  BROWSER_COMMAND_TIMEOUT: 600,
  BROWSER_DIALOG_TIMEOUT_S: 1800,
  HERMES_RESTART_DRAIN_TIMEOUT: 3600,
  HERMES_AUTO_CONTINUE_FRESHNESS: 86400,
};

const LONG_HAUL_ENV_EXACT: Record<string, string> = {
  HERMES_AGENT_TIMEOUT: "0",
  HERMES_CRON_TIMEOUT: "0",
};

const LONG_HAUL_CONFIG_MINIMUMS = [
  ["agent", "max_turns", 300],
  ["agent", "restart_drain_timeout", 3600],
  ["agent", "gateway_timeout_warning", 1800],
  ["agent", "gateway_notify_interval", 600],
  ["agent", "gateway_auto_continue_freshness", 86400],
  ["terminal", "timeout", 3600],
  ["terminal", "lifetime_seconds", 86400],
  ["browser", "inactivity_timeout", 1800],
  ["browser", "command_timeout", 600],
  ["browser", "dialog_timeout_s", 1800],
  ["file_read_max_chars", "", 300000],
  ["tool_output", "max_bytes", 200000],
  ["tool_output", "max_lines", 5000],
] as const;

const LONG_HAUL_CONFIG_EXACT = [["agent", "gateway_timeout", 0]] as const;

function parsePositiveNumber(value: string | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function ensureEnvNumberAtLeast(
  key: string,
  minimum: number,
  profile?: string,
): boolean {
  const existing = readEnv(profile)[key] || process.env[key];
  const parsed = parsePositiveNumber(existing);
  if (parsed == null || parsed < minimum) {
    setEnvValue(key, String(minimum), profile);
    return true;
  }
  return false;
}

function ensureEnvExact(key: string, value: string, profile?: string): boolean {
  const existing = readEnv(profile)[key] || process.env[key];
  if (existing !== value) {
    setEnvValue(key, value, profile);
    return true;
  }
  return false;
}

export function applyLongHaulEnv(
  env: Record<string, string>,
): Record<string, string> {
  for (const [key, minimum] of Object.entries(LONG_HAUL_ENV_MINIMUMS)) {
    const parsed = parsePositiveNumber(env[key] || process.env[key]);
    env[key] = String(parsed != null && parsed >= minimum ? parsed : minimum);
  }
  for (const [key, value] of Object.entries(LONG_HAUL_ENV_EXACT)) {
    env[key] = value;
  }
  return env;
}

function leadingSpaces(line: string): number {
  return line.length - line.trimStart().length;
}

function splitLineValue(line: string): { value: string; comment: string } {
  const hash = line.indexOf("#");
  const body = hash >= 0 ? line.slice(0, hash) : line;
  return {
    value: body.split(":").slice(1).join(":").trim(),
    comment: hash >= 0 ? ` ${line.slice(hash).trim()}` : "",
  };
}

function ensureYamlNumber(
  content: string,
  section: string,
  key: string,
  value: number,
  mode: "minimum" | "exact",
): string {
  const lines = content.split(/\r?\n/);
  const sectionRe = key
    ? new RegExp(`^${section}:\\s*(?:#.*)?$`)
    : new RegExp(`^${section}:\\s*.*$`);
  const sectionIndex = lines.findIndex((line) =>
    sectionRe.test(line.trimEnd()),
  );

  if (sectionIndex === -1) {
    if (lines.length && lines[lines.length - 1].trim() !== "") lines.push("");
    if (key) {
      lines.push(`${section}:`, `  ${key}: ${value}`);
    } else {
      lines.push(`${section}: ${value}`);
    }
    return lines.join("\n");
  }

  if (!key) {
    const { value: raw, comment } = splitLineValue(lines[sectionIndex]);
    const current = Number(raw.replace(/^["']|["']$/g, ""));
    if (mode === "minimum" && Number.isFinite(current) && current >= value) {
      return content;
    }
    lines[sectionIndex] = `${section}: ${value}${comment}`;
    return lines.join("\n");
  }

  const sectionIndent = leadingSpaces(lines[sectionIndex]);
  let insertAt = lines.length;
  let keyIndex = -1;
  const keyRe = new RegExp(`^\\s*${key}:`);

  for (let i = sectionIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    const indent = leadingSpaces(line);
    if (indent <= sectionIndent && !trimmed.startsWith("#")) {
      insertAt = i;
      break;
    }

    if (indent > sectionIndent && keyRe.test(trimmed)) {
      keyIndex = i;
      break;
    }
  }

  const rendered = `${" ".repeat(sectionIndent + 2)}${key}: ${value}`;
  if (keyIndex === -1) {
    lines.splice(insertAt, 0, rendered);
    return lines.join("\n");
  }

  const { value: raw, comment } = splitLineValue(lines[keyIndex]);
  const current = Number(raw.replace(/^["']|["']$/g, ""));
  if (mode === "minimum" && Number.isFinite(current) && current >= value) {
    return content;
  }

  lines[keyIndex] = `${rendered}${comment}`;
  return lines.join("\n");
}

export function ensureLongHaulConfig(profile?: string): boolean {
  let changed = false;
  for (const [key, minimum] of Object.entries(LONG_HAUL_ENV_MINIMUMS)) {
    changed = ensureEnvNumberAtLeast(key, minimum, profile) || changed;
  }
  for (const [key, value] of Object.entries(LONG_HAUL_ENV_EXACT)) {
    changed = ensureEnvExact(key, value, profile) || changed;
  }

  const configPath = join(profileHome(profile), "config.yaml");
  let content = existsSync(configPath) ? readFileSync(configPath, "utf-8") : "";
  const originalContent = content;
  for (const [section, key, value] of LONG_HAUL_CONFIG_MINIMUMS) {
    content = ensureYamlNumber(content, section, key, value, "minimum");
  }
  for (const [section, key, value] of LONG_HAUL_CONFIG_EXACT) {
    content = ensureYamlNumber(content, section, key, value, "exact");
  }
  if (content !== originalContent || !existsSync(configPath)) {
    safeWriteFile(
      configPath,
      content.endsWith("\n") ? content : `${content}\n`,
    );
    changed = true;
  }
  return changed;
}

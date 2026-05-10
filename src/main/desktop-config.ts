import * as fs from "fs";
import { isAbsolute, join, resolve } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";
import { HERMES_HOME, HERMES_REPO } from "./installer";

function desktopConfigPath(): string {
  return join(HERMES_HOME, "desktop.json");
}

export function readDesktopJson(): Record<string, unknown> {
  try {
    const file = desktopConfigPath();
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return {};
  }
}

export function writeDesktopJson(data: Record<string, unknown>): void {
  try {
    if (!fs.existsSync(HERMES_HOME))
      fs.mkdirSync(HERMES_HOME, { recursive: true });
    fs.writeFileSync(
      desktopConfigPath(),
      JSON.stringify(data, null, 2),
      "utf-8",
    );
  } catch {
    // Desktop preferences are best-effort.
  }
}

export function normalizeLocalPath(input: string): string {
  let targetPath = String(input || "").trim();
  targetPath = targetPath.replace(/^["'`]+|["'`]+$/g, "");
  if (targetPath.startsWith("file://")) {
    try {
      targetPath = fileURLToPath(targetPath);
    } catch {
      targetPath = decodeURIComponent(targetPath.replace(/^file:\/\//, ""));
    }
  }
  targetPath = targetPath.replace(/^~(?=\/|\\|$)/, homedir());
  return targetPath;
}

function localPathCandidates(input: string): string[] {
  const normalized = normalizeLocalPath(input);
  const withoutLineNumber = normalized.replace(/:\d+(?::\d+)?$/, "");
  const rawCandidates = [normalized, withoutLineNumber];
  const bases = [
    "",
    HERMES_REPO,
    HERMES_HOME,
    join(HERMES_HOME, "cache"),
    homedir(),
  ];
  const candidates: string[] = [];

  for (const raw of rawCandidates) {
    if (!raw) continue;
    if (isAbsolute(raw)) {
      candidates.push(raw);
      continue;
    }
    for (const base of bases) {
      candidates.push(base ? resolve(base, raw) : resolve(raw));
    }
  }

  return [...new Set(candidates)];
}

export function resolveExistingLocalPath(input: string): string | null {
  for (const candidate of localPathCandidates(input)) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

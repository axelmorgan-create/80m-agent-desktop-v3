import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { profileHome, safeWriteFile } from "./utils";
import { buildProfileDefaultSoul } from "./agent-personas";

export function readSoul(profile?: string): string {
  const soulFile = join(profileHome(profile), "SOUL.md");
  if (!existsSync(soulFile)) return "";

  try {
    return readFileSync(soulFile, "utf-8");
  } catch {
    return "";
  }
}

export function writeSoul(content: string, profile?: string): boolean {
  const soulFile = join(profileHome(profile), "SOUL.md");

  try {
    safeWriteFile(soulFile, content);
    return true;
  } catch {
    return false;
  }
}

export function resetSoul(profile?: string): string {
  const content = buildProfileDefaultSoul(profile);
  writeSoul(content, profile);
  return content;
}

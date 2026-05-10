import * as fs from "fs";
import { basename, join } from "path";
import { homedir } from "os";
import { HERMES_HOME } from "./installer";
import { readDesktopJson, resolveExistingLocalPath } from "./desktop-config";

export interface ObsidianVaultInfo {
  path: string | null;
  name: string;
  exists: boolean;
  noteCount: number;
  totalFiles: number;
}

function countVaultFiles(root: string): {
  noteCount: number;
  totalFiles: number;
} {
  let noteCount = 0;
  let totalFiles = 0;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".obsidian") continue;
      const child = join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(child);
      } else {
        totalFiles++;
        if (entry.name.toLowerCase().endsWith(".md")) noteCount++;
      }
      if (totalFiles > 5000) return { noteCount, totalFiles };
    }
  }
  return { noteCount, totalFiles };
}

export function getObsidianVaultInfo(): ObsidianVaultInfo {
  const desktop = readDesktopJson();
  const configured =
    typeof desktop.obsidianVaultPath === "string"
      ? desktop.obsidianVaultPath
      : "";
  const candidates = [
    configured,
    process.env.OBSIDIAN_VAULT_PATH || "",
    join(homedir(), "obsidian-vault"),
    join(homedir(), "Documents", "Obsidian Vault"),
    join(HERMES_HOME, "obsidian-vault"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const resolvedPath = resolveExistingLocalPath(candidate);
    if (!resolvedPath) continue;
    try {
      const stat = fs.statSync(resolvedPath);
      if (!stat.isDirectory()) continue;
      const counts = countVaultFiles(resolvedPath);
      return {
        path: resolvedPath,
        name: basename(resolvedPath),
        exists: true,
        ...counts,
      };
    } catch {
      // Try next candidate.
    }
  }

  return {
    path: null,
    name: "Obsidian Vault",
    exists: false,
    noteCount: 0,
    totalFiles: 0,
  };
}

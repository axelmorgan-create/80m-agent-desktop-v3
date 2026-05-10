import { execSync } from "child_process";
import { existsSync, readdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getEnhancedPath } from "./installer";

let _cachedNpmPath: string | null = null;

export function findNpm(): string {
  if (_cachedNpmPath) return _cachedNpmPath;

  const home = homedir();

  // Try common locations first (no process spawn).
  // Includes nvm, volta, fnm, and system paths.
  const candidates = [
    join(home, ".volta", "bin", "npm"),
    join(home, ".asdf", "shims", "npm"),
    join(home, ".local", "share", "fnm", "aliases", "default", "bin", "npm"),
    join(home, ".fnm", "aliases", "default", "bin", "npm"),
    "/usr/local/bin/npm",
    "/opt/homebrew/bin/npm",
  ];

  // Discover nvm npm dynamically (active version)
  const nvmDir = process.env.NVM_DIR || join(home, ".nvm");
  const nvmVersions = join(nvmDir, "versions", "node");
  if (existsSync(nvmVersions)) {
    try {
      const versions = readdirSync(nvmVersions)
        .filter((d: string) => d.startsWith("v"))
        .sort()
        .reverse();
      for (const v of versions) {
        candidates.unshift(join(nvmVersions, v, "bin", "npm"));
      }
    } catch {
      /* non-fatal */
    }
  }

  for (const c of candidates) {
    if (existsSync(c)) {
      _cachedNpmPath = c;
      return c;
    }
  }

  // Fallback: which/where (blocks main thread — only runs once)
  try {
    const npmPath = execSync("which npm 2>/dev/null || where npm 2>/dev/null", {
      env: { ...process.env, PATH: getEnhancedPath() },
      timeout: 5000,
    })
      .toString()
      .trim()
      .split("\n")[0];
    if (npmPath && existsSync(npmPath)) {
      _cachedNpmPath = npmPath;
      return npmPath;
    }
  } catch {
    /* fall through */
  }

  _cachedNpmPath = "npm";
  return "npm";
}

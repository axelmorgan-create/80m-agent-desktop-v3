import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";

const distDir = join(process.cwd(), "dist");

const generatedArtifacts = [
  "linux-unpacked",
  "win-unpacked",
  "mac",
  "mac-arm64",
  ".icon-set",
  "builder-debug.yml",
  "builder-effective-config.yaml",
  "latest-linux.yml",
  "latest-linux.yaml",
];

const generatedExtensions = [
  ".AppImage",
  ".deb",
  ".snap",
  ".blockmap",
  ".dmg",
  ".exe",
  ".zip",
];

async function removeIfGenerated(name) {
  if (
    !generatedArtifacts.includes(name) &&
    !generatedExtensions.some((extension) => name.endsWith(extension))
  ) {
    return;
  }

  await rm(join(distDir, name), { recursive: true, force: true });
  console.log(`removed dist/${name}`);
}

try {
  const entries = await readdir(distDir, { withFileTypes: true });

  await Promise.all(entries.map((entry) => removeIfGenerated(entry.name)));
} catch (error) {
  if (error?.code !== "ENOENT") {
    throw error;
  }
}

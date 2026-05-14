import { app, ipcMain, shell } from "electron";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "fs";
import { join } from "path";
import { getMobileCompanionLocalUrl } from "./mobile-companion";

export interface CortexClipperInstallInfo {
  sourcePath: string;
  installPath: string;
  exists: boolean;
  manifestVersion: string | null;
  companionUrl: string;
  chromeExtensionsUrl: string;
  canSilentInstall: false;
  installNote: string;
}

const CHROME_EXTENSIONS_URL = "chrome://extensions";

function getClipperSourcePath(): string {
  const packagedPath = join(
    process.resourcesPath,
    "extensions",
    "cortex-clipper",
  );
  if (existsSync(packagedPath)) return packagedPath;
  return join(app.getAppPath(), "extensions", "cortex-clipper");
}

function getClipperInstallPath(): string {
  return join(app.getPath("userData"), "cortex-clipper");
}

function readManifestVersion(extensionPath: string): string | null {
  try {
    const manifestPath = join(extensionPath, "manifest.json");
    const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      version?: string;
    };
    return parsed.version || null;
  } catch {
    return null;
  }
}

export function ensureCortexClipperInstall(): CortexClipperInstallInfo {
  const sourcePath = getClipperSourcePath();
  const installPath = getClipperInstallPath();
  if (existsSync(sourcePath) && statSync(sourcePath).isDirectory()) {
    mkdirSync(app.getPath("userData"), { recursive: true });
    rmSync(installPath, { recursive: true, force: true });
    cpSync(sourcePath, installPath, { recursive: true });
  }

  const exists = existsSync(installPath);
  return {
    sourcePath,
    installPath,
    exists,
    manifestVersion: exists ? readManifestVersion(installPath) : null,
    companionUrl: getMobileCompanionLocalUrl(),
    chromeExtensionsUrl: CHROME_EXTENSIONS_URL,
    canSilentInstall: false,
    installNote:
      "Chrome requires user approval, Chrome Web Store distribution, or managed enterprise policy for browser installation. 80M installs the clipper files locally and opens the approved Chrome install surface.",
  };
}

export function registerCortexClipperIpc(): void {
  ipcMain.handle("cortex-clipper-get-install-info", () =>
    ensureCortexClipperInstall(),
  );

  ipcMain.handle("cortex-clipper-open-folder", async () => {
    const info = ensureCortexClipperInstall();
    if (!info.exists) return false;
    const error = await shell.openPath(info.installPath);
    return !error;
  });

  ipcMain.handle("cortex-clipper-open-chrome-extensions", async () => {
    await shell.openExternal(CHROME_EXTENSIONS_URL);
    return true;
  });
}

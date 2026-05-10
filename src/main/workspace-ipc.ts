import { dialog, ipcMain, shell, type BrowserWindow } from "electron";
import * as fs from "fs";
import { tmpdir } from "os";
import { basename, extname, join } from "path";
import {
  audioExtensionFromMime,
  getDocumentPreview,
  getObsidianVaultInfo,
  readDesktopJson,
  resolveExistingLocalPath,
  startWorkspaceWatch,
  stopWorkspaceWatch,
  synthesizeSpeech,
  transcribeAudioFile,
  writeDesktopJson,
  writeDocumentContent,
  writeFloatWav,
} from "./desktop-services";

export function registerWorkspaceIpc({
  getMainWindow,
  hermesHome,
}: {
  getMainWindow: () => BrowserWindow | null;
  hermesHome: string;
}): void {
  ipcMain.handle("open-local-path", async (_event, targetPath: string) => {
    const resolvedPath = resolveExistingLocalPath(targetPath);
    if (!resolvedPath) return false;
    const error = await shell.openPath(resolvedPath);
    return !error;
  });

  ipcMain.handle("reveal-local-path", (_event, targetPath: string) => {
    const resolvedPath = resolveExistingLocalPath(targetPath);
    if (!resolvedPath) return false;
    shell.showItemInFolder(resolvedPath);
    return true;
  });

  ipcMain.handle("read-document-preview", (_event, targetPath: string) =>
    getDocumentPreview(targetPath),
  );

  ipcMain.handle(
    "write-document-content",
    (_event, targetPath: string, content: string) =>
      writeDocumentContent(targetPath, content),
  );

  ipcMain.handle("watch-workspace", (_event, targetPath: string) =>
    startWorkspaceWatch(targetPath, (payload) => {
      getMainWindow()?.webContents.send("workspace-file-changed", payload);
    }),
  );

  ipcMain.handle("unwatch-workspace", () => {
    stopWorkspaceWatch();
    return true;
  });

  ipcMain.handle(
    "copy-file-to-workspace",
    async (_event, sourcePath: string) => {
      try {
        const resolvedSource = resolveExistingLocalPath(sourcePath);
        if (!resolvedSource) return null;
        const cacheDir = join(hermesHome, "cache");
        if (!fs.existsSync(cacheDir)) {
          fs.mkdirSync(cacheDir, { recursive: true });
        }
        const filename = basename(resolvedSource);
        const extension = extname(filename);
        const stem = extension
          ? filename.slice(0, -extension.length)
          : filename;
        let destPath = join(cacheDir, filename);
        let index = 1;
        while (fs.existsSync(destPath)) {
          destPath = join(cacheDir, `${stem}-${index}${extension}`);
          index += 1;
        }

        const stat = await fs.promises.stat(resolvedSource);
        if (stat.isDirectory()) {
          await fs.promises.cp(resolvedSource, destPath, { recursive: true });
        } else {
          await fs.promises.copyFile(resolvedSource, destPath);
        }
        return destPath;
      } catch (err) {
        console.error("Failed to copy file to workspace:", err);
        return null;
      }
    },
  );

  ipcMain.handle("select-project-directory", async () => {
    const result = await dialog.showOpenDialog(getMainWindow()!, {
      properties: ["openDirectory"],
      title: "Select Project Directory",
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle("read-directory", (_, dirPath) => {
    try {
      const resolvedPath = resolveExistingLocalPath(dirPath);
      if (!resolvedPath) return [];
      const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });
      return entries
        .filter((e) => e.name !== "node_modules" && e.name !== ".git")
        .map((e) => ({
          name: e.name,
          isDirectory: e.isDirectory(),
          path: join(resolvedPath, e.name),
        }))
        .sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });
    } catch {
      return [];
    }
  });

  ipcMain.handle("get-obsidian-vault", () => getObsidianVaultInfo());

  ipcMain.handle("set-obsidian-vault", (_event, vaultPath: string) => {
    const resolvedPath = resolveExistingLocalPath(vaultPath);
    if (!resolvedPath) return getObsidianVaultInfo();
    const stat = fs.statSync(resolvedPath);
    if (!stat.isDirectory()) return getObsidianVaultInfo();
    const desktop = readDesktopJson();
    desktop.obsidianVaultPath = resolvedPath;
    writeDesktopJson(desktop);
    return getObsidianVaultInfo();
  });

  ipcMain.handle(
    "transcribe-audio",
    async (
      _event,
      audioData: number[],
      mimeType = "audio/webm",
    ): Promise<string> => {
      const cacheDir = join(tmpdir(), "80m-voice");
      fs.mkdirSync(cacheDir, { recursive: true });
      const extension = audioExtensionFromMime(mimeType);
      const audioPath = join(
        cacheDir,
        `rec_${Date.now()}_${Math.random().toString(16).slice(2)}${extension}`,
      );

      try {
        if (mimeType === "audio/x-raw-float32") {
          writeFloatWav(audioPath.replace(extension, ".wav"), audioData);
          return await transcribeAudioFile(
            audioPath.replace(extension, ".wav"),
          );
        }
        fs.writeFileSync(audioPath, Buffer.from(audioData));
        return await transcribeAudioFile(audioPath);
      } catch (error) {
        console.warn("[VOICE] Transcription failed:", error);
        return "";
      } finally {
        try {
          if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
          const wavPath = audioPath.replace(extension, ".wav");
          if (wavPath !== audioPath && fs.existsSync(wavPath)) {
            fs.unlinkSync(wavPath);
          }
        } catch {
          // Best-effort temp cleanup.
        }
      }
    },
  );

  ipcMain.handle("tts-speak", async (_event, text: string): Promise<string> => {
    const cleanText = String(text || "").trim();
    if (!cleanText) return "";
    try {
      return await synthesizeSpeech(cleanText);
    } catch (error) {
      console.warn("[VOICE] TTS failed:", error);
      return "";
    }
  });
}

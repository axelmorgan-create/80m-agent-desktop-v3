import {
  app,
  BrowserWindow,
  ipcMain,
  Notification,
  dialog,
  shell,
} from "electron";
import { basename, extname, join } from "path";
import { tmpdir } from "os";
import http from "http";
import https from "https";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import type { AppUpdater } from "electron-updater";
import icon from "../../resources/icon.png?asset";
import { buildAppMenu } from "./app-menu";

interface AppNotificationPayload {
  title: string;
  body?: string;
  tone?: "info" | "success" | "warning" | "error";
  createdAt?: number;
}

/** Allowlist: only http, https, and mailto URLs for security. */
function safeOpenExternal(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (["http:", "https:", "mailto:"].includes(parsed.protocol)) {
      shell.openExternal(url);
      return true;
    }
  } catch {
    // invalid URL — silently ignore
  }
  return false;
}

function isRendererNavigation(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "file:" || parsed.protocol === "devtools:") {
      return true;
    }
    if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
      return (
        parsed.origin === new URL(process.env["ELECTRON_RENDERER_URL"]).origin
      );
    }
  } catch {
    return false;
  }
  return false;
}

function sendAppNotification(payload: AppNotificationPayload): void {
  mainWindow?.webContents.send("app-notification", {
    ...payload,
    createdAt: payload.createdAt ?? Date.now(),
    tone: payload.tone ?? "info",
  });
}

function showAgentNotification(
  payload: AppNotificationPayload,
  native = false,
): void {
  sendAppNotification(payload);
  if (!native || !Notification.isSupported()) return;
  new Notification({
    title: payload.title,
    body: payload.body,
  }).show();
}

function checkApiHealth(
  url: string,
  apiKey?: string,
): Promise<{ ok: boolean; status: number | null; error?: string }> {
  return new Promise((resolve) => {
    try {
      const healthUrl = new URL("/health", url);
      const mod = healthUrl.protocol === "https:" ? https : http;
      const req = mod.request(
        healthUrl,
        {
          method: "GET",
          timeout: 2500,
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        },
        (res) => {
          res.resume();
          resolve({
            ok: res.statusCode === 200,
            status: res.statusCode || null,
          });
        },
      );
      req.on("error", (error) =>
        resolve({ ok: false, status: null, error: error.message }),
      );
      req.on("timeout", () => {
        req.destroy();
        resolve({ ok: false, status: null, error: "timeout" });
      });
      req.end();
    } catch (error) {
      resolve({
        ok: false,
        status: null,
        error: error instanceof Error ? error.message : "invalid URL",
      });
    }
  });
}

import {
  startBrowserService,
  stopBrowserService,
  navigateTo,
  getBrowserState,
} from "./playwright";
import {
  checkInstallStatus,
  runInstall,
  verifyInstall,
  getHermesVersion,
  clearVersionCache,
  runHermesDoctor,
  runHermesUpdate,
  checkOpenClawExists,
  runClawMigrate,
  runHermesBackup,
  runHermesImport,
  runHermesDump,
  runHermesUpdateCheck,
  runHermesCurator,
  readCuratorReport,
  listMcpServers,
  discoverMemoryProviders,
  readLogs,
  InstallProgress,
  HERMES_HOME,
} from "./installer";
import * as fs from "fs";
import {
  sendMessage,
  startGateway,
  stopGateway,
  isGatewayRunning,
  isRemoteMode,
  testRemoteConnection,
  stopHealthPolling,
  restartGateway,
  getHermesCapabilities,
  startHermesRun,
  getHermesRun,
  stopHermesRun,
} from "./hermes";
import {
  getClaw3dStatus,
  setupClaw3d,
  startDevServer,
  stopDevServer,
  startAdapter,
  stopAdapter,
  startAll as startClaw3dAll,
  stopAll as stopClaw3d,
  getClaw3dLogs,
  setClaw3dPort,
  getClaw3dPort,
  setClaw3dWsUrl,
  getClaw3dWsUrl,
  Claw3dSetupProgress,
} from "./claw3d";
import {
  readEnv,
  setEnvValue,
  getConfigValue,
  setConfigValue,
  getHermesHome,
  getModelConfig,
  setModelConfig,
  getCredentialPool,
  setCredentialPool,
  getConnectionConfig,
  setConnectionConfig,
  getPlatformEnabled,
  setPlatformEnabled,
} from "./config";
import { listSessions, getSessionMessages, searchSessions } from "./sessions";
import {
  syncSessionCache,
  listCachedSessions,
  updateSessionTitle,
} from "./session-cache";
import {
  listModels,
  listModelCatalog,
  addModel,
  removeModel,
  updateModel,
} from "./models";
import {
  listProfiles,
  createProfile,
  deleteProfile,
  setActiveProfile,
  type ProfileCreateOptions,
} from "./profiles";
import {
  readMemory,
  addMemoryEntry,
  updateMemoryEntry,
  removeMemoryEntry,
  writeUserProfile,
} from "./memory";
import { readSoul, writeSoul, resetSoul } from "./soul";
import { getToolsets, setToolsetEnabled } from "./tools";
import {
  listInstalledSkills,
  listBundledSkills,
  getSkillContent,
  installSkill,
  uninstallSkill,
} from "./skills";
import {
  listCronJobs,
  createCronJob,
  removeCronJob,
  pauseCronJob,
  resumeCronJob,
  triggerCronJob,
  type CronCreateOptions,
} from "./cronjobs";
import {
  assignKanbanTask,
  commentKanbanTask,
  createKanbanTask,
  getKanbanDocs,
  getKanbanTask,
  listKanbanBoard,
  nudgeKanbanDispatcher,
  updateKanbanTaskStatus,
  type CreateKanbanTaskInput,
  type KanbanStatus,
} from "./kanban";
import { getSettingsAudit, runSettingsAuditAction } from "./settings-audit";
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
import {
  bootstrapMobileAccess,
  disableTailscaleMobileAccess,
  enableTailscaleMobileAccess,
  getTailscaleMobileStatus,
  rotateTailscaleMobilePairingToken,
} from "./tailscale";
import { getAppLocale, setAppLocale } from "./locale";

process.on("uncaughtException", (err) => {
  console.error("[MAIN UNCAUGHT]", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[MAIN UNHANDLED REJECTION]", reason);
});

let mainWindow: BrowserWindow | null = null;
const activeChatAborts = new Map<string, () => void>();
let profileWatchers: fs.FSWatcher[] = [];
let profileWatchDebounce: NodeJS.Timeout | null = null;

function emitProfilesChanged(source: string): void {
  mainWindow?.webContents.send("profiles-changed", {
    source,
    createdAt: Date.now(),
  });
}

function scheduleProfilesChanged(source: string): void {
  if (profileWatchDebounce) {
    clearTimeout(profileWatchDebounce);
  }
  profileWatchDebounce = setTimeout(() => {
    profileWatchDebounce = null;
    emitProfilesChanged(source);
  }, 250);
}

function stopProfileWatch(): void {
  for (const watcher of profileWatchers) watcher.close();
  profileWatchers = [];
  if (profileWatchDebounce) {
    clearTimeout(profileWatchDebounce);
    profileWatchDebounce = null;
  }
}

function startProfileWatch(): void {
  stopProfileWatch();
  const roots = [HERMES_HOME, join(HERMES_HOME, "profiles")];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    try {
      const watcher = fs.watch(
        root,
        { persistent: false },
        (_event, filename) => {
          const changed = filename ? String(filename) : "";
          if (
            root === HERMES_HOME &&
            changed &&
            changed !== "active_profile" &&
            changed !== "profiles"
          ) {
            return;
          }
          scheduleProfilesChanged("filesystem");
          if (root === HERMES_HOME || changed === "profiles") {
            setTimeout(startProfileWatch, 500);
          }
        },
      );
      watcher.on("error", () => undefined);
      profileWatchers.push(watcher);
    } catch {
      // Profile auto-discovery also has renderer focus/interval fallbacks.
    }
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    transparent: false,
    backgroundColor: "#151816",
    hasShadow: true,
    titleBarStyle: process.platform === "darwin" ? "hidden" : undefined,
    title: "80m Agent Desktop",
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      webviewTag: true,
      autoplayPolicy: "no-user-gesture-required",
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow!.show();
  });

  mainWindow.on("maximize", () => {
    mainWindow?.webContents.send("window-maximized", true);
  });

  mainWindow.on("unmaximize", () => {
    mainWindow?.webContents.send("window-maximized", false);
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error(
      "[CRASH] Renderer process gone:",
      details.reason,
      details.exitCode,
    );
  });

  mainWindow.webContents.on(
    "console-message",
    (_event, level, message, line, sourceId) => {
      if (level >= 2) {
        console.error(`[RENDERER ERROR] ${message} (${sourceId}:${line})`);
      }
    },
  );

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription) => {
      console.error("[LOAD FAIL]", errorCode, errorDescription);
    },
  );

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (safeOpenExternal(details.url)) {
      sendAppNotification({
        title: "Opened outside",
        body: details.url,
        tone: "info",
      });
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isRendererNavigation(url)) return;
    event.preventDefault();
    if (safeOpenExternal(url)) {
      sendAppNotification({
        title: "Opened outside",
        body: url,
        tone: "info",
      });
    }
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

function setupIPC(): void {
  // Installation
  ipcMain.handle("check-install", () => {
    return checkInstallStatus();
  });

  ipcMain.handle("verify-install", () => verifyInstall());

  ipcMain.handle("start-install", async (event) => {
    try {
      await runInstall((progress: InstallProgress) => {
        event.sender.send("install-progress", progress);
      }, mainWindow);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // Hermes engine info
  ipcMain.handle("get-hermes-version", async () => getHermesVersion());
  ipcMain.handle("refresh-hermes-version", async () => {
    clearVersionCache();
    return getHermesVersion();
  });
  ipcMain.handle("run-hermes-doctor", () => runHermesDoctor());
  ipcMain.handle("run-hermes-update", async (event) => {
    try {
      await runHermesUpdate((progress: InstallProgress) => {
        event.sender.send("install-progress", progress);
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
  ipcMain.handle("run-hermes-update-check", () => runHermesUpdateCheck());
  ipcMain.handle("run-safe-hermes-upgrade", async (event, profile?: string) => {
    let log = "";
    const emit = (title: string, detail: string): void => {
      log += `${title}: ${detail}\n`;
      event.sender.send("install-progress", {
        step: 1,
        totalSteps: 3,
        title,
        detail,
        log,
      } satisfies InstallProgress);
    };

    try {
      emit("Backing up 80M", "Creating a pre-upgrade snapshot.");
      const backup = await runHermesBackup(profile);
      if (!backup.success) {
        return {
          success: false,
          error: backup.error || "Backup failed.",
          backup,
        };
      }

      emit("Checking for update", "Running hermes update --check.");
      const check = await runHermesUpdateCheck();

      emit("Updating 80M", "Running runtime update.");
      await runHermesUpdate((progress: InstallProgress) => {
        event.sender.send("install-progress", {
          ...progress,
          step: 3,
          totalSteps: 3,
          log: `${log}${progress.log}`,
        });
      });
      clearVersionCache();

      return {
        success: true,
        backupPath: backup.path,
        updateAvailable: check.updateAvailable,
        checkOutput: check.output,
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
  ipcMain.handle("get-hermes-capabilities", (_event, profile?: string) =>
    getHermesCapabilities(profile),
  );
  ipcMain.handle("get-settings-audit", (_event, profile?: string) =>
    getSettingsAudit(profile),
  );
  ipcMain.handle(
    "run-settings-audit-action",
    (_event, action: string, profile?: string) =>
      runSettingsAuditAction(action, profile),
  );

  // OpenClaw migration
  ipcMain.handle("check-openclaw", () => checkOpenClawExists());
  ipcMain.handle("run-claw-migrate", async (event) => {
    try {
      await runClawMigrate((progress: InstallProgress) => {
        event.sender.send("install-progress", progress);
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // Configuration (profile-aware)
  ipcMain.handle("get-locale", () => getAppLocale());
  ipcMain.handle("set-locale", (_event, locale: "en" | "zh-CN") =>
    setAppLocale(locale),
  );

  ipcMain.handle("get-env", (_event, profile?: string) => readEnv(profile));

  ipcMain.handle(
    "set-env",
    (_event, key: string, value: string, profile?: string) => {
      setEnvValue(key, value, profile);
      // Restart gateway so it picks up the new API key
      if (
        (isGatewayRunning() && key.endsWith("_API_KEY")) ||
        key.endsWith("_TOKEN") ||
        key === "HF_TOKEN"
      ) {
        restartGateway(profile);
      }
      return true;
    },
  );

  ipcMain.handle("get-config", (_event, key: string, profile?: string) =>
    getConfigValue(key, profile),
  );

  ipcMain.handle(
    "set-config",
    (_event, key: string, value: string, profile?: string) => {
      setConfigValue(key, value, profile);
      return true;
    },
  );

  ipcMain.handle("get-hermes-home", (_event, profile?: string) =>
    getHermesHome(profile),
  );

  ipcMain.handle("get-model-config", (_event, profile?: string) =>
    getModelConfig(profile),
  );

  ipcMain.handle(
    "set-model-config",
    (
      _event,
      provider: string,
      model: string,
      baseUrl: string,
      profile?: string,
    ) => {
      const prev = getModelConfig(profile);
      setModelConfig(provider, model, baseUrl, profile);

      // Restart gateway when provider, model, or endpoint changes so it picks up new config
      if (
        isGatewayRunning() &&
        (prev.provider !== provider ||
          prev.model !== model ||
          prev.baseUrl !== baseUrl)
      ) {
        restartGateway(profile);
      }

      return true;
    },
  );

  // Connection mode (local vs remote)
  ipcMain.handle("is-remote-mode", () => isRemoteMode());
  ipcMain.handle("get-connection-config", () => getConnectionConfig());

  ipcMain.handle(
    "set-connection-config",
    (_event, mode: "local" | "remote", remoteUrl: string, apiKey?: string) => {
      setConnectionConfig({ mode, remoteUrl, apiKey: apiKey || "" });
      return true;
    },
  );

  ipcMain.handle(
    "test-remote-connection",
    (_event, url: string, apiKey?: string) => testRemoteConnection(url, apiKey),
  );

  ipcMain.handle("get-tailscale-mobile-status", () =>
    getTailscaleMobileStatus(),
  );
  ipcMain.handle("enable-tailscale-mobile-access", () =>
    enableTailscaleMobileAccess(),
  );
  ipcMain.handle("disable-tailscale-mobile-access", () =>
    disableTailscaleMobileAccess(),
  );
  ipcMain.handle("rotate-tailscale-pairing-token", () =>
    rotateTailscaleMobilePairingToken(),
  );

  ipcMain.handle("get-hermes-health", async (_event, profile?: string) => {
    const install = checkInstallStatus();
    const connection = getConnectionConfig();
    const model = getModelConfig(profile);
    const env = readEnv(profile);
    const credentials = getCredentialPool();
    const credentialProviders = Object.entries(credentials)
      .filter(([, entries]) => entries.length > 0)
      .map(([provider, entries]) => ({ provider, count: entries.length }));
    const apiUrl =
      connection.mode === "remote" && connection.remoteUrl
        ? connection.remoteUrl
        : "http://127.0.0.1:8642";
    const apiKey =
      connection.mode === "remote" ? connection.apiKey : env.API_SERVER_KEY;
    const api = await checkApiHealth(apiUrl, apiKey);

    return {
      install,
      connection: {
        mode: connection.mode,
        remoteUrl: connection.remoteUrl,
        hasRemoteApiKey: Boolean(connection.apiKey),
      },
      gateway: {
        running: isGatewayRunning(),
        apiUrl,
        apiOk: api.ok,
        apiStatus: api.status,
        apiError: api.error || "",
        hasApiServerKey: Boolean(env.API_SERVER_KEY),
      },
      model,
      env: {
        hasMiniMaxKey: Boolean(env.MINIMAX_API_KEY),
        hasMiniMaxCnKey: Boolean(env.MINIMAX_CN_API_KEY),
        hasOpenAIKey: Boolean(env.OPENAI_API_KEY),
        hasXaiKey: Boolean(env.XAI_API_KEY),
        hasDashScopeKey: Boolean(env.DASHSCOPE_API_KEY),
      },
      credentialProviders,
    };
  });

  // Chat — lazy-start gateway on first message
  ipcMain.handle(
    "send-message",
    async (
      event,
      message: string,
      profile?: string,
      resumeSessionId?: string,
      history?: Array<{ role: string; content: string }>,
      activeProject?: string | null,
      requestId?: string,
    ) => {
      if (!isRemoteMode() && !isGatewayRunning()) {
        startGateway(profile);
      }

      const runId =
        requestId ||
        `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      let fullResponse = "";
      const chatStartTime = Date.now();
      let resolveChat: (v: { response: string; sessionId?: string }) => void;
      let rejectChat: (reason?: unknown) => void;
      const promise = new Promise<{ response: string; sessionId?: string }>(
        (res, rej) => {
          resolveChat = res;
          rejectChat = rej;
        },
      );

      const handle = await sendMessage(
        message,
        {
          onChunk: (chunk) => {
            fullResponse += chunk;
            event.sender.send("chat-chunk", chunk, runId);
          },
          onDone: (sessionId) => {
            activeChatAborts.delete(runId);
            event.sender.send("chat-done", sessionId || "", runId);
            resolveChat({ response: fullResponse, sessionId });
            // Desktop notification when window is not focused and response took >10s
            if (
              mainWindow &&
              !mainWindow.isFocused() &&
              Date.now() - chatStartTime > 10000
            ) {
              const preview = fullResponse
                .replace(/[#*_`~\n]+/g, " ")
                .trim()
                .slice(0, 80);
              showAgentNotification(
                {
                  title: "80m Agent",
                  body: preview || "Response ready",
                  tone: "success",
                },
                true,
              );
            }
          },
          onError: (error) => {
            activeChatAborts.delete(runId);
            event.sender.send("chat-error", error, runId);
            rejectChat(new Error(error));
            // Notify on error too if window not focused
            if (mainWindow && !mainWindow.isFocused()) {
              showAgentNotification(
                {
                  title: "80m Agent — Error",
                  body: error.slice(0, 100),
                  tone: "error",
                },
                true,
              );
            }
          },
          onToolProgress: (tool) => {
            event.sender.send("chat-tool-progress", tool, runId);
          },
          onUsage: (usage) => {
            event.sender.send("chat-usage", usage, runId);
          },
        },
        profile,
        resumeSessionId,
        history,
        activeProject,
      );

      activeChatAborts.set(runId, handle.abort);
      return promise;
    },
  );

  ipcMain.handle("abort-chat", (_event, requestId?: string) => {
    if (requestId) {
      activeChatAborts.get(requestId)?.();
      activeChatAborts.delete(requestId);
      return;
    }
    for (const abort of activeChatAborts.values()) {
      abort();
    }
    activeChatAborts.clear();
  });

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
      mainWindow?.webContents.send("workspace-file-changed", payload);
    }),
  );

  ipcMain.handle("unwatch-workspace", () => {
    stopWorkspaceWatch();
    return true;
  });

  // File Sandbox
  ipcMain.handle(
    "copy-file-to-workspace",
    async (_event, sourcePath: string) => {
      try {
        const resolvedSource = resolveExistingLocalPath(sourcePath);
        if (!resolvedSource) return null;
        const cacheDir = join(HERMES_HOME, "cache");
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

  // Gateway
  ipcMain.handle("start-gateway", () => startGateway());
  ipcMain.handle("stop-gateway", () => {
    stopGateway(true);
    return true;
  });
  ipcMain.handle("gateway-status", () => isGatewayRunning());

  // Platform toggles (config.yaml platforms section)
  ipcMain.handle("get-platform-enabled", (_event, profile?: string) =>
    getPlatformEnabled(profile),
  );
  ipcMain.handle(
    "set-platform-enabled",
    (_event, platform: string, enabled: boolean, profile?: string) => {
      setPlatformEnabled(platform, enabled, profile);
      // Restart gateway so it picks up the new platform config
      if (isGatewayRunning()) {
        restartGateway(profile);
      }
      return true;
    },
  );

  // Projects Sidebar IPC
  ipcMain.handle("select-project-directory", async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
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
          // Directories first
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

  // Sessions
  ipcMain.handle("list-sessions", (_event, limit?: number, offset?: number) => {
    return listSessions(limit, offset);
  });

  ipcMain.handle("get-session-messages", (_event, sessionId: string) => {
    return getSessionMessages(sessionId);
  });

  // Profiles
  ipcMain.handle("list-profiles", async () => listProfiles());
  ipcMain.handle(
    "create-profile",
    async (_event, name: string, options?: boolean | ProfileCreateOptions) => {
      const result = await createProfile(name, options);
      if (result.success) emitProfilesChanged("create-profile");
      return result;
    },
  );
  ipcMain.handle("delete-profile", (_event, name: string) => {
    const result = deleteProfile(name);
    if (result.success) emitProfilesChanged("delete-profile");
    return result;
  });
  ipcMain.handle("set-active-profile", (_event, name: string) => {
    setActiveProfile(name);
    emitProfilesChanged("set-active-profile");
    return true;
  });

  // Memory
  ipcMain.handle("read-memory", (_event, profile?: string) =>
    readMemory(profile),
  );
  ipcMain.handle(
    "add-memory-entry",
    (_event, content: string, profile?: string) =>
      addMemoryEntry(content, profile),
  );
  ipcMain.handle(
    "update-memory-entry",
    (_event, index: number, content: string, profile?: string) =>
      updateMemoryEntry(index, content, profile),
  );
  ipcMain.handle(
    "remove-memory-entry",
    (_event, index: number, profile?: string) =>
      removeMemoryEntry(index, profile),
  );
  ipcMain.handle(
    "write-user-profile",
    (_event, content: string, profile?: string) =>
      writeUserProfile(content, profile),
  );

  // Soul
  ipcMain.handle("read-soul", (_event, profile?: string) => readSoul(profile));
  ipcMain.handle("write-soul", (_event, content: string, profile?: string) => {
    return writeSoul(content, profile);
  });
  ipcMain.handle("reset-soul", (_event, profile?: string) =>
    resetSoul(profile),
  );

  // Tools
  ipcMain.handle("get-toolsets", (_event, profile?: string) =>
    getToolsets(profile),
  );
  ipcMain.handle(
    "set-toolset-enabled",
    (_event, key: string, enabled: boolean, profile?: string) => {
      return setToolsetEnabled(key, enabled, profile);
    },
  );

  // Skills
  ipcMain.handle("list-installed-skills", (_event, profile?: string) =>
    listInstalledSkills(profile),
  );
  ipcMain.handle("list-bundled-skills", () => listBundledSkills());
  ipcMain.handle("get-skill-content", (_event, skillPath: string) =>
    getSkillContent(skillPath),
  );
  ipcMain.handle(
    "install-skill",
    (_event, identifier: string, profile?: string) =>
      installSkill(identifier, profile),
  );
  ipcMain.handle("uninstall-skill", (_event, name: string, profile?: string) =>
    uninstallSkill(name, profile),
  );

  // ─── Voice: STT + TTS via Hermes' configured voice stack ────────────────

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
          if (wavPath !== audioPath && fs.existsSync(wavPath))
            fs.unlinkSync(wavPath);
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

  // Session cache (fast local cache with generated titles)
  ipcMain.handle(
    "list-cached-sessions",
    (_event, limit?: number, offset?: number) =>
      listCachedSessions(limit, offset),
  );
  ipcMain.handle("sync-session-cache", () => syncSessionCache());
  ipcMain.handle(
    "update-session-title",
    (_event, sessionId: string, title: string) =>
      updateSessionTitle(sessionId, title),
  );

  // Session search
  ipcMain.handle("search-sessions", (_event, query: string, limit?: number) =>
    searchSessions(query, limit),
  );

  // Credential Pool
  ipcMain.handle("get-credential-pool", () => getCredentialPool());
  ipcMain.handle(
    "set-credential-pool",
    (
      _event,
      provider: string,
      entries: Array<{ key: string; label: string }>,
    ) => {
      setCredentialPool(provider, entries);
      return true;
    },
  );

  // Models
  ipcMain.handle("list-models", () => listModels());
  ipcMain.handle("list-model-catalog", () => listModelCatalog());
  ipcMain.handle(
    "add-model",
    (_event, name: string, provider: string, model: string, baseUrl: string) =>
      addModel(name, provider, model, baseUrl),
  );
  ipcMain.handle("remove-model", (_event, id: string) => removeModel(id));
  ipcMain.handle(
    "update-model",
    (_event, id: string, fields: Record<string, string>) =>
      updateModel(id, fields),
  );

  // 3D Office
  ipcMain.handle("claw3d-status", () => getClaw3dStatus());

  ipcMain.handle("claw3d-setup", async (event) => {
    try {
      await setupClaw3d((progress: Claw3dSetupProgress) => {
        event.sender.send("claw3d-setup-progress", progress);
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle("claw3d-get-port", () => getClaw3dPort());
  ipcMain.handle("claw3d-set-port", (_event, port: number) => {
    setClaw3dPort(port);
    return true;
  });
  ipcMain.handle("claw3d-get-ws-url", () => getClaw3dWsUrl());
  ipcMain.handle("claw3d-set-ws-url", (_event, url: string) => {
    setClaw3dWsUrl(url);
    return true;
  });

  ipcMain.handle("claw3d-start-all", () => startClaw3dAll());
  ipcMain.handle("claw3d-stop-all", () => {
    stopClaw3d();
    return true;
  });
  ipcMain.handle("claw3d-get-logs", () => getClaw3dLogs());

  ipcMain.handle("claw3d-start-dev", () => startDevServer());
  ipcMain.handle("claw3d-stop-dev", () => {
    stopDevServer();
    return true;
  });
  ipcMain.handle("claw3d-start-adapter", () => startAdapter());
  ipcMain.handle("claw3d-stop-adapter", () => {
    stopAdapter();
    return true;
  });

  // Cron Jobs
  ipcMain.handle(
    "list-cron-jobs",
    (_event, includeDisabled?: boolean, profile?: string) =>
      listCronJobs(includeDisabled, profile),
  );
  ipcMain.handle(
    "create-cron-job",
    (
      _event,
      schedule: string,
      prompt?: string,
      name?: string,
      deliver?: string,
      profile?: string,
      options?: CronCreateOptions,
    ) => createCronJob(schedule, prompt, name, deliver, profile, options),
  );
  ipcMain.handle("remove-cron-job", (_event, jobId: string, profile?: string) =>
    removeCronJob(jobId, profile),
  );
  ipcMain.handle("pause-cron-job", (_event, jobId: string, profile?: string) =>
    pauseCronJob(jobId, profile),
  );
  ipcMain.handle("resume-cron-job", (_event, jobId: string, profile?: string) =>
    resumeCronJob(jobId, profile),
  );
  ipcMain.handle(
    "trigger-cron-job",
    (_event, jobId: string, profile?: string) => triggerCronJob(jobId, profile),
  );

  // Kanban
  ipcMain.handle(
    "list-kanban-board",
    (
      _event,
      options?: { board?: string; tenant?: string; includeArchived?: boolean },
    ) => listKanbanBoard(options),
  );
  ipcMain.handle("get-kanban-task", (_event, taskId: string, board?: string) =>
    getKanbanTask(taskId, board),
  );
  ipcMain.handle("create-kanban-task", (_event, input: CreateKanbanTaskInput) =>
    createKanbanTask(input),
  );
  ipcMain.handle(
    "update-kanban-task-status",
    (
      _event,
      taskId: string,
      status: KanbanStatus,
      options?: {
        board?: string;
        reason?: string;
        summary?: string;
        metadata?: Record<string, unknown>;
      },
    ) => updateKanbanTaskStatus(taskId, status, options),
  );
  ipcMain.handle(
    "assign-kanban-task",
    (_event, taskId: string, assignee: string | null, board?: string) =>
      assignKanbanTask(taskId, assignee, board),
  );
  ipcMain.handle(
    "comment-kanban-task",
    (_event, taskId: string, body: string, board?: string) =>
      commentKanbanTask(taskId, body, board),
  );
  ipcMain.handle("nudge-kanban-dispatcher", (_event, board?: string) =>
    nudgeKanbanDispatcher(board),
  );
  ipcMain.handle("get-kanban-docs", () => getKanbanDocs());

  // Shell
  ipcMain.handle("open-external", (_event, url: string) => {
    if (safeOpenExternal(url)) {
      sendAppNotification({
        title: "Opened outside",
        body: url,
        tone: "info",
      });
    }
  });
  ipcMain.handle("window-minimize", () => {
    mainWindow?.minimize();
  });
  ipcMain.handle("window-toggle-maximize", () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
    return mainWindow.isMaximized();
  });
  ipcMain.handle("window-close", () => {
    mainWindow?.close();
  });
  ipcMain.handle(
    "window-is-maximized",
    () => mainWindow?.isMaximized() ?? false,
  );

  // Backup / Import
  ipcMain.handle("run-hermes-backup", (_event, profile?: string) =>
    runHermesBackup(profile),
  );
  ipcMain.handle("select-hermes-import-archive", async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Select Hermes Backup Archive",
      properties: ["openFile"],
      filters: [
        {
          name: "Hermes backup archives",
          extensions: ["zip", "tgz", "gz", "tar"],
        },
        { name: "All files", extensions: ["*"] },
      ],
    });
    return result.canceled ? null : result.filePaths[0] || null;
  });
  ipcMain.handle(
    "run-hermes-import",
    (_event, archivePath: string, profile?: string) =>
      runHermesImport(archivePath, profile),
  );

  // Debug dump
  ipcMain.handle("run-hermes-dump", () => runHermesDump());
  ipcMain.handle(
    "run-hermes-curator",
    (_event, action: string, skill?: string, profile?: string) =>
      runHermesCurator(action, skill, profile),
  );
  ipcMain.handle("read-curator-report", (_event, profile?: string) =>
    readCuratorReport(profile),
  );

  ipcMain.handle(
    "start-hermes-run",
    (
      _event,
      input: string,
      profile?: string,
      options?: {
        sessionId?: string;
        instructions?: string;
        previousResponseId?: string;
        conversationHistory?: Array<{ role: string; content: string }>;
      },
    ) => startHermesRun(input, profile, options),
  );
  ipcMain.handle("get-hermes-run", (_event, runId: string, profile?: string) =>
    getHermesRun(runId, profile),
  );
  ipcMain.handle("stop-hermes-run", (_event, runId: string, profile?: string) =>
    stopHermesRun(runId, profile),
  );

  // MCP servers
  ipcMain.handle("list-mcp-servers", (_event, profile?: string) =>
    listMcpServers(profile),
  );

  // Memory providers
  ipcMain.handle("discover-memory-providers", (_event, profile?: string) =>
    discoverMemoryProviders(profile),
  );

  // Log viewer
  ipcMain.handle("read-logs", (_event, logFile?: string, lines?: number) =>
    readLogs(logFile, lines),
  );

  // Playwright
  ipcMain.handle("start-browser", () => {
    if (mainWindow) {
      return startBrowserService(mainWindow);
    }
    return Promise.resolve();
  });
  ipcMain.handle("stop-browser", () => stopBrowserService());
  ipcMain.handle("navigate-browser", (_event, url: string) => navigateTo(url));
  ipcMain.handle("get-browser-state", () => getBrowserState());
}

function buildMenu(): void {
  buildAppMenu(() => mainWindow, safeOpenExternal);
}

function setupUpdater(): void {
  // IPC handlers must always be registered to avoid invoke errors
  ipcMain.handle("get-app-version", () => app.getVersion());

  if (!app.isPackaged) {
    // Skip auto-update in dev mode
    ipcMain.handle("check-for-updates", async () => null);
    ipcMain.handle("download-update", () => true);
    ipcMain.handle("install-update", () => {});
    return;
  }

  // Dynamic import to avoid electron-updater issues in dev mode
  const { autoUpdater } = require("electron-updater") as {
    autoUpdater: AppUpdater;
  };

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    mainWindow?.webContents.send("update-available", {
      version: info.version,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on("download-progress", (progress) => {
    mainWindow?.webContents.send("update-download-progress", {
      percent: Math.round(progress.percent),
    });
  });

  autoUpdater.on("update-downloaded", () => {
    mainWindow?.webContents.send("update-downloaded");
  });

  autoUpdater.on("error", (err) => {
    mainWindow?.webContents.send("update-error", err.message);
  });

  ipcMain.handle("check-for-updates", async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      return result?.updateInfo?.version || null;
    } catch {
      return null;
    }
  });

  ipcMain.handle("download-update", () => {
    autoUpdater.downloadUpdate();
    return true;
  });

  ipcMain.handle("install-update", () => {
    autoUpdater.quitAndInstall(false, true);
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 5000);
}

app.whenReady().then(() => {
  app.name = "80m Agent Desktop";
  electronApp.setAppUserModelId("com.80m.agent-desktop");

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  buildMenu();
  setupIPC();
  bootstrapMobileAccess().catch((error) => {
    console.error("Failed to bootstrap Tailscale mobile access:", error);
  });
  createWindow();
  startProfileWatch();
  setupUpdater();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    stopGateway();
    stopClaw3d();
    app.quit();
  }
});

app.on("before-quit", () => {
  stopHealthPolling();
  for (const abort of activeChatAborts.values()) {
    abort();
  }
  activeChatAborts.clear();
  stopWorkspaceWatch();
  stopProfileWatch();
  stopGateway();
  stopClaw3d();
  stopBrowserService();
});

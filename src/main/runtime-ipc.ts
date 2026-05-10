import { dialog, ipcMain, type BrowserWindow } from "electron";
import http from "http";
import https from "https";
import {
  getConnectionConfig as readConnectionConfig,
  getConfigValue as readConfigValue,
  getCredentialPool as readCredentialPool,
  getHermesHome,
  getModelConfig,
  getPlatformEnabled,
  readEnv,
  setConfigValue,
  setConnectionConfig,
  setCredentialPool,
  setEnvValue,
  setModelConfig,
  setPlatformEnabled,
} from "./config";
import {
  checkInstallStatus,
  checkOpenClawExists,
  clearVersionCache,
  discoverMemoryProviders,
  getHermesVersion,
  type InstallProgress,
  listMcpServers,
  readCuratorReport,
  readLogs,
  runClawMigrate,
  runHermesBackup,
  runHermesCurator,
  runHermesDoctor,
  runHermesDump,
  runHermesImport,
  runHermesUpdate,
  runHermesUpdateCheck,
  runInstall,
  verifyInstall,
} from "./installer";
import {
  getHermesCapabilities,
  getHermesRun,
  isGatewayRunning,
  isRemoteMode,
  restartGateway,
  startGateway,
  startHermesRun,
  stopGateway,
  stopHermesRun,
  testRemoteConnection,
} from "./hermes";
import { getAppLocale, setAppLocale } from "./locale";
import {
  addModel,
  listModelCatalog,
  listModels,
  removeModel,
  updateModel,
} from "./models";
import { getSettingsAudit, runSettingsAuditAction } from "./settings-audit";
import {
  disableTailscaleMobileAccess,
  enableTailscaleMobileAccess,
  getTailscaleMobileStatus,
  rotateTailscaleMobilePairingToken,
} from "./tailscale";

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

export function registerRuntimeIpc(
  getMainWindow: () => BrowserWindow | null,
): void {
  ipcMain.handle("check-install", () => checkInstallStatus());
  ipcMain.handle("verify-install", () => verifyInstall());

  ipcMain.handle("start-install", async (event) => {
    try {
      await runInstall((progress: InstallProgress) => {
        event.sender.send("install-progress", progress);
      }, getMainWindow());
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

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

  ipcMain.handle("get-locale", () => getAppLocale());
  ipcMain.handle("set-locale", (_event, locale: "en" | "zh-CN") =>
    setAppLocale(locale),
  );
  ipcMain.handle("get-env", (_event, profile?: string) => readEnv(profile));
  ipcMain.handle(
    "set-env",
    (_event, key: string, value: string, profile?: string) => {
      setEnvValue(key, value, profile);
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
    readConfigValue(key, profile),
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

  ipcMain.handle("is-remote-mode", () => isRemoteMode());
  ipcMain.handle("get-connection-config", () => readConnectionConfig());
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
    const connection = readConnectionConfig();
    const model = getModelConfig(profile);
    const env = readEnv(profile);
    const credentials = readCredentialPool();
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

  ipcMain.handle("start-gateway", () => startGateway());
  ipcMain.handle("stop-gateway", () => {
    stopGateway(true);
    return true;
  });
  ipcMain.handle("gateway-status", () => isGatewayRunning());

  ipcMain.handle("get-platform-enabled", (_event, profile?: string) =>
    getPlatformEnabled(profile),
  );
  ipcMain.handle(
    "set-platform-enabled",
    (_event, platform: string, enabled: boolean, profile?: string) => {
      setPlatformEnabled(platform, enabled, profile);
      if (isGatewayRunning()) {
        restartGateway(profile);
      }
      return true;
    },
  );

  ipcMain.handle("get-credential-pool", () => readCredentialPool());
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

  ipcMain.handle("run-hermes-backup", (_event, profile?: string) =>
    runHermesBackup(profile),
  );
  ipcMain.handle("select-hermes-import-archive", async () => {
    const mainWindow = getMainWindow();
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

  ipcMain.handle("list-mcp-servers", (_event, profile?: string) =>
    listMcpServers(profile),
  );
  ipcMain.handle("discover-memory-providers", (_event, profile?: string) =>
    discoverMemoryProviders(profile),
  );
  ipcMain.handle("read-logs", (_event, logFile?: string, lines?: number) =>
    readLogs(logFile, lines),
  );
}

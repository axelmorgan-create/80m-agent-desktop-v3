import { ipcRenderer } from "electron";
import type { HermesAPI } from "./hermes-api.types";

export const hermesRuntimeApi = {
  // Installation
  checkInstall: (): Promise<{
    installed: boolean;
    configured: boolean;
    hasApiKey: boolean;
    verified: boolean;
  }> => ipcRenderer.invoke("check-install"),

  verifyInstall: (): Promise<boolean> => ipcRenderer.invoke("verify-install"),

  startInstall: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("start-install"),

  onInstallProgress: (
    callback: (progress: {
      step: number;
      totalSteps: number;
      title: string;
      detail: string;
      log: string;
    }) => void,
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      progress: unknown,
    ): void =>
      callback(
        progress as {
          step: number;
          totalSteps: number;
          title: string;
          detail: string;
          log: string;
        },
      );
    ipcRenderer.on("install-progress", handler);
    return () => ipcRenderer.removeListener("install-progress", handler);
  },

  // Hermes engine info
  getHermesVersion: (): Promise<string | null> =>
    ipcRenderer.invoke("get-hermes-version"),
  refreshHermesVersion: (): Promise<string | null> =>
    ipcRenderer.invoke("refresh-hermes-version"),
  runHermesDoctor: (): Promise<string> =>
    ipcRenderer.invoke("run-hermes-doctor"),
  runHermesUpdate: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("run-hermes-update"),
  runHermesUpdateCheck: (): Promise<{
    success: boolean;
    updateAvailable: boolean;
    output: string;
    error?: string;
  }> => ipcRenderer.invoke("run-hermes-update-check"),
  runSafeHermesUpgrade: (
    profile?: string,
  ): Promise<{
    success: boolean;
    backupPath?: string;
    updateAvailable?: boolean;
    checkOutput?: string;
    error?: string;
  }> => ipcRenderer.invoke("run-safe-hermes-upgrade", profile),
  getHermesCapabilities: (profile?: string): Promise<unknown> =>
    ipcRenderer.invoke("get-hermes-capabilities", profile),
  getSettingsAudit: (profile?: string): Promise<unknown> =>
    ipcRenderer.invoke("get-settings-audit", profile),
  runSettingsAuditAction: (
    action: string,
    profile?: string,
  ): Promise<unknown> =>
    ipcRenderer.invoke("run-settings-audit-action", action, profile),

  // OpenClaw migration
  checkOpenClaw: (): Promise<{ found: boolean; path: string | null }> =>
    ipcRenderer.invoke("check-openclaw"),
  runClawMigrate: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("run-claw-migrate"),

  getLocale: (): Promise<"en" | "zh-CN"> => ipcRenderer.invoke("get-locale"),
  setLocale: (locale: "en" | "zh-CN"): Promise<"en" | "zh-CN"> =>
    ipcRenderer.invoke("set-locale", locale),

  // Configuration (profile-aware)
  getEnv: (profile?: string): Promise<Record<string, string>> =>
    ipcRenderer.invoke("get-env", profile),

  setEnv: (key: string, value: string, profile?: string): Promise<boolean> =>
    ipcRenderer.invoke("set-env", key, value, profile),

  getConfig: (key: string, profile?: string): Promise<string | null> =>
    ipcRenderer.invoke("get-config", key, profile),

  setConfig: (key: string, value: string, profile?: string): Promise<boolean> =>
    ipcRenderer.invoke("set-config", key, value, profile),

  getHermesHome: (profile?: string): Promise<string> =>
    ipcRenderer.invoke("get-hermes-home", profile),

  getModelConfig: (
    profile?: string,
  ): Promise<{ provider: string; model: string; baseUrl: string }> =>
    ipcRenderer.invoke("get-model-config", profile),

  setModelConfig: (
    provider: string,
    model: string,
    baseUrl: string,
    profile?: string,
  ): Promise<boolean> =>
    ipcRenderer.invoke("set-model-config", provider, model, baseUrl, profile),

  // Connection mode (local vs remote)
  isRemoteMode: (): Promise<boolean> => ipcRenderer.invoke("is-remote-mode"),
  getConnectionConfig: (): Promise<{
    mode: "local" | "remote";
    remoteUrl: string;
    apiKey: string;
  }> => ipcRenderer.invoke("get-connection-config"),

  setConnectionConfig: (
    mode: "local" | "remote",
    remoteUrl: string,
    apiKey?: string,
  ): Promise<boolean> =>
    ipcRenderer.invoke("set-connection-config", mode, remoteUrl, apiKey),

  testRemoteConnection: (url: string, apiKey?: string): Promise<boolean> =>
    ipcRenderer.invoke("test-remote-connection", url, apiKey),
  getHermesHealth: (profile?: string): Promise<unknown> =>
    ipcRenderer.invoke("get-hermes-health", profile),
  getTailscaleMobileStatus: (): Promise<unknown> =>
    ipcRenderer.invoke("get-tailscale-mobile-status"),
  enableTailscaleMobileAccess: (): Promise<unknown> =>
    ipcRenderer.invoke("enable-tailscale-mobile-access"),
  disableTailscaleMobileAccess: (): Promise<unknown> =>
    ipcRenderer.invoke("disable-tailscale-mobile-access"),
  rotateTailscalePairingToken: (): Promise<unknown> =>
    ipcRenderer.invoke("rotate-tailscale-pairing-token"),

  // Gateway
  startGateway: (): Promise<boolean> => ipcRenderer.invoke("start-gateway"),
  stopGateway: (): Promise<boolean> => ipcRenderer.invoke("stop-gateway"),
  gatewayStatus: (): Promise<boolean> => ipcRenderer.invoke("gateway-status"),

  // Platform toggles
  getPlatformEnabled: (profile?: string): Promise<Record<string, boolean>> =>
    ipcRenderer.invoke("get-platform-enabled", profile),
  setPlatformEnabled: (
    platform: string,
    enabled: boolean,
    profile?: string,
  ): Promise<boolean> =>
    ipcRenderer.invoke("set-platform-enabled", platform, enabled, profile),
} as Partial<HermesAPI>;

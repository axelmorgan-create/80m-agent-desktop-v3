import type {
  InstallStatus,
  InstallProgress,
  HermesHealth,
  NotebookLmInstallResult,
  NotebookLmStatus,
  TailscaleMobileStatus,
  HermesCapabilities,
  SettingsAudit,
  SettingsAuditActionResult,
} from "./hermes-api-common.types";

export interface HermesRuntimeAPI {
  // Installation
  checkInstall: () => Promise<InstallStatus>;
  verifyInstall: () => Promise<boolean>;
  startInstall: () => Promise<{ success: boolean; error?: string }>;
  onInstallProgress: (
    callback: (progress: InstallProgress) => void,
  ) => () => void;

  // Hermes engine info
  getHermesVersion: () => Promise<string | null>;
  refreshHermesVersion: () => Promise<string | null>;
  runHermesDoctor: () => Promise<string>;
  runHermesUpdate: () => Promise<{ success: boolean; error?: string }>;
  runHermesUpdateCheck: () => Promise<{
    success: boolean;
    updateAvailable: boolean;
    output: string;
    error?: string;
  }>;
  runSafeHermesUpgrade: (profile?: string) => Promise<{
    success: boolean;
    backupPath?: string;
    updateAvailable?: boolean;
    checkOutput?: string;
    error?: string;
  }>;
  getHermesCapabilities: (profile?: string) => Promise<HermesCapabilities>;
  getSettingsAudit: (profile?: string) => Promise<SettingsAudit>;
  runSettingsAuditAction: (
    action: string,
    profile?: string,
  ) => Promise<SettingsAuditActionResult>;

  // OpenClaw migration
  checkOpenClaw: () => Promise<{ found: boolean; path: string | null }>;
  runClawMigrate: () => Promise<{ success: boolean; error?: string }>;

  getLocale: () => Promise<"en" | "zh-CN">;
  setLocale: (locale: "en" | "zh-CN") => Promise<"en" | "zh-CN">;

  // Configuration (profile-aware)
  getEnv: (profile?: string) => Promise<Record<string, string>>;
  setEnv: (key: string, value: string, profile?: string) => Promise<boolean>;
  getConfig: (key: string, profile?: string) => Promise<string | null>;
  setConfig: (key: string, value: string, profile?: string) => Promise<boolean>;
  getHermesHome: (profile?: string) => Promise<string>;
  getModelConfig: (
    profile?: string,
  ) => Promise<{ provider: string; model: string; baseUrl: string }>;
  setModelConfig: (
    provider: string,
    model: string,
    baseUrl: string,
    profile?: string,
  ) => Promise<boolean>;

  // Connection mode (local vs remote)
  isRemoteMode: () => Promise<boolean>;
  getConnectionConfig: () => Promise<{
    mode: "local" | "remote";
    remoteUrl: string;
    apiKey: string;
  }>;
  setConnectionConfig: (
    mode: "local" | "remote",
    remoteUrl: string,
    apiKey?: string,
  ) => Promise<boolean>;
  testRemoteConnection: (url: string, apiKey?: string) => Promise<boolean>;
  getHermesHealth: (profile?: string) => Promise<HermesHealth>;
  getNotebookLmStatus: () => Promise<NotebookLmStatus>;
  installNotebookLm: () => Promise<NotebookLmInstallResult>;
  openNotebookLmDocs: () => Promise<void>;
  openNotebookLm: () => Promise<void>;
  getTailscaleMobileStatus: () => Promise<TailscaleMobileStatus>;
  enableTailscaleMobileAccess: () => Promise<TailscaleMobileStatus>;
  disableTailscaleMobileAccess: () => Promise<TailscaleMobileStatus>;
  rotateTailscalePairingToken: () => Promise<TailscaleMobileStatus>;

  // Gateway
  startGateway: () => Promise<boolean>;
  stopGateway: () => Promise<boolean>;
  gatewayStatus: () => Promise<boolean>;

  // Platform toggles
  getPlatformEnabled: (profile?: string) => Promise<Record<string, boolean>>;
  setPlatformEnabled: (
    platform: string,
    enabled: boolean,
    profile?: string,
  ) => Promise<boolean>;
}

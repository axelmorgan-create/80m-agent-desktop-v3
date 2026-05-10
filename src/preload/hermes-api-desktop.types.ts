import type {
  CuratorCommandResult,
  HermesRunResult,
  AppNotificationPayload,
} from "./hermes-api-common.types";

export interface HermesDesktopAPI {
  // Shell
  openExternal: (url: string) => Promise<void>;
  windowMinimize: () => Promise<void>;
  windowToggleMaximize: () => Promise<boolean>;
  windowClose: () => Promise<void>;
  windowIsMaximized: () => Promise<boolean>;
  onWindowMaximized: (callback: (isMaximized: boolean) => void) => () => void;
  onAppNotification: (
    callback: (payload: AppNotificationPayload) => void,
  ) => () => void;

  // Backup / Import
  runHermesBackup: (
    profile?: string,
  ) => Promise<{ success: boolean; path?: string; error?: string }>;
  runHermesImport: (
    archivePath: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  selectHermesImportArchive: () => Promise<string | null>;

  // Debug dump
  runHermesDump: () => Promise<string>;
  runHermesCurator: (
    action: string,
    skill?: string,
    profile?: string,
  ) => Promise<CuratorCommandResult>;
  readCuratorReport: (
    profile?: string,
  ) => Promise<CuratorCommandResult["report"]>;
  startHermesRun: (
    input: string,
    profile?: string,
    options?: {
      sessionId?: string;
      instructions?: string;
      previousResponseId?: string;
      conversationHistory?: Array<{ role: string; content: string }>;
    },
  ) => Promise<HermesRunResult>;
  getHermesRun: (runId: string, profile?: string) => Promise<HermesRunResult>;
  stopHermesRun: (runId: string, profile?: string) => Promise<HermesRunResult>;

  // Memory providers
  discoverMemoryProviders: (profile?: string) => Promise<
    Array<{
      name: string;
      description: string;
      installed: boolean;
      active: boolean;
      envVars: string[];
    }>
  >;

  // MCP servers
  listMcpServers: (
    profile?: string,
  ) => Promise<
    Array<{ name: string; type: string; enabled: boolean; detail: string }>
  >;

  // Log viewer
  readLogs: (
    logFile?: string,
    lines?: number,
  ) => Promise<{ content: string; path: string }>;

  // Playwright browser control
  getPathForFile: (file: File) => string;
  copyFileToWorkspace: (sourcePath: string) => Promise<string | null>;
  startBrowser: () => Promise<void>;
  stopBrowser: () => Promise<void>;
  navigateBrowser: (url: string) => Promise<void>;
  getBrowserState: () => Promise<{ url: string } | null>;
  onPlaywrightNavigated: (callback: (url: string) => void) => () => void;

  // Voice
  transcribeAudio: (audioData: number[], mimeType?: string) => Promise<string>;
  ttsSpeak: (text: string) => Promise<string>;
}

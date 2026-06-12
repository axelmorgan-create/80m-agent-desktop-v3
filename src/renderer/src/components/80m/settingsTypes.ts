export interface ModelPreset {
  id: string;
  name: string;
  provider: string;
  model: string;
  baseUrl: string;
}

export type CredentialPool = Record<string, Array<Record<string, unknown>>>;

export interface HermesHealth {
  install: {
    installed: boolean;
    configured: boolean;
    hasApiKey: boolean;
    verified: boolean;
  };
  connection: {
    mode: "local" | "remote";
    remoteUrl: string;
    hasRemoteApiKey: boolean;
  };
  gateway: {
    running: boolean;
    apiUrl: string;
    apiOk: boolean;
    apiStatus: number | null;
    apiError: string;
    hasApiServerKey: boolean;
  };
  model: {
    provider: string;
    model: string;
    baseUrl: string;
  };
  env: Record<string, boolean>;
  credentialProviders: Array<{ provider: string; count: number }>;
}

export interface HermesCapabilities {
  version: string | null;
  semver: string | null;
  isAtLeastV12: boolean;
  updateAvailable: boolean;
  api: {
    ok: boolean;
    status: number | null;
    url: string;
    error?: string;
    features: Record<string, boolean>;
    endpoints: Record<string, { method?: string; path?: string }>;
    models: string[];
  };
  toolGateway: {
    present: boolean;
    available: boolean;
    reason: string;
    managedTools: string[];
  };
  supports: {
    chatCompletions: boolean;
    responses: boolean;
    runs: boolean;
    runEvents: boolean;
    runStop: boolean;
    toolProgress: boolean;
    sessionContinuity: boolean;
    curator: boolean;
  };
}

export interface TailscaleMobileStatus {
  installed: boolean;
  daemonRunning: boolean;
  backendState: string;
  online: boolean;
  dnsName: string;
  tailnetUrl: string;
  pairUrl: string;
  tailscaleIps: string[];
  serveEnabled: boolean;
  serveTarget: string;
  mobileServerRunning: boolean;
  mobileServerPort: number;
  pairingToken: string;
  version: string;
  error: string;
  serveStatus: string;
  noFunnel: true;
}

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

export interface CuratorCommandResult {
  success: boolean;
  supported: boolean;
  output: string;
  error?: string;
  pinned: string[];
  report: {
    reportPath: string | null;
    report: string;
    runJsonPath: string | null;
    runJson: unknown | null;
  };
}

export type SettingsAuditBucket =
  | "needsAttention"
  | "behindUpstream"
  | "ready"
  | "optional"
  | "planGated";

export interface SettingsAuditCard {
  id: string;
  title: string;
  summary: string;
  severity: "ok" | "info" | "warning" | "error";
  category: string;
  source: string;
  details?: string;
  docsUrl?: string;
  commandPreview?: string;
  action?: {
    id: string;
    label: string;
    destructive?: boolean;
  };
}

export interface SettingsAudit {
  profile: string;
  createdAt: number;
  summary: {
    needsAttention: number;
    warnings: number;
    ready: number;
    optional: number;
    planGated: number;
    behindUpstream: number;
  };
  buckets: Record<SettingsAuditBucket, SettingsAuditCard[]>;
  cards: SettingsAuditCard[];
  raw: Record<string, unknown>;
}

export interface SettingsAuditActionResult {
  action: string;
  createdAt: number;
  success: boolean;
  output: string;
  error?: string;
}

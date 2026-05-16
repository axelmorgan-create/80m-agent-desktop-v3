export interface InstallStatus {
  installed: boolean;
  configured: boolean;
  hasApiKey: boolean;
  verified: boolean;
}

export interface InstallProgress {
  step: number;
  totalSteps: number;
  title: string;
  detail: string;
  log: string;
}

export interface HermesHealth {
  install: InstallStatus;
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
  env: {
    hasMiniMaxKey: boolean;
    hasMiniMaxCnKey: boolean;
    hasOpenAIKey: boolean;
    hasXaiKey: boolean;
    hasDashScopeKey: boolean;
  };
  credentialProviders: Array<{ provider: string; count: number }>;
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

export interface NotebookLmStatus {
  cliFound: boolean;
  pythonModuleFound: boolean;
  version: string;
  authFileFound: boolean;
  authFilePath: string;
  authFileUpdatedAt: number | null;
  ready: boolean;
  state: "not_installed" | "needs_auth" | "connected";
  message: string;
  nextAction: string;
}

export interface NotebookLmInstallResult {
  success: boolean;
  output: string;
  error?: string;
}

export type SettingsAuditSeverity = "ok" | "info" | "warning" | "error";

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
  severity: SettingsAuditSeverity;
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
  bucket?: SettingsAuditBucket;
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

export interface HermesRunResult {
  success: boolean;
  runId?: string;
  status?: string;
  sessionId?: string;
  output?: string;
  usage?: unknown;
  error?: string;
  raw?: unknown;
}

export interface WorkspaceFileChange {
  root: string;
  path: string;
  name: string;
  relativePath: string;
  event: string;
  size: number;
  modifiedAt: number;
}

export interface ProfileInfo {
  name: string;
  path: string;
  isDefault: boolean;
  isActive: boolean;
  model: string;
  provider: string;
  hasEnv: boolean;
  hasSoul: boolean;
  skillCount: number;
  gatewayRunning: boolean;
}

export interface ProfileCreateOptions {
  mode?: "clone" | "blank" | "clone-all";
  cloneFrom?: string;
  noAlias?: boolean;
  noSkills?: boolean;
}

export interface ProfileCreateResult {
  success: boolean;
  name?: string;
  profile?: ProfileInfo;
  error?: string;
}

export interface ProfilesChangedEvent {
  source: string;
  createdAt: number;
}

export interface AppNotificationPayload {
  title: string;
  body?: string;
  tone?: "info" | "success" | "warning" | "error";
  createdAt?: number;
}

export type ChatToolProgress =
  | string
  | {
      tool?: string;
      name?: string;
      label?: string;
      preview?: string;
      status?: string;
      toolCallId?: string;
      duration?: number;
      error?: boolean;
    };

export type KanbanStatus =
  | "triage"
  | "todo"
  | "ready"
  | "running"
  | "blocked"
  | "done"
  | "archived";

export interface KanbanTask {
  id: string;
  title: string;
  body: string | null;
  assignee: string | null;
  status: KanbanStatus;
  priority: number;
  tenant: string | null;
  workspace_kind: string;
  workspace_path: string | null;
  created_by: string | null;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
  result: string | null;
  skills: string[];
}

export interface KanbanBoard {
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  db_path?: string;
  is_current?: boolean;
  counts?: Record<string, number>;
  total?: number;
}

export interface KanbanAssignee {
  name: string;
  on_disk: boolean;
  spawnable?: boolean;
  counts: Record<string, number>;
}

export interface KanbanDocs {
  pluginPath: string;
  releaseNotesPath: string;
  overviewPath: string;
  tutorialPath: string;
  workerPath: string;
  orchestratorPath: string;
  specPath: string;
  mediumPagePath: string;
  officialDocsUrl: string;
  officialTutorialUrl: string;
  upstreamPluginUrl: string;
  upstreamReleaseUrl: string;
}

export interface KanbanBoardData {
  tasks: KanbanTask[];
  columns: Record<KanbanStatus, KanbanTask[]>;
  boards: KanbanBoard[];
  assignees: KanbanAssignee[];
  stats: {
    by_status: Record<string, number>;
    by_assignee: Record<string, Record<string, number>>;
    oldest_ready_age_seconds: number | null;
    now: number;
  };
  docs: KanbanDocs;
}

export interface KanbanTaskDetails {
  task: KanbanTask;
  parents: string[];
  children: string[];
  comments: Array<{
    author: string;
    body: string;
    created_at: number;
  }>;
  events: Array<{
    kind: string;
    payload: unknown;
    created_at: number;
    run_id: number | null;
  }>;
  runs: Array<{
    id: number;
    profile: string | null;
    status: string;
    outcome: string | null;
    summary: string | null;
    error: string | null;
    metadata: string | null;
    worker_pid?: number | null;
    started_at: number;
    ended_at: number | null;
  }>;
}

export interface KanbanCommandResult<T = unknown> {
  success: boolean;
  data?: T;
  output?: string;
  error?: string;
}

export interface CreateKanbanTaskInput {
  title: string;
  body?: string;
  assignee?: string;
  tenant?: string;
  priority?: number;
  workspace?: string;
  triage?: boolean;
  parents?: string[];
  skills?: string[];
  maxRuntime?: string;
  board?: string;
}

export interface CronCreateOptions {
  repeat?: number | string;
  skills?: string[];
  script?: string;
  noAgent?: boolean;
  workdir?: string;
}

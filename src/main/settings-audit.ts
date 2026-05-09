import { execFile } from "child_process";
import { existsSync } from "fs";
import { homedir } from "os";
import {
  HERMES_HOME,
  HERMES_PYTHON,
  HERMES_REPO,
  HERMES_SCRIPT,
  checkInstallStatus,
  getEnhancedPath,
  runHermesCurator,
  discoverMemoryProviders,
  listMcpServers,
} from "./installer";
import { getHermesCapabilities } from "./hermes";
import {
  getConnectionConfig,
  getCredentialPool,
  getModelConfig,
  readEnv,
} from "./config";
import { listProfiles, type ProfileInfo } from "./profiles";
import { readMemory } from "./memory";
import { getToolsets } from "./tools";
import { listCronJobs, type CronJob } from "./cronjobs";
import { listKanbanBoard } from "./kanban";
import { getTailscaleMobileStatus } from "./tailscale";
import { stripAnsi } from "./utils";
import {
  buildSettingsAuditBuckets,
  redactSettingsAuditText,
  summarizeSettingsAuditBuckets,
  type SettingsAuditBuckets,
  type SettingsAuditCard,
} from "./settings-audit-utils";

interface CommandResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface SettingsAuditActionResult extends CommandResult {
  action: string;
  createdAt: number;
}

export interface SettingsAudit {
  profile: string;
  createdAt: number;
  summary: ReturnType<typeof summarizeSettingsAuditBuckets>;
  buckets: SettingsAuditBuckets;
  cards: SettingsAuditCard[];
  raw: {
    install: ReturnType<typeof checkInstallStatus>;
    connection: ReturnType<typeof getConnectionConfig>;
    model: ReturnType<typeof getModelConfig>;
    env: Record<string, boolean>;
    credentialProviders: Array<{ provider: string; count: number }>;
    capabilities: Awaited<ReturnType<typeof getHermesCapabilities>>;
    updateCheck: CommandResult;
    doctor: CommandResult;
    status: CommandResult;
    profileShow: CommandResult;
    memoryStatus: CommandResult;
    cronStatus: CommandResult;
    toolsSummary: CommandResult;
    curator: Awaited<ReturnType<typeof runHermesCurator>>;
    profiles: ProfileInfo[];
    memoryProviders: ReturnType<typeof discoverMemoryProviders>;
    memoryStats: Awaited<ReturnType<typeof readMemory>>["stats"] | null;
    toolsets: ReturnType<typeof getToolsets>;
    mcpServers: ReturnType<typeof listMcpServers>;
    cronJobs: CronJob[];
    tailscale: Awaited<ReturnType<typeof getTailscaleMobileStatus>>;
    kanban: Awaited<ReturnType<typeof listKanbanBoard>>;
    kanbanDiagnostics: CommandResult;
  };
}

function hermesArgs(args: string[], profile?: string): string[] {
  const cliArgs = [HERMES_SCRIPT];
  if (profile && profile !== "default") cliArgs.push("-p", profile);
  cliArgs.push(...args);
  return cliArgs;
}

function runHermesCommand(
  args: string[],
  profile?: string,
  timeout = 45000,
): Promise<CommandResult> {
  if (!existsSync(HERMES_PYTHON) || !existsSync(HERMES_SCRIPT)) {
    return Promise.resolve({
      success: false,
      output: "",
      error: "Hermes is not installed.",
    });
  }

  return new Promise((resolve) => {
    execFile(
      HERMES_PYTHON,
      hermesArgs(args, profile),
      {
        cwd: HERMES_REPO,
        env: {
          ...process.env,
          PATH: getEnhancedPath(),
          HOME: homedir(),
          HERMES_HOME,
          TERM: "dumb",
        },
        timeout,
        maxBuffer: 1024 * 1024,
      },
      (error, stdout, stderr) => {
        const output = redactSettingsAuditText(stripAnsi(stdout || ""));
        const cleanError = redactSettingsAuditText(stripAnsi(stderr || ""));
        resolve({
          success: !error,
          output: output || cleanError,
          error: error ? cleanError || error.message : undefined,
        });
      },
    );
  });
}

function envFlags(env: Record<string, string>): Record<string, boolean> {
  return {
    hasApiServerKey: Boolean(env.API_SERVER_KEY?.trim()),
    hasMiniMaxKey: Boolean(env.MINIMAX_API_KEY?.trim()),
    hasMiniMaxCnKey: Boolean(env.MINIMAX_CN_API_KEY?.trim()),
    hasOpenAIKey: Boolean(env.OPENAI_API_KEY?.trim()),
    hasXaiKey: Boolean(env.XAI_API_KEY?.trim()),
    hasDashScopeKey: Boolean(env.DASHSCOPE_API_KEY?.trim()),
    hasOpenRouterKey: Boolean(env.OPENROUTER_API_KEY?.trim()),
    hasGithubToken: Boolean(env.GITHUB_TOKEN?.trim()),
    hasFirecrawlKey: Boolean(env.FIRECRAWL_API_KEY?.trim()),
    hasBrowserUseKey: Boolean(env.BROWSER_USE_API_KEY?.trim()),
    hasFalKey: Boolean(env.FAL_KEY?.trim() || env.FAL_API_KEY?.trim()),
  };
}

function hasSignal(text: string, pattern: RegExp): boolean {
  return pattern.test(text || "");
}

function doctorLooksHealthy(output: string): boolean {
  if (!output.trim()) return false;
  return !hasSignal(output, /(?:✗|error|failed|missing|required|not found)/i);
}

function buildCards(input: {
  profile: string;
  capabilities: Awaited<ReturnType<typeof getHermesCapabilities>>;
  updateCheck: CommandResult;
  doctor: CommandResult;
  status: CommandResult;
  profileShow: CommandResult;
  memoryProviders: ReturnType<typeof discoverMemoryProviders>;
  memoryStatus: CommandResult;
  cronStatus: CommandResult;
  cronJobs: CronJob[];
  mcpServers: ReturnType<typeof listMcpServers>;
  toolsets: ReturnType<typeof getToolsets>;
  curator: Awaited<ReturnType<typeof runHermesCurator>>;
  profiles: ProfileInfo[];
  kanban: Awaited<ReturnType<typeof listKanbanBoard>>;
  kanbanDiagnostics: CommandResult;
  tailscale: Awaited<ReturnType<typeof getTailscaleMobileStatus>>;
  credentialProviders: Array<{ provider: string; count: number }>;
  env: Record<string, boolean>;
}): SettingsAuditCard[] {
  const cards: SettingsAuditCard[] = [];
  const updateText = `${input.capabilities.version || ""}\n${input.updateCheck.output}\n${input.updateCheck.error || ""}`;
  const activeMemory = input.memoryProviders.find(
    (provider) => provider.active,
  );
  const activeProfile = input.profiles.find(
    (item) => item.name === input.profile,
  );
  const kanbanData = input.kanban.success ? input.kanban.data : null;
  const kanbanDiagnosticsText =
    input.kanbanDiagnostics.output || input.kanbanDiagnostics.error || "";

  cards.push({
    id: "runtime-version",
    title: input.capabilities.version || "Hermes runtime",
    summary: input.capabilities.semver
      ? `Profile ${input.profile} is running Hermes ${input.capabilities.semver}.`
      : "Hermes version could not be parsed.",
    severity: input.capabilities.semver ? "ok" : "warning",
    category: "Runtime",
    source: "hermes --version",
    commandPreview: "hermes --version",
  });

  if (
    hasSignal(
      updateText,
      /update available|commits behind|run ['"]?hermes update/i,
    )
  ) {
    cards.push({
      id: "runtime-update",
      title: "Hermes is behind upstream",
      summary:
        "A newer Hermes checkout is available. Keep this manual: backup first, then update.",
      severity: "warning",
      category: "Runtime",
      source: "hermes update --check",
      commandPreview: "hermes backup && hermes update --check && hermes update",
      action: { id: "safe-upgrade", label: "Backup + Update" },
      bucket: "behindUpstream",
    });
  }

  cards.push({
    id: "api-server",
    title: input.capabilities.api.ok
      ? "Authenticated API server is online"
      : "API server needs attention",
    summary: input.capabilities.api.ok
      ? `OpenAI-compatible API is reachable at ${input.capabilities.api.url}.`
      : input.capabilities.api.error ||
        "The desktop could not reach /v1/capabilities.",
    severity: input.capabilities.api.ok ? "ok" : "error",
    category: "API",
    source: "/v1/capabilities",
    docsUrl:
      "https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server/",
    commandPreview:
      "curl -H 'Authorization: Bearer ***' http://127.0.0.1:8642/v1/capabilities",
    action: input.capabilities.api.ok
      ? undefined
      : { id: "restart-gateway", label: "Restart Gateway" },
  });

  cards.push({
    id: "runs-api",
    title: input.capabilities.supports.runs
      ? "Runs API and progress events are ready"
      : "Runs API is unavailable",
    summary: input.capabilities.supports.runs
      ? "Long-running desktop chat can use run status, run events, stop, and tool progress."
      : "Chat should stay on the Chat Completions fallback until Hermes exposes run events.",
    severity: input.capabilities.supports.runs ? "ok" : "warning",
    category: "API",
    source: "/v1/capabilities",
    docsUrl:
      "https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server/",
  });

  if (input.capabilities.supports.sessionContinuity) {
    cards.push({
      id: "session-continuity",
      title: "Session continuity headers are supported",
      summary:
        "The API reports session continuity support, including the v0.13 session key surface for memory-aware clients.",
      severity: "ok",
      category: "API",
      source: "/v1/capabilities",
    });
  }

  cards.push({
    id: "tool-gateway",
    title: input.capabilities.toolGateway.available
      ? "Nous Tool Gateway is available"
      : "Nous Tool Gateway is plan-gated",
    summary: input.capabilities.toolGateway.available
      ? "Managed web, image, TTS, and browser tools can route through Nous."
      : input.capabilities.toolGateway.reason ||
        "The current account does not include managed tools.",
    severity: input.capabilities.toolGateway.available ? "ok" : "info",
    category: "Tools",
    source: "hermes status --all",
    docsUrl:
      "https://hermes-agent.nousresearch.com/docs/user-guide/features/tool-gateway",
    commandPreview: "hermes tools",
    action: { id: "tool-gateway-docs", label: "Open Docs" },
    bucket: input.capabilities.toolGateway.available ? "ready" : "planGated",
  });

  cards.push({
    id: "doctor",
    title: doctorLooksHealthy(input.doctor.output)
      ? "Doctor did not find blocking issues"
      : "Doctor output should be reviewed",
    summary: doctorLooksHealthy(input.doctor.output)
      ? "The latest Hermes doctor run looks clean enough for normal desktop work."
      : "Hermes doctor reported setup output that may need a guided fix.",
    severity: doctorLooksHealthy(input.doctor.output) ? "ok" : "warning",
    category: "Runtime",
    source: "hermes doctor",
    commandPreview: "hermes doctor --fix",
    action: doctorLooksHealthy(input.doctor.output)
      ? { id: "doctor", label: "Run Doctor" }
      : { id: "doctor-fix", label: "Doctor --fix" },
  });

  cards.push({
    id: "profiles",
    title: `${input.profiles.length} Hermes profile${input.profiles.length === 1 ? "" : "s"} discovered`,
    summary: activeProfile
      ? `${activeProfile.name}: ${activeProfile.model || "model unknown"} (${activeProfile.provider || "provider unknown"}), gateway ${activeProfile.gatewayRunning ? "running" : "stopped"}.`
      : input.profileShow.output ||
        "Profile details are available through hermes profile show.",
    severity: activeProfile ? "ok" : "warning",
    category: "Profiles",
    source: "hermes profile list/show",
    docsUrl: "https://hermes-agent.nousresearch.com/docs/user-guide/profiles/",
    commandPreview: `hermes profile show ${input.profile}`,
  });

  cards.push({
    id: "memory-provider",
    title: activeMemory
      ? `External memory provider active: ${activeMemory.name}`
      : "Built-in memory only",
    summary: activeMemory
      ? "Hermes will keep built-in memory active and add provider-backed retrieval."
      : "Built-in MEMORY.md/USER.md is active. External providers are optional for deeper cross-session recall.",
    severity: activeMemory ? "ok" : "info",
    category: "Memory",
    source: "hermes memory status",
    docsUrl:
      "https://hermes-agent.nousresearch.com/docs/user-guide/features/memory-providers/",
    commandPreview: "hermes memory status",
    action: { id: "memory-docs", label: "Memory Docs" },
    bucket: activeMemory ? "ready" : "optional",
  });

  cards.push({
    id: "cron",
    title:
      input.cronJobs.length > 0
        ? `${input.cronJobs.length} scheduled task${input.cronJobs.length === 1 ? "" : "s"}`
        : "No active schedules",
    summary:
      input.cronJobs.length > 0
        ? input.cronStatus.output.split("\n").find(Boolean) ||
          "Cron jobs are configured for this profile."
        : "Cron is available, including v0.13 no-agent watchdog jobs, but nothing is scheduled now.",
    severity: "info",
    category: "Schedules",
    source: "hermes cron status",
    docsUrl:
      "https://hermes-agent.nousresearch.com/docs/user-guide/features/cron/",
    commandPreview: "hermes cron status",
    action: { id: "cron-status", label: "Check Cron" },
    bucket: input.cronJobs.length > 0 ? "ready" : "optional",
  });

  cards.push({
    id: "mcp",
    title:
      input.mcpServers.length > 0
        ? `${input.mcpServers.length} MCP server${input.mcpServers.length === 1 ? "" : "s"} configured`
        : "No MCP servers configured",
    summary:
      input.mcpServers.length > 0
        ? input.mcpServers
            .slice(0, 3)
            .map((server) => `${server.name} (${server.type})`)
            .join(", ")
        : "MCP is ready for local stdio or remote HTTP servers when you add them.",
    severity: input.mcpServers.length > 0 ? "ok" : "info",
    category: "MCP",
    source: "config.yaml mcp_servers",
    docsUrl:
      "https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp",
    commandPreview: "hermes mcp add ...",
    action: { id: "mcp-docs", label: "MCP Docs" },
    bucket: input.mcpServers.length > 0 ? "ready" : "optional",
  });

  cards.push({
    id: "curator",
    title: input.curator.supported
      ? "Curator is available"
      : "Curator is unavailable",
    summary: input.curator.supported
      ? "Agent-authored skills can be reviewed, pinned, archived, restored, pruned, and rolled back."
      : input.curator.error || "Curator status could not be read.",
    severity: input.curator.supported ? "ok" : "warning",
    category: "Curator",
    source: "hermes curator status",
    docsUrl:
      "https://hermes-agent.nousresearch.com/docs/user-guide/features/curator",
    commandPreview: "hermes curator status",
    action: { id: "curator-list-archived", label: "List Archive" },
  });

  const diagnosticsProblem =
    input.kanbanDiagnostics.success &&
    hasSignal(kanbanDiagnosticsText, /warning|error|critical|blocked|stale/i);
  cards.push({
    id: "kanban",
    title: kanbanData
      ? `${kanbanData.boards.length || 1} Kanban board${kanbanData.boards.length === 1 ? "" : "s"}, ${kanbanData.assignees.length} spawnable lane${kanbanData.assignees.length === 1 ? "" : "s"}`
      : "Kanban board diagnostics unavailable",
    summary: kanbanData
      ? "Board state, assignees, stats, and dispatcher diagnostics are available to the desktop."
      : input.kanban.error || "Kanban could not be read.",
    severity: kanbanData && !diagnosticsProblem ? "ok" : "warning",
    category: "Kanban",
    source: "hermes kanban",
    docsUrl:
      "https://hermes-agent.nousresearch.com/docs/user-guide/features/kanban",
    commandPreview:
      "hermes kanban boards list --json && hermes kanban diagnostics --json",
    action: { id: "kanban-diagnostics", label: "Diagnostics" },
  });

  cards.push({
    id: "credentials",
    title:
      input.credentialProviders.length > 0
        ? `${input.credentialProviders.length} credential pool${input.credentialProviders.length === 1 ? "" : "s"} available`
        : "Credential pools are empty",
    summary:
      input.credentialProviders.length > 0
        ? input.credentialProviders
            .map((provider) => `${provider.provider}: ${provider.count}`)
            .join(", ")
        : "Saved OAuth/provider credentials will appear here once configured through Hermes.",
    severity: input.credentialProviders.length > 0 ? "ok" : "info",
    category: "Providers",
    source: "desktop credential pool",
    commandPreview: "hermes model",
    bucket: input.credentialProviders.length > 0 ? "ready" : "optional",
  });

  const activeToolsets = input.toolsets.filter((toolset) => toolset.enabled);
  cards.push({
    id: "toolsets",
    title: `${activeToolsets.length}/${input.toolsets.length} desktop toolsets enabled`,
    summary:
      activeToolsets.length > 0
        ? activeToolsets
            .slice(0, 8)
            .map((toolset) => toolset.key)
            .join(", ")
        : "No desktop toolsets are currently enabled for this profile.",
    severity: activeToolsets.length > 0 ? "ok" : "warning",
    category: "Tools",
    source: "config.yaml toolsets",
    docsUrl:
      "https://hermes-agent.nousresearch.com/docs/user-guide/features/tools/",
    commandPreview: "hermes tools --summary",
    action: { id: "tools-summary", label: "Tool Summary" },
  });

  cards.push({
    id: "tailscale",
    title: input.tailscale.online
      ? "Mobile/Tailscale access is online"
      : "Mobile/Tailscale access is optional",
    summary: input.tailscale.online
      ? input.tailscale.pairUrl ||
        input.tailscale.tailnetUrl ||
        "Tailscale reports online."
      : input.tailscale.error ||
        "Enable mobile access only when you need private network pairing.",
    severity: input.tailscale.error
      ? "warning"
      : input.tailscale.online
        ? "ok"
        : "info",
    category: "Mobile",
    source: "tailscale status",
    bucket: input.tailscale.online ? "ready" : "optional",
  });

  if (
    input.env.hasFirecrawlKey ||
    input.env.hasFalKey ||
    input.env.hasBrowserUseKey
  ) {
    cards.push({
      id: "direct-tool-keys",
      title: "Direct tool provider keys are present",
      summary:
        "The desktop can explain direct-key fallbacks separately from Nous managed tools.",
      severity: "ok",
      category: "Tools",
      source: ".env",
    });
  }

  return cards;
}

export async function getSettingsAudit(
  profile?: string,
): Promise<SettingsAudit> {
  const targetProfile = profile || "default";
  const install = checkInstallStatus();
  const connection = getConnectionConfig();
  const model = getModelConfig(targetProfile);
  const envValues = readEnv(targetProfile);
  const credentials = getCredentialPool();
  const credentialProviders = Object.entries(credentials)
    .filter(([, entries]) => entries.length > 0)
    .map(([provider, entries]) => ({ provider, count: entries.length }));

  const [
    capabilities,
    updateCheck,
    doctor,
    status,
    profileShow,
    memoryStatus,
    cronStatus,
    toolsSummary,
    curator,
    profiles,
    memoryProviders,
    memoryData,
    toolsets,
    mcpServers,
    cronJobs,
    tailscale,
    kanban,
    kanbanDiagnostics,
  ] = await Promise.all([
    getHermesCapabilities(targetProfile),
    runHermesCommand(["update", "--check"], undefined, 60000),
    runHermesCommand(["doctor"], targetProfile, 60000),
    runHermesCommand(["status", "--all"], targetProfile, 60000),
    runHermesCommand(["profile", "show", targetProfile], undefined, 30000),
    runHermesCommand(["memory", "status"], targetProfile, 30000),
    runHermesCommand(["cron", "status"], targetProfile, 30000),
    runHermesCommand(["tools", "--summary"], targetProfile, 30000),
    runHermesCurator("status", undefined, targetProfile),
    listProfiles().catch(() => []),
    Promise.resolve(discoverMemoryProviders(targetProfile)),
    Promise.resolve()
      .then(() => readMemory(targetProfile))
      .catch(() => null),
    Promise.resolve(getToolsets(targetProfile)),
    Promise.resolve(listMcpServers(targetProfile)),
    listCronJobs(true, targetProfile).catch(() => []),
    getTailscaleMobileStatus().catch(() => ({
      installed: false,
      daemonRunning: false,
      backendState: "unknown",
      online: false,
      dnsName: "",
      tailnetUrl: "",
      pairUrl: "",
      tailscaleIps: [],
      serveEnabled: false,
      serveTarget: "",
      mobileServerRunning: false,
      mobileServerPort: 8780,
      pairingToken: "",
      version: "",
      error: "Tailscale status failed.",
      serveStatus: "",
      noFunnel: true as const,
    })),
    listKanbanBoard().catch((error) => ({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    })),
    runHermesCommand(["kanban", "diagnostics", "--json"], targetProfile, 30000),
  ]);

  const cards = buildCards({
    profile: targetProfile,
    capabilities,
    updateCheck,
    doctor,
    status,
    profileShow,
    memoryProviders,
    memoryStatus,
    cronStatus,
    cronJobs,
    mcpServers,
    toolsets,
    curator,
    profiles,
    kanban,
    kanbanDiagnostics,
    tailscale,
    credentialProviders,
    env: envFlags(envValues),
  });
  const buckets = buildSettingsAuditBuckets(cards);

  return {
    profile: targetProfile,
    createdAt: Date.now(),
    summary: summarizeSettingsAuditBuckets(buckets),
    buckets,
    cards,
    raw: {
      install,
      connection,
      model,
      env: envFlags(envValues),
      credentialProviders,
      capabilities,
      updateCheck,
      doctor,
      status,
      profileShow,
      memoryStatus,
      cronStatus,
      toolsSummary,
      curator,
      profiles,
      memoryProviders,
      memoryStats: memoryData?.stats || null,
      toolsets,
      mcpServers,
      cronJobs,
      tailscale,
      kanban,
      kanbanDiagnostics,
    },
  };
}

export async function runSettingsAuditAction(
  action: string,
  profile?: string,
): Promise<SettingsAuditActionResult> {
  const targetProfile = profile || "default";
  const command =
    action === "doctor"
      ? ["doctor"]
      : action === "doctor-fix"
        ? ["doctor", "--fix"]
        : action === "update-check"
          ? ["update", "--check"]
          : action === "restart-gateway"
            ? ["gateway", "restart"]
            : action === "tools-summary"
              ? ["tools", "--summary"]
              : action === "memory-status"
                ? ["memory", "status"]
                : action === "cron-status"
                  ? ["cron", "status"]
                  : action === "curator-list-archived"
                    ? ["curator", "list-archived"]
                    : action === "kanban-diagnostics"
                      ? ["kanban", "diagnostics", "--json"]
                      : action === "kanban-boards"
                        ? ["kanban", "boards", "list", "--json"]
                        : null;

  if (!command) {
    return {
      action,
      createdAt: Date.now(),
      success: false,
      output: "",
      error: `Unknown settings action: ${action}`,
    };
  }

  const result = await runHermesCommand(
    command,
    action === "update-check" ? undefined : targetProfile,
    action === "doctor-fix" || action === "restart-gateway" ? 120000 : 45000,
  );
  return { ...result, action, createdAt: Date.now() };
}

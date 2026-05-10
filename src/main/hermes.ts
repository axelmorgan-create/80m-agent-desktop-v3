import { ChildProcess, spawn } from "child_process";
import {
  existsSync,
  readFileSync,
  unlinkSync,
  mkdirSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import { homedir } from "os";
import {
  HERMES_HOME,
  HERMES_REPO,
  HERMES_PYTHON,
  HERMES_SCRIPT,
  getEnhancedPath,
} from "./installer";
import { readEnv, setEnvValue, getPlatformEnabled } from "./config";
import { applyLongHaulEnv, ensureLongHaulConfig } from "./hermes-long-haul";
import {
  ensureApiServerKey,
  isApiServerReady,
  isRemoteMode,
  testRemoteConnection,
} from "./hermes-api-client";
import {
  isRunsApiReady,
  sendMessageViaApi,
  sendMessageViaCli,
  sendMessageViaRunsApi,
} from "./hermes-chat-transport";
import type { ChatCallbacks, ChatHandle } from "./hermes-types";
export {
  getHermesCapabilities,
  getHermesRun,
  startHermesRun,
  stopHermesRun,
} from "./hermes-runs";
export type {
  ChatCallbacks,
  ChatToolProgress,
  HermesDesktopCapabilities,
  HermesRunStartResult,
  HermesRunStatusResult,
} from "./hermes-types";

export { isRemoteMode, testRemoteConnection };

const PLATFORM_ENV_KEYS: Record<string, string[]> = {
  discord: [
    "DISCORD_BOT_TOKEN",
    "DISCORD_HOME_CHANNEL",
    "DISCORD_HOME_CHANNEL_NAME",
  ],
  telegram: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_HOME_CHANNEL"],
  slack: ["SLACK_BOT_TOKEN", "SLACK_APP_TOKEN", "SLACK_SIGNING_SECRET"],
  whatsapp: ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"],
  signal: ["SIGNAL_PHONE_NUMBER"],
};

function ensureGatewayEnvShim(): string {
  const shimDir = join(HERMES_HOME, "desktop-runtime");
  const shimPath = join(shimDir, "sitecustomize.py");
  if (!existsSync(shimDir)) {
    mkdirSync(shimDir, { recursive: true });
  }

  writeFileSync(
    shimPath,
    [
      '"""80m desktop gateway environment shim."""',
      "import os",
      "try:",
      "    import dotenv",
      "    _original_load_dotenv = dotenv.load_dotenv",
      "    def _load_dotenv_without_disabled_platforms(*args, **kwargs):",
      "        result = _original_load_dotenv(*args, **kwargs)",
      "        disabled = os.getenv('HERMES_DESKTOP_DISABLED_ENV_KEYS', '')",
      "        for key in disabled.split(','):",
      "            key = key.strip()",
      "            if key:",
      "                os.environ.pop(key, None)",
      "        return result",
      "    dotenv.load_dotenv = _load_dotenv_without_disabled_platforms",
      "except Exception:",
      "    pass",
      "",
    ].join("\n"),
    "utf-8",
  );

  return shimDir;
}

function ensureApiServerConfig(): void {
  try {
    setEnvValue("API_SERVER_ENABLED", "true");
    ensureApiServerKey();
  } catch {
    /* non-fatal */
  }
}

// ────────────────────────────────────────────────────
//  Public API: auto-routes to HTTP API or CLI fallback
// ────────────────────────────────────────────────────

let apiServerAvailable: boolean | null = null; // cached after first check
let runsApiAvailable: boolean | null = null; // cached after first capabilities check

export async function sendMessage(
  message: string,
  cb: ChatCallbacks,
  profile?: string,
  resumeSessionId?: string,
  history?: Array<{ role: string; content: string }>,
  activeProject?: string | null,
): Promise<ChatHandle> {
  ensureInitialized();
  const longHaulChanged = ensureLongHaulConfig(profile);
  if (!isRemoteMode() && longHaulChanged && isGatewayRunning()) {
    stopGateway(true);
    startGateway(profile);
    apiServerAvailable = false;
  }

  // Remote mode: always use API, no CLI fallback
  if (isRemoteMode()) {
    return sendMessageViaApi(
      message,
      cb,
      profile,
      resumeSessionId,
      history,
      activeProject,
    );
  }

  // Check API server availability (cache the result, re-check periodically)
  if (apiServerAvailable === null || apiServerAvailable === false) {
    apiServerAvailable = await isApiServerReady(profile);
    if (!apiServerAvailable) runsApiAvailable = false;
  }

  if (apiServerAvailable) {
    if (runsApiAvailable === null) {
      runsApiAvailable = await isRunsApiReady(profile);
    }
    if (runsApiAvailable) {
      return sendMessageViaRunsApi(
        message,
        cb,
        profile,
        resumeSessionId,
        history,
        activeProject,
      );
    }
    return sendMessageViaApi(
      message,
      cb,
      profile,
      resumeSessionId,
      history,
      activeProject,
    );
  }

  // Fallback to CLI
  return sendMessageViaCli(
    message,
    cb,
    profile,
    resumeSessionId,
    activeProject,
  );
}

// Lazy init — called on first sendMessage or gateway start
let _initialized = false;
let _healthCheckInterval: ReturnType<typeof setInterval> | null = null;

function ensureInitialized(): void {
  if (_initialized) return;
  _initialized = true;
  if (!isRemoteMode()) {
    ensureApiServerConfig();
  }
  startHealthPolling();
}

function startHealthPolling(): void {
  if (_healthCheckInterval) return;
  _healthCheckInterval = setInterval(async () => {
    apiServerAvailable = await isApiServerReady();
    // Stop polling once API is confirmed available — only re-check on demand
    if (apiServerAvailable && _healthCheckInterval) {
      clearInterval(_healthCheckInterval);
      _healthCheckInterval = null;
    }
  }, 15000);
}

export function stopHealthPolling(): void {
  if (_healthCheckInterval) {
    clearInterval(_healthCheckInterval);
    _healthCheckInterval = null;
  }
}

// ────────────────────────────────────────────────────
//  Gateway management
// ────────────────────────────────────────────────────

let gatewayProcess: ChildProcess | null = null;
let gatewayStartedByApp = false;

export function startGateway(profile?: string): boolean {
  ensureInitialized();
  ensureLongHaulConfig(profile);
  if (isGatewayRunning()) return false;

  const apiServerKey = ensureApiServerKey(profile);

  // Build gateway env with profile API keys
  const gatewayEnv: Record<string, string> = applyLongHaulEnv({
    ...(process.env as Record<string, string>),
    PATH: getEnhancedPath(),
    HOME: homedir(),
    HERMES_HOME: HERMES_HOME,
    API_SERVER_ENABLED: "true", // Ensure API server starts with gateway
    API_SERVER_KEY: apiServerKey,
  });

  // Inject ALL profile API keys so the gateway can authenticate with any provider.
  const profileEnv = readEnv(profile);
  const platformEnabled = getPlatformEnabled(profile);
  const disabledPlatformKeys = new Set(
    Object.entries(PLATFORM_ENV_KEYS)
      .filter(([platform]) => !platformEnabled[platform])
      .flatMap(([, keys]) => keys),
  );
  for (const key of disabledPlatformKeys) {
    gatewayEnv[key] = "";
  }
  if (disabledPlatformKeys.size > 0) {
    const shimDir = ensureGatewayEnvShim();
    gatewayEnv.HERMES_DESKTOP_DISABLED_ENV_KEYS =
      Array.from(disabledPlatformKeys).join(",");
    gatewayEnv.PYTHONPATH = gatewayEnv.PYTHONPATH
      ? `${shimDir}:${gatewayEnv.PYTHONPATH}`
      : shimDir;
  }
  for (const [key, value] of Object.entries(profileEnv)) {
    if (disabledPlatformKeys.has(key)) continue;
    if (value) {
      gatewayEnv[key] = value;
    }
  }

  gatewayProcess = spawn(HERMES_PYTHON, [HERMES_SCRIPT, "gateway"], {
    cwd: HERMES_REPO,
    env: gatewayEnv,
    stdio: "ignore",
    detached: true,
  });

  gatewayProcess.unref();

  gatewayProcess.on("close", () => {
    gatewayProcess = null;
    gatewayStartedByApp = false;
    apiServerAvailable = false;
    // Restart health polling to detect if gateway comes back
    startHealthPolling();
  });

  gatewayStartedByApp = true;

  // Wait a bit then check if API server came up
  setTimeout(async () => {
    apiServerAvailable = await isApiServerReady(profile);
  }, 3000);

  return true;
}

function readPidFile(): number | null {
  const pidFile = join(HERMES_HOME, "gateway.pid");
  if (!existsSync(pidFile)) return null;
  try {
    const raw = readFileSync(pidFile, "utf-8").trim();
    // PID file can be JSON ({"pid": 1234, ...}) or plain integer
    const parsed = raw.startsWith("{")
      ? JSON.parse(raw).pid
      : parseInt(raw, 10);
    return typeof parsed === "number" && !isNaN(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function stopGateway(force = false): void {
  if (!force && !gatewayStartedByApp) return;

  if (gatewayProcess && !gatewayProcess.killed) {
    gatewayProcess.kill("SIGTERM");
    gatewayProcess = null;
  }
  const pid = readPidFile();
  if (pid) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // already dead
    }
  }
  // Always clear the PID file once we've signalled it. Leaving a stale PID
  // around means the next isGatewayRunning() / stopGateway() call can hit
  // an unrelated process that the OS has since assigned the same PID.
  const pidFile = join(HERMES_HOME, "gateway.pid");
  if (existsSync(pidFile)) {
    try {
      unlinkSync(pidFile);
    } catch {
      // best-effort; will be overwritten on next gateway start
    }
  }
  gatewayStartedByApp = false;
  apiServerAvailable = false;
}

export function isGatewayRunning(): boolean {
  if (gatewayProcess && !gatewayProcess.killed) return true;
  const pid = readPidFile();
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function isApiReady(): boolean {
  return apiServerAvailable === true;
}

export function restartGateway(profile?: string): void {
  if (!gatewayStartedByApp && !isGatewayRunning()) return;
  stopGateway(true);
  setTimeout(() => {
    startGateway(profile);
  }, 500);
}

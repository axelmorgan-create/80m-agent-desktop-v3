import { execFile } from "child_process";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import {
  getMobileAccessConfig,
  ensureMobilePairingToken,
  rotateMobilePairingToken,
  setMobileAccessEnabled,
} from "./config";
import { getEnhancedPath } from "./installer";
import {
  getMobileCompanionLocalUrl,
  getMobileCompanionPort,
  isMobileCompanionRunning,
  startMobileCompanionServer,
  stopMobileCompanionServer,
} from "./mobile-companion";

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

type CommandResult = {
  success: boolean;
  stdout: string;
  stderr: string;
  error?: string;
};

function defaultStatus(error = ""): TailscaleMobileStatus {
  const config = getMobileAccessConfig();
  return {
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
    mobileServerRunning: isMobileCompanionRunning(),
    mobileServerPort: getMobileCompanionPort() || config.port,
    pairingToken: config.pairingToken,
    version: "",
    error,
    serveStatus: "",
    noFunnel: true,
  };
}

function runTailscale(
  args: string[],
  timeoutMs = 12000,
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const socketPath = resolveTailscaleSocketPath();
    execFile(
      "tailscale",
      socketPath ? [`--socket=${socketPath}`, ...args] : args,
      {
        timeout: timeoutMs,
        env: {
          ...process.env,
          PATH: getEnhancedPath(),
        },
      },
      (error, stdout, stderr) => {
        resolve({
          success: !error,
          stdout: stdout.toString(),
          stderr: stderr.toString(),
          error: error
            ? stderr.toString().trim() || error.message || String(error)
            : undefined,
        });
      },
    );
  });
}

function resolveTailscaleSocketPath(): string {
  const home = homedir();
  const candidates = [
    process.env.TS_SOCKET,
    process.env.TAILSCALE_SOCKET,
    "/var/run/tailscale/tailscaled.sock",
    "/run/tailscale/tailscaled.sock",
    join(home, ".local", "run", "tailscale", "tailscaled.sock"),
    join(home, "~", ".local", "run", "tailscale", "tailscaled.sock"),
  ].filter(Boolean) as string[];

  return candidates.find((candidate) => existsSync(candidate)) || "";
}

function parseVersion(output: string): string {
  return (
    output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) || ""
  );
}

function parseServeStatus(
  stdout: string,
  targetPort: number,
): { enabled: boolean; target: string; raw: string } {
  const raw = stdout.trim();
  if (!raw) return { enabled: false, target: "", raw };
  try {
    const data = JSON.parse(raw) as unknown;
    const serialized = JSON.stringify(data);
    const target = `localhost:${targetPort}`;
    return {
      enabled:
        serialized.includes(target) ||
        serialized.includes(`127.0.0.1:${targetPort}`) ||
        serialized.includes(`:${targetPort}`),
      target,
      raw,
    };
  } catch {
    const target = `localhost:${targetPort}`;
    return {
      enabled:
        raw.includes(target) ||
        raw.includes(`127.0.0.1:${targetPort}`) ||
        raw.includes(`:${targetPort}`),
      target,
      raw,
    };
  }
}

function buildPairUrl(tailnetUrl: string, pairingToken: string): string {
  if (!tailnetUrl || !pairingToken) return "";
  return `${tailnetUrl}/?pair=${encodeURIComponent(pairingToken)}`;
}

export async function getTailscaleMobileStatus(): Promise<TailscaleMobileStatus> {
  const config = getMobileAccessConfig();
  const version = await runTailscale(["version"], 5000);
  if (!version.success) {
    return {
      ...defaultStatus(version.error || "Tailscale CLI is not installed."),
      version: parseVersion(version.stdout),
    };
  }

  const status = await runTailscale(["status", "--json"], 8000);
  const base: TailscaleMobileStatus = {
    ...defaultStatus(status.error || ""),
    installed: true,
    version: parseVersion(version.stdout),
    pairingToken: config.pairingToken,
  };

  if (!status.success) {
    return base;
  }

  try {
    const data = JSON.parse(status.stdout) as {
      BackendState?: string;
      Self?: {
        DNSName?: string;
        Online?: boolean;
        TailscaleIPs?: string[];
      };
    };
    const dnsName = (data.Self?.DNSName || "").replace(/\.$/, "");
    const tailnetUrl = dnsName ? `https://${dnsName}` : "";
    const serve = await runTailscale(["serve", "status", "--json"], 8000);
    const serveParsed = serve.success
      ? parseServeStatus(serve.stdout, config.port)
      : { enabled: false, target: "", raw: serve.error || "" };

    return {
      ...base,
      daemonRunning: true,
      backendState: data.BackendState || "unknown",
      online: data.Self?.Online === true || data.BackendState === "Running",
      dnsName,
      tailnetUrl,
      pairUrl: buildPairUrl(tailnetUrl, config.pairingToken),
      tailscaleIps: data.Self?.TailscaleIPs || [],
      serveEnabled: serveParsed.enabled,
      serveTarget: serveParsed.target,
      serveStatus: serveParsed.raw,
      mobileServerRunning: isMobileCompanionRunning(),
      mobileServerPort: getMobileCompanionPort() || config.port,
      error: serve.success ? "" : serve.error || "",
    };
  } catch (error) {
    return {
      ...base,
      daemonRunning: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function enableTailscaleMobileAccess(): Promise<TailscaleMobileStatus> {
  ensureMobilePairingToken();
  const config = getMobileAccessConfig();
  const localServer = await startMobileCompanionServer(config.port);
  if (!localServer.success) {
    return {
      ...(await getTailscaleMobileStatus()),
      error:
        localServer.error || "Could not start the mobile companion server.",
    };
  }

  const target = `localhost:${config.port}`;
  const attempts = [
    ["serve", "--bg", "--yes", "--https=443", target],
    ["serve", "--bg", "--https=443", target],
    ["serve", "--bg", "--yes", target],
    ["serve", "--bg", target],
  ];
  const errors: string[] = [];
  for (const args of attempts) {
    const result = await runTailscale(args, 30000);
    if (result.success) {
      setMobileAccessEnabled(true);
      return getTailscaleMobileStatus();
    }
    if (result.error) errors.push(`${args.join(" ")}: ${result.error}`);
  }

  return {
    ...(await getTailscaleMobileStatus()),
    error: errors.join("\n") || "Tailscale Serve did not start.",
  };
}

export async function disableTailscaleMobileAccess(): Promise<TailscaleMobileStatus> {
  const result = await runTailscale(
    ["serve", "--yes", "--https=443", "off"],
    20000,
  );
  setMobileAccessEnabled(false);
  stopMobileCompanionServer();
  const status = await getTailscaleMobileStatus();
  return {
    ...status,
    error: result.success ? status.error : result.error || status.error,
  };
}

export async function rotateTailscaleMobilePairingToken(): Promise<TailscaleMobileStatus> {
  rotateMobilePairingToken();
  return getTailscaleMobileStatus();
}

export async function bootstrapMobileAccess(): Promise<void> {
  const config = getMobileAccessConfig();
  if (!config.enabled) return;
  await startMobileCompanionServer(config.port);
}

export function getMobileAccessLocalUrl(): string {
  return getMobileCompanionLocalUrl();
}

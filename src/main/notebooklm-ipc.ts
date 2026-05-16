import { execFile } from "child_process";
import { existsSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { ipcMain, shell } from "electron";
import { getEnhancedPath } from "./installer";
import { stripAnsi } from "./utils";

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

interface CommandResult {
  success: boolean;
  output: string;
  error?: string;
}

const NOTEBOOKLM_STORAGE_PATHS = [
  join(homedir(), ".notebooklm", "storage_state.json"),
  join(homedir(), ".notebooklm", "profiles", "default", "storage_state.json"),
];

function runCommand(
  command: string,
  args: string[],
  timeout = 20000,
): Promise<CommandResult> {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        env: {
          ...process.env,
          PATH: getEnhancedPath(),
          HOME: homedir(),
        },
        timeout,
        maxBuffer: 1024 * 1024,
      },
      (error, stdout, stderr) => {
        const output = stripAnsi(`${stdout || ""}${stderr || ""}`.trim());
        resolve({
          success: !error,
          output,
          error: error ? output || error.message : undefined,
        });
      },
    );
  });
}

async function commandExists(command: string): Promise<boolean> {
  const result = await runCommand(
    "/bin/sh",
    ["-lc", `command -v ${command}`],
    5000,
  );
  return result.success && Boolean(result.output.trim());
}

async function getNotebookLmStatus(): Promise<NotebookLmStatus> {
  const [cliFound, moduleCheck] = await Promise.all([
    commandExists("notebooklm"),
    runCommand("python3", [
      "-c",
      "import importlib.util; raise SystemExit(0 if importlib.util.find_spec('notebooklm') else 1)",
    ]),
  ]);
  const pythonModuleFound = moduleCheck.success;

  let version = "";
  if (cliFound) {
    const versionResult = await runCommand("notebooklm", ["--version"], 10000);
    version = versionResult.output.split("\n")[0]?.trim() || "installed";
  }

  const authFilePath =
    NOTEBOOKLM_STORAGE_PATHS.find((path) => existsSync(path)) ||
    NOTEBOOKLM_STORAGE_PATHS[0];
  const authFileFound = existsSync(authFilePath);
  let authFileUpdatedAt: number | null = null;
  if (authFileFound) {
    try {
      authFileUpdatedAt = statSync(authFilePath).mtimeMs;
    } catch {
      authFileUpdatedAt = null;
    }
  }

  const installed = cliFound || pythonModuleFound;
  const ready = installed && authFileFound;
  const state: NotebookLmStatus["state"] = !installed
    ? "not_installed"
    : authFileFound
      ? "connected"
      : "needs_auth";

  return {
    cliFound,
    pythonModuleFound,
    version,
    authFileFound,
    authFilePath,
    authFileUpdatedAt,
    ready,
    state,
    message: !installed
      ? "NotebookLM automation is not installed yet."
      : authFileFound
        ? "NotebookLM automation is installed and has a saved browser session."
        : "NotebookLM automation is installed, but it still needs Google browser authentication.",
    nextAction: !installed
      ? "Install notebooklm-py, then sign in with Google."
      : authFileFound
        ? "Use Foleybot to send source bundles to NotebookLM, or refresh if Google auth expires."
        : "Run the NotebookLM login flow so the local session cookie file can be created.",
  };
}

async function installNotebookLm(): Promise<CommandResult> {
  return runCommand(
    "python3",
    ["-m", "pip", "install", "--user", "notebooklm-py"],
    180000,
  );
}

export function registerNotebookLmIpc(): void {
  ipcMain.handle("notebooklm-get-status", () => getNotebookLmStatus());
  ipcMain.handle("notebooklm-install", () => installNotebookLm());
  ipcMain.handle("notebooklm-open-docs", () =>
    shell.openExternal("https://github.com/teng-lin/notebooklm-py"),
  );
  ipcMain.handle("notebooklm-open-app", () =>
    shell.openExternal("https://notebooklm.google.com/"),
  );
}

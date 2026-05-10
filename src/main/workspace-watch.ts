import * as fs from "fs";
import { basename, dirname, join, relative, resolve } from "path";
import { resolveExistingLocalPath } from "./desktop-config";

export interface WorkspaceFileChange {
  root: string;
  path: string;
  name: string;
  relativePath: string;
  event: string;
  size: number;
  modifiedAt: number;
}

interface WorkspaceWatcherState {
  root: string;
  watchers: Map<string, fs.FSWatcher>;
  pending: Map<string, NodeJS.Timeout>;
  closed: boolean;
  onChange: (payload: WorkspaceFileChange) => void;
}

const MAX_WORKSPACE_WATCH_DIRS = 1200;
const WATCH_IGNORED_DIRS = new Set([
  ".cache",
  ".git",
  ".next",
  ".parcel-cache",
  ".turbo",
  ".vite",
  "android",
  "build",
  "coverage",
  "dist",
  "ios",
  "linux-unpacked",
  "node_modules",
  "out",
  "release",
  "target",
  "vendor",
]);

let workspaceWatcher: WorkspaceWatcherState | null = null;

function shouldIgnoreWatchPath(targetPath: string): boolean {
  const parts = targetPath.split(/[\\/]+/);
  return parts.some(
    (part) =>
      WATCH_IGNORED_DIRS.has(part) ||
      part.endsWith(".asar") ||
      part.endsWith(".tmp"),
  );
}

function resolveWorkspaceRoot(input: string): string | null {
  const resolvedPath = resolveExistingLocalPath(input);
  if (!resolvedPath || !fs.existsSync(resolvedPath)) return null;
  try {
    const stat = fs.statSync(resolvedPath);
    return stat.isDirectory() ? resolvedPath : dirname(resolvedPath);
  } catch {
    return null;
  }
}

function emitWorkspaceFileChange(
  state: WorkspaceWatcherState,
  targetPath: string,
  event: string,
): void {
  if (state.closed || shouldIgnoreWatchPath(targetPath)) return;
  if (!fs.existsSync(targetPath)) return;

  let stat: fs.Stats;
  try {
    stat = fs.statSync(targetPath);
  } catch {
    return;
  }

  if (stat.isDirectory()) {
    watchWorkspaceDirectory(state, targetPath);
    return;
  }
  if (!stat.isFile()) return;

  state.onChange({
    root: state.root,
    path: targetPath,
    name: basename(targetPath),
    relativePath: relative(state.root, targetPath) || basename(targetPath),
    event,
    size: stat.size,
    modifiedAt: stat.mtimeMs,
  });
}

function scheduleWorkspaceFileChange(
  state: WorkspaceWatcherState,
  targetPath: string,
  event: string,
): void {
  if (state.closed || shouldIgnoreWatchPath(targetPath)) return;
  const existing = state.pending.get(targetPath);
  if (existing) clearTimeout(existing);

  const timeout = setTimeout(() => {
    state.pending.delete(targetPath);
    emitWorkspaceFileChange(state, targetPath, event);
  }, 160);
  state.pending.set(targetPath, timeout);
}

function watchWorkspaceDirectory(
  state: WorkspaceWatcherState,
  dirPath: string,
): void {
  if (
    state.closed ||
    state.watchers.has(dirPath) ||
    state.watchers.size >= MAX_WORKSPACE_WATCH_DIRS ||
    shouldIgnoreWatchPath(dirPath)
  ) {
    return;
  }

  let watcher: fs.FSWatcher;
  try {
    watcher = fs.watch(dirPath, { persistent: false }, (event, filename) => {
      if (!filename) return;
      const changedPath = resolve(dirPath, filename.toString());
      scheduleWorkspaceFileChange(state, changedPath, event);
    });
  } catch {
    return;
  }

  watcher.on("error", () => {
    try {
      watcher.close();
    } catch {
      // watcher is already closed
    }
    state.watchers.delete(dirPath);
  });
  state.watchers.set(dirPath, watcher);

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    watchWorkspaceDirectory(state, join(dirPath, entry.name));
    if (state.watchers.size >= MAX_WORKSPACE_WATCH_DIRS) break;
  }
}

export function startWorkspaceWatch(
  targetPath: string,
  onChange: (payload: WorkspaceFileChange) => void,
): boolean {
  stopWorkspaceWatch();
  const root = resolveWorkspaceRoot(targetPath);
  if (!root) return false;

  const state: WorkspaceWatcherState = {
    root,
    watchers: new Map(),
    pending: new Map(),
    closed: false,
    onChange,
  };
  workspaceWatcher = state;
  watchWorkspaceDirectory(state, root);
  return state.watchers.size > 0;
}

export function stopWorkspaceWatch(): void {
  if (!workspaceWatcher) return;
  workspaceWatcher.closed = true;
  for (const timeout of workspaceWatcher.pending.values()) {
    clearTimeout(timeout);
  }
  workspaceWatcher.pending.clear();
  for (const watcher of workspaceWatcher.watchers.values()) {
    try {
      watcher.close();
    } catch {
      // best-effort cleanup
    }
  }
  workspaceWatcher.watchers.clear();
  workspaceWatcher = null;
}

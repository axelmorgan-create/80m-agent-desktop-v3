import { BrowserWindow, ipcMain, screen } from "electron";
import { is } from "@electron-toolkit/utils";
import { join } from "path";

interface DesktopBuddyStatePayload {
  state?: string;
  profile?: string;
  label?: string;
}

interface DesktopBuddyTranscriptPayload {
  text?: string;
  profile?: string;
  label?: string;
  createdAt?: number;
}

interface DesktopBuddyCursorPayload {
  cursor: { x: number; y: number };
  bounds: { x: number; y: number; width: number; height: number };
}

interface RegisterDesktopBuddyIpcOptions {
  getMainWindow: () => BrowserWindow | null;
}

const BUDDY_WIDTH = 292;
const BUDDY_HEIGHT = 352;

let buddyWindow: BrowserWindow | null = null;
let lastBuddyState: DesktopBuddyStatePayload = { state: "default" };
let buddyStateResetTimer: ReturnType<typeof setTimeout> | null = null;

function getBuddyWindowPosition(): { x: number; y: number } {
  const { workArea } = screen.getPrimaryDisplay();
  return {
    x: Math.round(workArea.x + workArea.width - BUDDY_WIDTH - 28),
    y: Math.round(workArea.y + workArea.height - BUDDY_HEIGHT - 34),
  };
}

async function loadBuddyWindow(
  window: BrowserWindow,
  profile?: string,
): Promise<void> {
  const safeProfile = profile || lastBuddyState.profile || "";
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    const buddyUrl = new URL(process.env["ELECTRON_RENDERER_URL"]);
    buddyUrl.searchParams.set("desktopBuddy", "1");
    if (safeProfile) buddyUrl.searchParams.set("profile", safeProfile);
    await window.loadURL(buddyUrl.toString());
    return;
  }

  await window.loadFile(join(__dirname, "../renderer/index.html"), {
    query: {
      desktopBuddy: "1",
      profile: safeProfile,
    },
  });
}

function sendBuddyState(): void {
  if (!buddyWindow || buddyWindow.isDestroyed()) return;
  buddyWindow.webContents.send("desktop-buddy-state", lastBuddyState);
}

export function setDesktopBuddyState(payload: DesktopBuddyStatePayload): void {
  if (buddyStateResetTimer) {
    clearTimeout(buddyStateResetTimer);
    buddyStateResetTimer = null;
  }

  lastBuddyState = {
    ...lastBuddyState,
    ...payload,
    state: payload.state || lastBuddyState.state || "default",
  };
  sendBuddyState();
}

export function flashDesktopBuddyState(
  payload: DesktopBuddyStatePayload,
  durationMs = 1800,
): void {
  if (buddyStateResetTimer) {
    clearTimeout(buddyStateResetTimer);
    buddyStateResetTimer = null;
  }

  const restoreState: DesktopBuddyStatePayload = {
    ...lastBuddyState,
    state: ["processing", "typing", "searching", "error", "job-done"].includes(
      lastBuddyState.state || "",
    )
      ? "default"
      : lastBuddyState.state || "default",
    label: ["processing", "typing", "searching", "error", "job-done"].includes(
      lastBuddyState.state || "",
    )
      ? lastBuddyState.profile || "80M Agent"
      : lastBuddyState.label,
  };
  setDesktopBuddyState(payload);

  buddyStateResetTimer = setTimeout(() => {
    setDesktopBuddyState({
      ...restoreState,
      state: restoreState.state || "default",
    });
    buddyStateResetTimer = null;
  }, durationMs);
}

export async function openDesktopBuddyWindow(
  profile?: string,
): Promise<boolean> {
  if (profile) {
    lastBuddyState = {
      ...lastBuddyState,
      profile,
    };
  }

  if (buddyWindow && !buddyWindow.isDestroyed()) {
    if (buddyWindow.isMinimized()) buddyWindow.restore();
    buddyWindow.show();
    buddyWindow.focus();
    sendBuddyState();
    return true;
  }

  const position = getBuddyWindowPosition();
  buddyWindow = new BrowserWindow({
    width: BUDDY_WIDTH,
    height: BUDDY_HEIGHT,
    minWidth: BUDDY_WIDTH,
    minHeight: BUDDY_HEIGHT,
    maxWidth: BUDDY_WIDTH,
    maxHeight: BUDDY_HEIGHT,
    x: position.x,
    y: position.y,
    show: false,
    frame: false,
    resizable: false,
    movable: true,
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: true,
    autoHideMenuBar: true,
    title: "80m Desktop Buddy",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      autoplayPolicy: "no-user-gesture-required",
    },
  });

  buddyWindow.setAlwaysOnTop(true, "floating");
  try {
    buddyWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } catch {
    // Some Linux window managers do not support workspace pinning.
  }

  buddyWindow.on("closed", () => {
    buddyWindow = null;
  });

  buddyWindow.once("ready-to-show", () => {
    buddyWindow?.show();
    sendBuddyState();
  });

  buddyWindow.webContents.on("did-finish-load", sendBuddyState);

  await loadBuddyWindow(buddyWindow, profile);
  return true;
}

export function closeDesktopBuddyWindow(): boolean {
  if (!buddyWindow || buddyWindow.isDestroyed()) return false;
  buddyWindow.close();
  buddyWindow = null;
  return true;
}

export function registerDesktopBuddyIpc({
  getMainWindow,
}: RegisterDesktopBuddyIpcOptions): void {
  ipcMain.handle("desktop-buddy-open", async (_event, profile?: string) =>
    openDesktopBuddyWindow(profile),
  );

  ipcMain.handle("desktop-buddy-close", () => closeDesktopBuddyWindow());

  ipcMain.handle(
    "desktop-buddy-cursor",
    (): DesktopBuddyCursorPayload | null => {
      if (!buddyWindow || buddyWindow.isDestroyed()) return null;
      return {
        cursor: screen.getCursorScreenPoint(),
        bounds: buddyWindow.getBounds(),
      };
    },
  );

  ipcMain.handle("desktop-buddy-toggle", async (_event, profile?: string) => {
    if (buddyWindow && !buddyWindow.isDestroyed()) {
      return closeDesktopBuddyWindow();
    }
    return openDesktopBuddyWindow(profile);
  });

  ipcMain.handle(
    "desktop-buddy-set-state",
    (_event, payload: DesktopBuddyStatePayload) => {
      setDesktopBuddyState(payload);
    },
  );

  ipcMain.handle("desktop-buddy-focus-main", () => {
    const mainWindow = getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) return false;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    return true;
  });

  ipcMain.handle(
    "desktop-buddy-send-transcript",
    (_event, payload: DesktopBuddyTranscriptPayload) => {
      const text = String(payload?.text || "").trim();
      if (!text) return false;

      const mainWindow = getMainWindow();
      if (!mainWindow || mainWindow.isDestroyed()) return false;

      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send("desktop-buddy-transcript", {
        ...payload,
        text,
        createdAt: payload?.createdAt || Date.now(),
      });
      return true;
    },
  );
}

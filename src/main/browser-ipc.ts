import { ipcMain, type BrowserWindow } from "electron";
import {
  getBrowserState,
  navigateTo,
  startBrowserService,
  stopBrowserService,
} from "./playwright";

export function registerBrowserIpc(
  getMainWindow: () => BrowserWindow | null,
): void {
  ipcMain.handle("start-browser", () => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      return startBrowserService(mainWindow);
    }
    return Promise.resolve();
  });
  ipcMain.handle("stop-browser", () => stopBrowserService());
  ipcMain.handle("navigate-browser", (_event, url: string) => navigateTo(url));
  ipcMain.handle("get-browser-state", () => getBrowserState());
}

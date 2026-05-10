import { ipcMain, Notification, type BrowserWindow } from "electron";
import {
  isGatewayRunning,
  isRemoteMode,
  sendMessage,
  startGateway,
} from "./hermes";

interface AppNotificationPayload {
  title: string;
  body?: string;
  tone?: "info" | "success" | "warning" | "error";
  createdAt?: number;
}

const activeChatAborts = new Map<string, () => void>();

function sendAppNotification(
  getMainWindow: () => BrowserWindow | null,
  payload: AppNotificationPayload,
): void {
  getMainWindow()?.webContents.send("app-notification", {
    ...payload,
    createdAt: payload.createdAt ?? Date.now(),
    tone: payload.tone ?? "info",
  });
}

function showAgentNotification(
  getMainWindow: () => BrowserWindow | null,
  payload: AppNotificationPayload,
  native = false,
): void {
  sendAppNotification(getMainWindow, payload);
  if (!native || !Notification.isSupported()) return;
  new Notification({
    title: payload.title,
    body: payload.body,
  }).show();
}

export function abortActiveChats(): void {
  for (const abort of activeChatAborts.values()) {
    abort();
  }
  activeChatAborts.clear();
}

export function registerChatIpc(
  getMainWindow: () => BrowserWindow | null,
): void {
  ipcMain.handle(
    "send-message",
    async (
      event,
      message: string,
      profile?: string,
      resumeSessionId?: string,
      history?: Array<{ role: string; content: string }>,
      activeProject?: string | null,
      requestId?: string,
    ) => {
      if (!isRemoteMode() && !isGatewayRunning()) {
        startGateway(profile);
      }

      const runId =
        requestId ||
        `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      let fullResponse = "";
      const chatStartTime = Date.now();
      let resolveChat: (v: { response: string; sessionId?: string }) => void;
      let rejectChat: (reason?: unknown) => void;
      const promise = new Promise<{ response: string; sessionId?: string }>(
        (res, rej) => {
          resolveChat = res;
          rejectChat = rej;
        },
      );

      const handle = await sendMessage(
        message,
        {
          onChunk: (chunk) => {
            fullResponse += chunk;
            event.sender.send("chat-chunk", chunk, runId);
          },
          onDone: (sessionId) => {
            activeChatAborts.delete(runId);
            event.sender.send("chat-done", sessionId || "", runId);
            resolveChat({ response: fullResponse, sessionId });
            const mainWindow = getMainWindow();
            if (
              mainWindow &&
              !mainWindow.isFocused() &&
              Date.now() - chatStartTime > 10000
            ) {
              const preview = fullResponse
                .replace(/[#*_`~\n]+/g, " ")
                .trim()
                .slice(0, 80);
              showAgentNotification(
                getMainWindow,
                {
                  title: "80m Agent",
                  body: preview || "Response ready",
                  tone: "success",
                },
                true,
              );
            }
          },
          onError: (error) => {
            activeChatAborts.delete(runId);
            event.sender.send("chat-error", error, runId);
            rejectChat(new Error(error));
            const mainWindow = getMainWindow();
            if (mainWindow && !mainWindow.isFocused()) {
              showAgentNotification(
                getMainWindow,
                {
                  title: "80m Agent - Error",
                  body: error.slice(0, 100),
                  tone: "error",
                },
                true,
              );
            }
          },
          onToolProgress: (tool) => {
            event.sender.send("chat-tool-progress", tool, runId);
          },
          onUsage: (usage) => {
            event.sender.send("chat-usage", usage, runId);
          },
        },
        profile,
        resumeSessionId,
        history,
        activeProject,
      );

      activeChatAborts.set(runId, handle.abort);
      return promise;
    },
  );

  ipcMain.handle("abort-chat", (_event, requestId?: string) => {
    if (requestId) {
      activeChatAborts.get(requestId)?.();
      activeChatAborts.delete(requestId);
      return;
    }
    abortActiveChats();
  });
}

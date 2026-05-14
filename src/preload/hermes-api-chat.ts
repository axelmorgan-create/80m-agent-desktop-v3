import { ipcRenderer } from "electron";
import type { HermesAPI } from "./hermes-api.types";

export const hermesChatApi = {
  // Chat
  sendMessage: (
    message: string,
    profile?: string,
    resumeSessionId?: string,
    history?: Array<{ role: string; content: string }>,
    activeProject?: string | null,
    requestId?: string,
  ): Promise<{ response: string; sessionId?: string }> =>
    ipcRenderer.invoke(
      "send-message",
      message,
      profile,
      resumeSessionId,
      history,
      activeProject,
      requestId,
    ),

  abortChat: (requestId?: string): Promise<void> =>
    ipcRenderer.invoke("abort-chat", requestId),
  openLocalPath: (path: string): Promise<boolean> =>
    ipcRenderer.invoke("open-local-path", path),
  revealLocalPath: (path: string): Promise<boolean> =>
    ipcRenderer.invoke("reveal-local-path", path),
  readDocumentPreview: (path: string): Promise<unknown> =>
    ipcRenderer.invoke("read-document-preview", path),
  writeDocumentContent: (
    path: string,
    content: string,
  ): Promise<{ success: boolean; error?: string; path?: string }> =>
    ipcRenderer.invoke("write-document-content", path, content),
  watchWorkspace: (path: string): Promise<boolean> =>
    ipcRenderer.invoke("watch-workspace", path),
  unwatchWorkspace: (): Promise<boolean> =>
    ipcRenderer.invoke("unwatch-workspace"),
  onWorkspaceFileChanged: (
    callback: (change: {
      root: string;
      path: string;
      name: string;
      relativePath: string;
      event: string;
      size: number;
      modifiedAt: number;
    }) => void,
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      change: {
        root: string;
        path: string;
        name: string;
        relativePath: string;
        event: string;
        size: number;
        modifiedAt: number;
      },
    ): void => callback(change);
    ipcRenderer.on("workspace-file-changed", handler);
    return () => ipcRenderer.removeListener("workspace-file-changed", handler);
  },

  onChatChunk: (
    callback: (chunk: string, requestId?: string) => void,
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      chunk: string,
      requestId?: string,
    ): void => callback(chunk, requestId);
    ipcRenderer.on("chat-chunk", handler);
    return () => ipcRenderer.removeListener("chat-chunk", handler);
  },

  onChatDone: (
    callback: (sessionId?: string, requestId?: string) => void,
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      sessionId?: string,
      requestId?: string,
    ): void => callback(sessionId, requestId);
    ipcRenderer.on("chat-done", handler);
    return () => ipcRenderer.removeListener("chat-done", handler);
  },

  onChatToolProgress: (
    callback: (
      tool:
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
          },
      requestId?: string,
    ) => void,
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      tool: string,
      requestId?: string,
    ): void => callback(tool, requestId);
    ipcRenderer.on("chat-tool-progress", handler);
    return () => ipcRenderer.removeListener("chat-tool-progress", handler);
  },

  onChatUsage: (
    callback: (usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      cost?: number;
      rateLimitRemaining?: number;
      rateLimitReset?: number;
    }) => void,
  ): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, usage: unknown): void =>
      callback(
        usage as {
          promptTokens: number;
          completionTokens: number;
          totalTokens: number;
          cost?: number;
          rateLimitRemaining?: number;
          rateLimitReset?: number;
        },
      );
    ipcRenderer.on("chat-usage", handler);
    return () => ipcRenderer.removeListener("chat-usage", handler);
  },

  onChatError: (
    callback: (error: string, requestId?: string) => void,
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      error: string,
      requestId?: string,
    ): void => callback(error, requestId);
    ipcRenderer.on("chat-error", handler);
    return () => ipcRenderer.removeListener("chat-error", handler);
  },

  getSessionProfiles: async (): Promise<Record<string, string>> => {
    return ipcRenderer.invoke("get-session-profiles");
  },
} as Partial<HermesAPI>;

import type {
  WorkspaceFileChange,
  ChatToolProgress,
} from "./hermes-api-common.types";

export interface HermesChatAPI {
  // Chat
  sendMessage: (
    message: string,
    profile?: string,
    resumeSessionId?: string,
    history?: Array<{ role: string; content: string }>,
    activeProject?: string | null,
    requestId?: string,
  ) => Promise<{ response: string; sessionId?: string }>;
  abortChat: (requestId?: string) => Promise<void>;
  openLocalPath: (path: string) => Promise<boolean>;
  revealLocalPath: (path: string) => Promise<boolean>;
  readDocumentPreview: (path: string) => Promise<{
    path: string;
    name: string;
    exists: boolean;
    kind:
      | "text"
      | "markdown"
      | "image"
      | "pdf"
      | "office"
      | "directory"
      | "binary"
      | "missing";
    size: number;
    fileUrl?: string;
    content?: string;
    truncated?: boolean;
    error?: string;
  }>;
  writeDocumentContent: (
    path: string,
    content: string,
  ) => Promise<{ success: boolean; error?: string; path?: string }>;
  watchWorkspace: (path: string) => Promise<boolean>;
  unwatchWorkspace: () => Promise<boolean>;
  onWorkspaceFileChanged: (
    callback: (change: WorkspaceFileChange) => void,
  ) => () => void;
  onChatChunk: (
    callback: (chunk: string, requestId?: string) => void,
  ) => () => void;
  onChatDone: (
    callback: (sessionId?: string, requestId?: string) => void,
  ) => () => void;
  onChatToolProgress: (
    callback: (tool: ChatToolProgress, requestId?: string) => void,
  ) => () => void;
  onChatUsage: (
    callback: (usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      cost?: number;
      rateLimitRemaining?: number;
      rateLimitReset?: number;
    }) => void,
  ) => () => void;
  onChatError: (
    callback: (error: string, requestId?: string) => void,
  ) => () => void;
  getSessionProfiles: () => Promise<Record<string, string>>;
}

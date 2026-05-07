import React, { useState, useEffect, useCallback, useRef } from "react";
import { FileUp } from "lucide-react";
import Messages from "./Messages";
import InputBar from "./InputBar";
import type { Message } from "./Messages";

interface ChatAreaProps {
  currentSession: string | null;
  onNewSession: () => void;
  onSessionChange?: (sessionId: string | null) => void;
  profile?: string;
  activeProject?: string | null;
}

interface ActiveRequest {
  id: string;
  sessionId: string | null;
  localKey: string;
  response: string;
}

interface DroppedAttachment {
  name: string;
  path: string;
}

type ChatToolProgressPayload =
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
    };

interface NormalizedToolProgress {
  idPart: string;
  tool: string;
  label: string;
  status: "running" | "completed" | "error" | "reasoning";
  preview?: string;
  duration?: number;
  error?: boolean;
}

function localFileUrl(filePath: string): string {
  return `file://${filePath.split("/").map(encodeURIComponent).join("/")}`;
}

function hasDraggedFiles(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types || []).includes("Files");
}

function fileUriToPath(uri: string): string {
  try {
    const parsed = new URL(uri);
    if (parsed.protocol !== "file:") return "";
    return decodeURIComponent(parsed.pathname);
  } catch {
    return "";
  }
}

function pathBasename(filePath: string): string {
  return filePath.split(/[\\/]/).filter(Boolean).pop() || filePath;
}

function buildAttachmentDraft(attachments: DroppedAttachment[]): string {
  const label = attachments.length === 1 ? "Attached file" : "Attached files";
  const files = attachments
    .map((attachment) => `- ${attachment.name}: ${attachment.path}`)
    .join("\n");
  return `[${label}]\n${files}\n\nUse the file paths above when you need to inspect the dropped content.`;
}

function plainSpeechText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*#_~>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function messageSignature(msg: Message): string {
  return [
    msg.role,
    msg.content,
    msg.tool_name || "",
    msg.tool_calls || "",
  ].join("\u001f");
}

function mergeMessages(base: Message[], overlay: Message[]): Message[] {
  const seen = new Set(base.map(messageSignature));
  const merged = [...base];
  for (const msg of overlay) {
    const byId = merged.findIndex((item) => item.id === msg.id);
    if (byId >= 0) {
      merged[byId] = { ...merged[byId], ...msg };
      seen.add(messageSignature(merged[byId]));
      continue;
    }
    const signature = messageSignature(msg);
    if (seen.has(signature)) continue;
    seen.add(signature);
    merged.push(msg);
  }
  return merged;
}

function upsertMessage(messages: Message[], msg: Message): Message[] {
  const index = messages.findIndex((item) => item.id === msg.id);
  if (index < 0) return [...messages, msg];
  return [
    ...messages.slice(0, index),
    { ...messages[index], ...msg },
    ...messages.slice(index + 1),
  ];
}

function normalizeToolProgress(
  payload: ChatToolProgressPayload,
): NormalizedToolProgress {
  if (typeof payload === "string") {
    const label = payload.trim() || "Tool activity";
    const completed = /\bcomplete(?:d)?\b/i.test(label);
    const tool = label.replace(/\s+complete(?:d)?$/i, "").trim() || label;
    return {
      idPart: `${tool}-${completed ? "completed" : "running"}`,
      tool,
      label,
      status: completed ? "completed" : "running",
    };
  }

  const tool = (payload.tool || payload.name || "").trim();
  const label = (
    payload.label ||
    payload.preview ||
    tool ||
    "Tool activity"
  ).trim();
  const rawStatus = (payload.status || "").toLowerCase();
  const status =
    payload.error || rawStatus === "error"
      ? "error"
      : rawStatus === "completed" || rawStatus === "complete"
        ? "completed"
        : rawStatus === "reasoning"
          ? "reasoning"
          : "running";

  return {
    idPart: payload.toolCallId || `${tool || label}-${status}`,
    tool: tool || label,
    label,
    status,
    preview: payload.preview,
    duration: payload.duration,
    error: payload.error,
  };
}

function makeAssistantMessage(req: ActiveRequest): Message | null {
  if (!req.response) return null;
  return {
    id: `assistant-${req.id}`,
    role: "assistant",
    content: req.response,
  };
}

function makeToolProgressMessage(
  req: ActiveRequest,
  payload: ChatToolProgressPayload,
): Message {
  const progress = normalizeToolProgress(payload);
  const content = {
    status: progress.status,
    tool: progress.tool,
    label: progress.label,
    preview: progress.preview,
    duration: progress.duration,
    error: progress.error,
  };

  return {
    id: `tool-progress-${req.id}-${progress.idPart}`,
    role: "tool",
    content: JSON.stringify(content),
    tool_name: progress.tool,
    tool_calls: JSON.stringify({
      status: progress.status,
      preview: progress.label,
      duration: progress.duration,
      error: progress.error,
    }),
  };
}

const ChatArea: React.FC<ChatAreaProps> = ({
  currentSession,
  onNewSession,
  onSessionChange,
  profile,
  activeProject,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingRequestId, setLoadingRequestId] = useState<string | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [draftInsert, setDraftInsert] = useState<{
    id: string;
    text: string;
  } | null>(null);

  const messagesRef = useRef<Message[]>([]);
  const currentSessionRef = useRef<string | null>(currentSession);
  const activeRequestsRef = useRef<Record<string, ActiveRequest>>({});
  const visibleRequestIdRef = useRef<string | null>(null);
  const pendingMessagesRef = useRef<Record<string, Message[]>>({});
  const dragDepthRef = useRef(0);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    currentSessionRef.current = currentSession;
  }, [currentSession]);

  const playDoneSound = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch (_) {
      // Audio not available.
    }
  }, []);

  const showToast = useCallback(
    (
      title: string,
      body: string,
      tone: "info" | "success" | "warning" | "error" = "info",
    ) => {
      window.dispatchEvent(
        new CustomEvent("desktop-toast", {
          detail: { title, body, tone },
        }),
      );
    },
    [],
  );

  const playBrowserTTS = useCallback((text: string) => {
    try {
      if (!window.speechSynthesis) return false;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 0.95;
      utterance.onstart = () =>
        window.dispatchEvent(new CustomEvent("agent-speaking-start"));
      utterance.onend = () =>
        window.dispatchEvent(new CustomEvent("agent-speaking-stop"));
      utterance.onerror = () =>
        window.dispatchEvent(new CustomEvent("agent-speaking-stop"));
      window.speechSynthesis.speak(utterance);
      return true;
    } catch (err) {
      console.warn("Browser TTS failed:", err);
      return false;
    }
  }, []);

  const playTTS = useCallback(
    async (text: string) => {
      const clean = plainSpeechText(text);
      if (!clean) return;

      window.dispatchEvent(new CustomEvent("agent-speaking-start"));
      try {
        const audioPath = await window.hermesAPI?.ttsSpeak(clean);
        if (audioPath) {
          const audio = new Audio(localFileUrl(audioPath));
          audio.volume = 0.9;
          audio.onended = () =>
            window.dispatchEvent(new CustomEvent("agent-speaking-stop"));
          audio.onerror = () => {
            window.dispatchEvent(new CustomEvent("agent-speaking-stop"));
            playBrowserTTS(clean);
          };
          await audio.play();
          return;
        }
      } catch (err) {
        console.warn("Hermes TTS failed:", err);
      }

      window.dispatchEvent(new CustomEvent("agent-speaking-stop"));
      playBrowserTTS(clean);
    },
    [playBrowserTTS],
  );

  const playTypingSound = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "square";
      osc.frequency.setValueAtTime(150 + Math.random() * 50, ctx.currentTime);

      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.05);
    } catch (_) {
      // Audio not available.
    }
  }, []);

  const findRequestForSession = useCallback((targetSession: string | null) => {
    return Object.values(activeRequestsRef.current).find((req) =>
      targetSession ? req.sessionId === targetSession : req.sessionId === null,
    );
  }, []);

  const resolveRequest = useCallback((requestId?: string) => {
    if (requestId && activeRequestsRef.current[requestId]) {
      return activeRequestsRef.current[requestId];
    }
    return Object.values(activeRequestsRef.current)[0] || null;
  }, []);

  const syncVisibleLoading = useCallback(
    (targetSession: string | null = currentSessionRef.current) => {
      const visibleReq = findRequestForSession(targetSession);
      visibleRequestIdRef.current = visibleReq?.id || null;
      setLoadingRequestId(visibleReq?.id || null);
    },
    [findRequestForSession],
  );

  const cacheOverlayMessage = useCallback((key: string, msg: Message) => {
    pendingMessagesRef.current[key] = upsertMessage(
      pendingMessagesRef.current[key] || [],
      msg,
    );
  }, []);

  const buildOverlayMessages = useCallback((targetSession: string | null) => {
    const direct =
      targetSession !== null
        ? pendingMessagesRef.current[targetSession] || []
        : [];
    const active = Object.values(activeRequestsRef.current)
      .filter((req) =>
        targetSession
          ? req.sessionId === targetSession
          : req.sessionId === null,
      )
      .flatMap((req) => {
        const pending =
          req.localKey === targetSession
            ? []
            : pendingMessagesRef.current[req.localKey] || [];
        const assistant = makeAssistantMessage(req);
        return assistant ? [...pending, assistant] : pending;
      });
    return mergeMessages(direct, active);
  }, []);

  const loadSession = useCallback(
    async (id: string) => {
      if (!window.hermesAPI) return;
      try {
        const msgs = await window.hermesAPI.getSessionMessages(id);
        const loaded = (msgs || []).map((m, i) => ({
          id: `${id}-${m.id || i}`,
          role: m.role as "user" | "assistant" | "system" | "tool",
          content: m.content,
          tool_calls: m.tool_calls,
          tool_name: m.tool_name,
        }));

        setMessages(mergeMessages(loaded, buildOverlayMessages(id)));
      } catch (_) {
        // Session load failures leave the current view unchanged.
      }
    },
    [buildOverlayMessages],
  );

  useEffect(() => {
    const req = findRequestForSession(currentSession);
    visibleRequestIdRef.current = req?.id || null;
    setLoadingRequestId(req?.id || null);

    if (currentSession) {
      loadSession(currentSession);
    } else {
      setMessages(req ? buildOverlayMessages(null) : []);
    }
  }, [
    buildOverlayMessages,
    currentSession,
    findRequestForSession,
    loadSession,
  ]);

  useEffect(() => {
    const container = document.querySelector(".messages-80m");
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, loadingRequestId]);

  useEffect(() => {
    if (!window.hermesAPI) return;

    const cleanupChunk = window.hermesAPI.onChatChunk(
      (chunk: string, requestId?: string) => {
        const req = resolveRequest(requestId);
        if (!req) return;
        req.response += chunk;
        if (visibleRequestIdRef.current !== req.id) return;

        playTypingSound();
        setMessages((prev) => {
          const assistant = makeAssistantMessage(req);
          return assistant ? upsertMessage(prev, assistant) : prev;
        });
      },
    );

    const cleanupToolProgress = window.hermesAPI.onChatToolProgress(
      (tool: ChatToolProgressPayload, requestId?: string) => {
        const req = resolveRequest(requestId);
        if (!req) return;

        const toolMsg = makeToolProgressMessage(req, tool);
        cacheOverlayMessage(req.localKey, toolMsg);
        if (visibleRequestIdRef.current !== req.id) return;
        setMessages((prev) => upsertMessage(prev, toolMsg));
      },
    );

    const cleanupDone = window.hermesAPI.onChatDone(
      (newSessionId: string | undefined, requestId?: string) => {
        const req = resolveRequest(requestId);
        if (!req) return;

        const isVisible = visibleRequestIdRef.current === req.id;
        const resolvedSessionId = newSessionId || req.sessionId || null;
        const finalAssistant = makeAssistantMessage(req);
        if (resolvedSessionId) {
          const finalMessages = [
            ...(pendingMessagesRef.current[req.localKey] || []),
            ...(finalAssistant ? [finalAssistant] : []),
          ];
          pendingMessagesRef.current[resolvedSessionId] = mergeMessages(
            pendingMessagesRef.current[resolvedSessionId] || [],
            finalMessages,
          );
        }
        if (resolvedSessionId !== req.localKey) {
          delete pendingMessagesRef.current[req.localKey];
        }
        delete activeRequestsRef.current[req.id];
        syncVisibleLoading();
        window.dispatchEvent(new CustomEvent("sessions-updated"));
        window.dispatchEvent(
          new CustomEvent("chat-finished", {
            detail: { requestId: req.id, sessionId: resolvedSessionId },
          }),
        );

        if (!isVisible) return;

        onSessionChange?.(resolvedSessionId);
        if (resolvedSessionId) {
          loadSession(resolvedSessionId);
        }

        playDoneSound();
        void playTTS(req.response);
      },
    );

    const cleanupError = window.hermesAPI.onChatError(
      (error: string, requestId?: string) => {
        const req = resolveRequest(requestId);
        if (!req) return;
        const isVisible = visibleRequestIdRef.current === req.id;
        const errorMsg: Message = {
          id: `error-${req.id}`,
          role: "assistant" as const,
          content: `**Error:** ${error}`,
        };
        const errorOverlayKey = req.sessionId || req.localKey;
        cacheOverlayMessage(errorOverlayKey, errorMsg);

        if (errorOverlayKey !== req.localKey) {
          delete pendingMessagesRef.current[req.localKey];
        }
        delete activeRequestsRef.current[req.id];
        syncVisibleLoading();
        window.dispatchEvent(
          new CustomEvent("chat-finished", {
            detail: { requestId: req.id, error },
          }),
        );

        if (!isVisible) return;
        setMessages((prev) => upsertMessage(prev, errorMsg));
      },
    );

    return () => {
      cleanupChunk();
      cleanupToolProgress();
      cleanupDone();
      cleanupError();
    };
  }, [
    cacheOverlayMessage,
    loadSession,
    onSessionChange,
    playDoneSound,
    playTTS,
    playTypingSound,
    resolveRequest,
    syncVisibleLoading,
  ]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!window.hermesAPI) return;

      const requestId = `chat-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;
      const activeSessionId = currentSessionRef.current;
      const localKey = activeSessionId || `request:${requestId}`;
      const alreadyRunning = Object.values(activeRequestsRef.current).some(
        (req) => req.localKey === localKey,
      );
      if (alreadyRunning) return;

      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
      };

      pendingMessagesRef.current[localKey] = [
        ...(pendingMessagesRef.current[localKey] || []),
        userMsg,
      ];
      activeRequestsRef.current[requestId] = {
        id: requestId,
        sessionId: activeSessionId,
        localKey,
        response: "",
      };
      visibleRequestIdRef.current = requestId;
      setLoadingRequestId(requestId);
      setMessages((prev) => [...prev, userMsg]);

      if (!activeSessionId) {
        onNewSession();
      }

      window.dispatchEvent(
        new CustomEvent("chat-started", {
          detail: { requestId, sessionId: activeSessionId },
        }),
      );

      try {
        const history = messagesRef.current
          .filter((msg) => msg.role === "user" || msg.role === "assistant")
          .slice(-20)
          .map((msg) => ({ role: msg.role, content: msg.content }));
        await window.hermesAPI.sendMessage(
          text,
          profile || "default",
          activeSessionId || undefined,
          history,
          activeProject,
          requestId,
        );
      } catch (err) {
        const req = activeRequestsRef.current[requestId];
        if (!req) return;
        delete pendingMessagesRef.current[localKey];
        delete activeRequestsRef.current[requestId];
        syncVisibleLoading();
        window.dispatchEvent(
          new CustomEvent("chat-finished", {
            detail: { requestId, error: String(err) },
          }),
        );
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant" as const,
            content: `**Error:** ${err}`,
          },
        ]);
      }
    },
    [activeProject, onNewSession, profile, syncVisibleLoading],
  );

  const resolveDroppedFilePaths = useCallback(
    (dataTransfer: DataTransfer): string[] => {
      const paths = Array.from(dataTransfer.files || [])
        .map((file) => {
          return (
            window.hermesAPI?.getPathForFile?.(file) ||
            (file as File & { path?: string }).path ||
            ""
          );
        })
        .filter(Boolean);

      const uriPaths = dataTransfer
        .getData("text/uri-list")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map(fileUriToPath)
        .filter(Boolean);

      return [...new Set([...paths, ...uriPaths])];
    },
    [],
  );

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setIsDraggingFiles(false);
    if (!window.hermesAPI || !hasDraggedFiles(e.dataTransfer)) return;
    if (loadingRequestId) {
      showToast(
        "Drop paused",
        "Wait for the current response to finish, then drop the file again.",
        "warning",
      );
      return;
    }

    try {
      const paths = resolveDroppedFilePaths(e.dataTransfer);
      if (!paths.length) {
        showToast(
          "Drop failed",
          "Electron did not expose a local file path for this drop.",
          "error",
        );
        return;
      }

      const attachments: DroppedAttachment[] = [];
      for (const filePath of paths) {
        const destPath = await window.hermesAPI.copyFileToWorkspace(filePath);
        if (destPath) {
          attachments.push({
            name: pathBasename(destPath),
            path: destPath,
          });
        }
      }

      if (!attachments.length) {
        showToast(
          "Drop failed",
          "No files could be copied into Hermes.",
          "error",
        );
        return;
      }

      setDraftInsert({
        id: `drop-${Date.now()}-${attachments.length}`,
        text: buildAttachmentDraft(attachments),
      });
      showToast(
        attachments.length === 1 ? "File attached" : "Files attached",
        "Dropped file paths were added to your draft.",
        "success",
      );
    } catch (err) {
      console.error("Failed to copy dropped file:", err);
      showToast("Drop failed", "The file could not be attached.", "error");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!hasDraggedFiles(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = loadingRequestId ? "none" : "copy";
  };

  const handleDragEnter = (e: React.DragEvent) => {
    if (!hasDraggedFiles(e.dataTransfer)) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setIsDraggingFiles(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!hasDraggedFiles(e.dataTransfer)) return;
    e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDraggingFiles(false);
  };

  return (
    <div
      className={`main-80m ${isDraggingFiles ? "file-drop-active" : ""}`}
      onDrop={handleDrop}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
    >
      {isDraggingFiles ? (
        <div className="file-drop-overlay" aria-hidden="true">
          <div className="file-drop-target">
            <FileUp size={28} />
            <span>Attach files</span>
          </div>
        </div>
      ) : null}
      <Messages messages={messages} isLoading={Boolean(loadingRequestId)} />
      <InputBar
        onSend={handleSend}
        disabled={Boolean(loadingRequestId)}
        draftInsert={draftInsert}
        onDraftInsertConsumed={() => setDraftInsert(null)}
      />
    </div>
  );
};

export default ChatArea;

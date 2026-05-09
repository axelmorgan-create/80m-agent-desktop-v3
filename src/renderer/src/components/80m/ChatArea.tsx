import React, { useState, useEffect, useCallback, useRef } from "react";
import { FileUp } from "lucide-react";
import Messages from "./Messages";
import InputBar from "./InputBar";
import type { Message } from "./Messages";

interface ChatAreaProps {
  conversationId?: string;
  currentSession: string | null;
  onNewSession?: () => void;
  onSessionChange?: (sessionId: string | null) => void;
  profile?: string;
  activeProject?: string | null;
  isAudible?: boolean;
}

interface ActiveRequest {
  id: string;
  sessionId: string | null;
  displaySessionId: string | null;
  localKey: string;
  response: string;
  kind: "foreground" | "background";
}

interface QueuedChatTurn {
  id: string;
  text: string;
  mode: "queue" | "steer";
  messageId: string;
  createdAt: number;
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

function requestDisplaySession(req: ActiveRequest): string | null {
  return req.displaySessionId ?? req.sessionId;
}

function parseBusyCommand(text: string): {
  command: "queue" | "steer" | "background" | null;
  payload: string;
} {
  const trimmed = text.trim();
  const match = trimmed.match(/^\/(queue|q|steer|background|bg|btw)\b\s*/i);
  if (!match) return { command: null, payload: trimmed };
  const raw = match[1].toLowerCase();
  const command =
    raw === "q"
      ? "queue"
      : raw === "bg" || raw === "btw"
        ? "background"
        : (raw as "queue" | "steer" | "background");
  return { command, payload: trimmed.slice(match[0].length).trim() };
}

function buildSteerTurnPrompt(text: string): string {
  return [
    "[Steering note sent while the previous run was active]",
    text,
    "",
    "Use this to adjust the work in the current conversation and continue from the latest state.",
  ].join("\n");
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
  conversationId,
  currentSession,
  onNewSession,
  onSessionChange,
  profile,
  activeProject,
  isAudible = true,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingRequestId, setLoadingRequestId] = useState<string | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [draftInsert, setDraftInsert] = useState<{
    id: string;
    text: string;
  } | null>(null);
  const [queuedTurns, setQueuedTurns] = useState<QueuedChatTurn[]>([]);
  const [busySendMode, setBusySendMode] = useState<
    "queue" | "steer" | "background"
  >(() => {
    const saved = localStorage.getItem("hermes-chat-busy-send-mode");
    return saved === "queue" || saved === "steer" || saved === "background"
      ? saved
      : "queue";
  });

  const messagesRef = useRef<Message[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const currentSessionRef = useRef<string | null>(currentSession);
  const activeRequestsRef = useRef<Record<string, ActiveRequest>>({});
  const visibleRequestIdRef = useRef<string | null>(null);
  const pendingMessagesRef = useRef<Record<string, Message[]>>({});
  const queuedTurnsRef = useRef<QueuedChatTurn[]>([]);
  const dragDepthRef = useRef(0);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    currentSessionRef.current = currentSession;
  }, [currentSession]);

  useEffect(() => {
    localStorage.setItem("hermes-chat-busy-send-mode", busySendMode);
  }, [busySendMode]);

  const updateQueuedTurns = useCallback((next: QueuedChatTurn[]) => {
    queuedTurnsRef.current = next;
    setQueuedTurns(next);
  }, []);

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
    return Object.values(activeRequestsRef.current).find(
      (req) =>
        req.kind === "foreground" &&
        (targetSession
          ? requestDisplaySession(req) === targetSession
          : requestDisplaySession(req) === null),
    );
  }, []);

  const resolveRequest = useCallback((requestId?: string) => {
    if (requestId && activeRequestsRef.current[requestId]) {
      return activeRequestsRef.current[requestId];
    }
    if (requestId) return null;
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

  const isRequestVisible = useCallback((req: ActiveRequest) => {
    return (
      visibleRequestIdRef.current === req.id ||
      requestDisplaySession(req) === currentSessionRef.current
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
          ? requestDisplaySession(req) === targetSession
          : requestDisplaySession(req) === null,
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
    const container = rootRef.current?.querySelector(".messages-80m");
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, loadingRequestId]);

  const startChatRequest = useCallback(
    async (
      text: string,
      options: {
        kind?: "foreground" | "background";
        displayUserMessage?: boolean;
        sessionId?: string | null;
        displaySessionId?: string | null;
        excludeMessageId?: string;
      } = {},
    ) => {
      if (!window.hermesAPI) return;

      const kind = options.kind || "foreground";
      const requestId = `chat-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;
      const activeSessionId =
        kind === "background"
          ? null
          : options.sessionId !== undefined
            ? options.sessionId
            : currentSessionRef.current;
      const displaySessionId =
        options.displaySessionId !== undefined
          ? options.displaySessionId
          : currentSessionRef.current;
      const localKey =
        displaySessionId ||
        activeSessionId ||
        `${kind === "background" ? "background" : "request"}:${requestId}`;
      const displayUserMessage = options.displayUserMessage !== false;

      const userMsg: Message = {
        id: `user-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        role: "user",
        content: text,
      };

      if (displayUserMessage) {
        pendingMessagesRef.current[localKey] = [
          ...(pendingMessagesRef.current[localKey] || []),
          userMsg,
        ];
        setMessages((prev) => [...prev, userMsg]);
      }

      const initialResponse =
        kind === "background" ? "**Background run started**\n\n" : "";
      const request: ActiveRequest = {
        id: requestId,
        sessionId: activeSessionId,
        displaySessionId,
        localKey,
        response: initialResponse,
        kind,
      };
      activeRequestsRef.current[requestId] = request;

      if (kind === "foreground") {
        visibleRequestIdRef.current = requestId;
        setLoadingRequestId(requestId);
        if (!activeSessionId) onNewSession?.();
      } else if (isRequestVisible(request)) {
        const assistant = makeAssistantMessage(request);
        if (assistant) setMessages((prev) => upsertMessage(prev, assistant));
      }

      window.dispatchEvent(
        new CustomEvent("chat-started", {
          detail: {
            conversationId,
            requestId,
            sessionId: activeSessionId,
            background: kind === "background",
          },
        }),
      );

      try {
        const history =
          kind === "background"
            ? []
            : messagesRef.current
                .filter(
                  (msg) =>
                    msg.id !== options.excludeMessageId &&
                    (msg.role === "user" || msg.role === "assistant"),
                )
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
        const errorMsg: Message = {
          id: `error-${requestId}`,
          role: "assistant",
          content: `**Error:** ${err}`,
        };
        cacheOverlayMessage(req.localKey, errorMsg);
        delete activeRequestsRef.current[requestId];
        syncVisibleLoading();
        window.dispatchEvent(
          new CustomEvent("chat-finished", {
            detail: {
              conversationId,
              requestId,
              error: String(err),
              background: kind === "background",
            },
          }),
        );
        if (isRequestVisible(req)) {
          setMessages((prev) => upsertMessage(prev, errorMsg));
        }
      }
    },
    [
      activeProject,
      cacheOverlayMessage,
      conversationId,
      isRequestVisible,
      onNewSession,
      profile,
      syncVisibleLoading,
    ],
  );

  const drainQueuedTurn = useCallback(
    async (preferredSessionId?: string | null) => {
      const [next, ...rest] = queuedTurnsRef.current;
      if (!next) return;
      updateQueuedTurns(rest);
      const text =
        next.mode === "steer" ? buildSteerTurnPrompt(next.text) : next.text;
      await startChatRequest(text, {
        kind: "foreground",
        displayUserMessage: false,
        sessionId:
          preferredSessionId !== undefined
            ? preferredSessionId
            : currentSessionRef.current,
        excludeMessageId: next.messageId,
      });
    },
    [startChatRequest, updateQueuedTurns],
  );

  const enqueueBusyTurn = useCallback(
    (text: string, mode: "queue" | "steer") => {
      const request = loadingRequestId
        ? activeRequestsRef.current[loadingRequestId]
        : null;
      const localKey =
        currentSessionRef.current ||
        request?.localKey ||
        `queued:${Date.now()}`;
      const messageId = `queued-user-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;
      const userMsg: Message = {
        id: messageId,
        role: "user",
        content: text,
      };
      pendingMessagesRef.current[localKey] = [
        ...(pendingMessagesRef.current[localKey] || []),
        userMsg,
      ];
      const next = [
        ...queuedTurnsRef.current,
        {
          id: `queued-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          text,
          mode,
          messageId,
          createdAt: Date.now(),
        },
      ];
      updateQueuedTurns(next);
      setMessages((prev) => [...prev, userMsg]);
      showToast(
        mode === "steer" ? "Steer staged" : "Message queued",
        mode === "steer"
          ? "Hermes API has no native steer endpoint yet, so this will run at the next turn boundary."
          : "This will send after the current run finishes.",
        "info",
      );
    },
    [loadingRequestId, showToast, updateQueuedTurns],
  );

  const handleSend = useCallback(
    async (text: string) => {
      const parsed = parseBusyCommand(text);
      const command = parsed.command;
      const payload = parsed.command ? parsed.payload : text.trim();
      if (!payload) {
        showToast("Missing prompt", "Add text after the command.", "warning");
        return;
      }

      const isBusy = Boolean(loadingRequestId);
      if (isBusy) {
        const effectiveMode = command || busySendMode;
        if (effectiveMode === "background") {
          await startChatRequest(payload, { kind: "background" });
          return;
        }
        enqueueBusyTurn(payload, effectiveMode);
        return;
      }

      if (command === "background") {
        await startChatRequest(payload, { kind: "background" });
        return;
      }

      await startChatRequest(payload, { kind: "foreground" });
    },
    [
      busySendMode,
      enqueueBusyTurn,
      loadingRequestId,
      showToast,
      startChatRequest,
    ],
  );

  const handleStopRequest = useCallback(() => {
    if (!loadingRequestId) return;
    void window.hermesAPI?.abortChat(loadingRequestId);
  }, [loadingRequestId]);

  useEffect(() => {
    if (!window.hermesAPI) return;

    const cleanupChunk = window.hermesAPI.onChatChunk(
      (chunk: string, requestId?: string) => {
        const req = resolveRequest(requestId);
        if (!req) return;
        req.response += chunk;
        if (!isRequestVisible(req)) return;

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
        if (!isRequestVisible(req)) return;
        setMessages((prev) => upsertMessage(prev, toolMsg));
      },
    );

    const cleanupDone = window.hermesAPI.onChatDone(
      (newSessionId: string | undefined, requestId?: string) => {
        const req = resolveRequest(requestId);
        if (!req) return;

        const isVisible = isRequestVisible(req);
        const resolvedSessionId = newSessionId || req.sessionId || null;
        const displaySessionId = requestDisplaySession(req);
        const overlayKey =
          req.kind === "background"
            ? displaySessionId || req.localKey
            : resolvedSessionId || req.localKey;
        const finalAssistant = makeAssistantMessage(req);
        if (overlayKey) {
          const finalMessages = [
            ...(pendingMessagesRef.current[req.localKey] || []),
            ...(finalAssistant ? [finalAssistant] : []),
          ];
          pendingMessagesRef.current[overlayKey] = mergeMessages(
            pendingMessagesRef.current[overlayKey] || [],
            finalMessages,
          );
        }
        if (overlayKey !== req.localKey) {
          delete pendingMessagesRef.current[req.localKey];
        }
        delete activeRequestsRef.current[req.id];
        syncVisibleLoading();
        window.dispatchEvent(new CustomEvent("sessions-updated"));
        window.dispatchEvent(
          new CustomEvent("chat-finished", {
            detail: {
              conversationId,
              requestId: req.id,
              sessionId: resolvedSessionId,
              background: req.kind === "background",
            },
          }),
        );

        if (req.kind === "background") {
          if (isVisible && finalAssistant) {
            setMessages((prev) => upsertMessage(prev, finalAssistant));
          }
          return;
        }

        const shouldDrainQueue = queuedTurnsRef.current.length > 0;

        onSessionChange?.(resolvedSessionId);
        if (resolvedSessionId) {
          loadSession(resolvedSessionId);
        }

        if (isAudible) {
          playDoneSound();
          void playTTS(req.response);
        }

        if (isVisible && finalAssistant) {
          setMessages((prev) => upsertMessage(prev, finalAssistant));
        }

        if (shouldDrainQueue) {
          window.setTimeout(() => {
            void drainQueuedTurn(resolvedSessionId);
          }, 0);
        }
      },
    );

    const cleanupError = window.hermesAPI.onChatError(
      (error: string, requestId?: string) => {
        const req = resolveRequest(requestId);
        if (!req) return;
        const isVisible = isRequestVisible(req);
        const errorMsg: Message = {
          id: `error-${req.id}`,
          role: "assistant" as const,
          content: `**Error:** ${error}`,
        };
        const errorOverlayKey = requestDisplaySession(req) || req.localKey;
        cacheOverlayMessage(errorOverlayKey, errorMsg);

        if (errorOverlayKey !== req.localKey) {
          delete pendingMessagesRef.current[req.localKey];
        }
        delete activeRequestsRef.current[req.id];
        syncVisibleLoading();
        window.dispatchEvent(
          new CustomEvent("chat-finished", {
            detail: {
              conversationId,
              requestId: req.id,
              error,
              background: req.kind === "background",
            },
          }),
        );

        if (!isVisible) return;
        setMessages((prev) => upsertMessage(prev, errorMsg));
        if (req.kind === "foreground" && queuedTurnsRef.current.length > 0) {
          window.setTimeout(() => {
            void drainQueuedTurn(req.sessionId);
          }, 0);
        }
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
    conversationId,
    drainQueuedTurn,
    isAudible,
    isRequestVisible,
    loadSession,
    onSessionChange,
    playDoneSound,
    playTTS,
    playTypingSound,
    resolveRequest,
    syncVisibleLoading,
  ]);

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
    e.dataTransfer.dropEffect = "copy";
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
      ref={rootRef}
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
        isBusy={Boolean(loadingRequestId)}
        busyMode={busySendMode}
        queuedCount={queuedTurns.length}
        onBusyModeChange={setBusySendMode}
        onStop={handleStopRequest}
        draftInsert={draftInsert}
        onDraftInsertConsumed={() => setDraftInsert(null)}
      />
    </div>
  );
};

export default ChatArea;

import React, { useState, useEffect, useCallback, useRef } from "react";
import Messages from "./Messages";
import InputBar from "./InputBar";
import { ChatFileDropOverlay } from "./ChatFileDropOverlay";
import { playDoneSound, playTTS, playTypingSound } from "./chatAreaAudio";
import type { Message } from "./Messages";
import type {
  ActiveRequest,
  ChatAreaProps,
  ChatToolProgressPayload,
  QueuedChatTurn,
} from "./chatAreaTypes";
import {
  buildSteerTurnPrompt,
  makeAssistantMessage,
  makeToolProgressMessage,
  mergeMessages,
  parseBusyCommand,
  requestDisplaySession,
  upsertMessage,
} from "./chatAreaUtils";
import { useChatFileDrop } from "./useChatFileDrop";

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

  const { isDraggingFiles, dragHandlers } = useChatFileDrop({
    setDraftInsert,
    showToast,
  });

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
    resolveRequest,
    syncVisibleLoading,
  ]);

  return (
    <div
      ref={rootRef}
      className={`main-80m ${isDraggingFiles ? "file-drop-active" : ""}`}
      {...dragHandlers}
    >
      {isDraggingFiles ? <ChatFileDropOverlay /> : null}
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

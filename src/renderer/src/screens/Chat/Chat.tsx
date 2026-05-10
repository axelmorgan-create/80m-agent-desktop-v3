import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type ChangeEvent,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type SetStateAction,
} from "react";
import {
  Trash2 as Trash,
  Send,
  Square as Stop,
  Plus,
  Zap,
} from "lucide-react";
import { PROVIDERS } from "../../constants";
import { useI18n } from "../../components/useI18n";
import { ChatEmptyState } from "./ChatEmptyState";
import { ChatModelPicker } from "./ChatModelPicker";
import { HermesAvatar, MessageRow } from "./ChatMessageRow";
import { ChatSlashMenu } from "./ChatSlashMenu";
import { SLASH_COMMANDS } from "./chatCommands";
import type {
  CatalogModel,
  ChatMessage,
  ChatUsage,
  ModelGroup,
  SlashCommand,
} from "./chatTypes";

export type { ChatMessage } from "./chatTypes";
export { AgentMarkdown } from "../../components/AgentMarkdown";

interface ChatProps {
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  sessionId: string | null;
  profile?: string;
  onSessionStarted?: () => void;
  onNewChat?: () => void;
}

function Chat({
  messages,
  setMessages,
  sessionId,
  profile,
  onSessionStarted,
  onNewChat,
}: ChatProps): React.JSX.Element {
  const { t } = useI18n();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hermesSessionId, setHermesSessionId] = useState<string | null>(null);
  const [toolProgress, setToolProgress] = useState<string | null>(null);
  const [usage, setUsage] = useState<ChatUsage | null>(null);
  const [fastMode, setFastMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isLoadingRef = useRef(false);
  const messagesRef = useRef(messages);
  const userScrolledUpRef = useRef(false);

  // Model picker state
  const [currentModel, setCurrentModel] = useState("");
  const [currentProvider, setCurrentProvider] = useState("auto");
  const [currentBaseUrl, setCurrentBaseUrl] = useState("");
  const [modelGroups, setModelGroups] = useState<ModelGroup[]>([]);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [customModelInput, setCustomModelInput] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);

  // Slash command menu state
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);
  const slashMenuRef = useRef<HTMLDivElement>(null);

  // Keep ref in sync for use in IPC callbacks
  isLoadingRef.current = isLoading;
  messagesRef.current = messages;

  // Filtered slash commands based on current input
  const filteredSlashCommands = useMemo(
    () =>
      slashMenuOpen
        ? SLASH_COMMANDS.filter((cmd) =>
            cmd.name.toLowerCase().startsWith(slashFilter.toLowerCase()),
          )
        : [],
    [slashMenuOpen, slashFilter],
  );

  const scrollToBottom = useCallback((force?: boolean) => {
    if (!force && userScrolledUpRef.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Track whether the user has scrolled away from the bottom
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    function handleScroll(): void {
      const el = container!;
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
      userScrolledUpRef.current = !atBottom;
    }
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Reset hermes session when messages are cleared (new chat)
  useEffect(() => {
    if (messages.length === 0) {
      setHermesSessionId(null);
    }
  }, [messages]);

  const loadModelConfig = useCallback(async (): Promise<void> => {
    const [mc, savedModels, catalogModels] = await Promise.all([
      window.hermesAPI.getModelConfig(profile),
      window.hermesAPI.listModels(),
      window.hermesAPI.listModelCatalog().catch(() => [] as CatalogModel[]),
    ]);
    setCurrentModel(mc.model);
    setCurrentProvider(mc.provider);
    setCurrentBaseUrl(mc.baseUrl);

    // Group saved models first, then merge the official Hermes catalog.
    const groupMap = new Map<string, ModelGroup>();
    const seen = new Set<string>();
    const addModelOption = (m: {
      provider: string;
      model: string;
      label: string;
      baseUrl: string;
    }): void => {
      const key = `${m.provider}:${m.model}`;
      if (seen.has(key)) return;
      seen.add(key);
      if (!groupMap.has(m.provider)) {
        groupMap.set(m.provider, {
          provider: m.provider,
          providerLabel: PROVIDERS.labels[m.provider] || m.provider,
          models: [],
        });
      }
      groupMap.get(m.provider)!.models.push(m);
    };

    for (const m of savedModels) {
      addModelOption({
        provider: m.provider,
        model: m.model,
        label: m.name,
        baseUrl: m.baseUrl || "",
      });
    }

    for (const m of catalogModels as CatalogModel[]) {
      addModelOption({
        provider: m.provider,
        model: m.model,
        label: m.description ? `${m.name} · ${m.description}` : m.name,
        baseUrl: m.baseUrl || "",
      });
    }
    setModelGroups(Array.from(groupMap.values()));
  }, [profile]);

  // Load model config and build available models list
  useEffect(() => {
    loadModelConfig();
  }, [loadModelConfig]);

  // Load fast mode state from config
  useEffect(() => {
    window.hermesAPI.getConfig("agent.service_tier", profile).then((val) => {
      setFastMode(val === "fast" || val === "priority");
    });
  }, [profile]);

  // Close picker on click outside
  useEffect(() => {
    if (!showModelPicker) return;
    function handleClickOutside(e: MouseEvent): void {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowModelPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showModelPicker]);

  // Close slash menu on click outside
  useEffect(() => {
    if (!slashMenuOpen) return;
    function handleClickOutside(e: MouseEvent): void {
      if (
        slashMenuRef.current &&
        !slashMenuRef.current.contains(e.target as Node)
      ) {
        setSlashMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [slashMenuOpen]);

  // Scroll active slash menu item into view
  useEffect(() => {
    if (!slashMenuOpen) return;
    const active = slashMenuRef.current?.querySelector(
      ".slash-menu-item-active",
    );
    active?.scrollIntoView({ block: "nearest" });
  }, [slashSelectedIndex, slashMenuOpen]);

  async function selectModel(
    provider: string,
    model: string,
    baseUrl: string,
  ): Promise<void> {
    await window.hermesAPI.setModelConfig(provider, model, baseUrl, profile);
    setCurrentModel(model);
    setCurrentProvider(provider);
    setCurrentBaseUrl(baseUrl);
    setShowModelPicker(false);
    setCustomModelInput("");
  }

  async function handleCustomModelSubmit(): Promise<void> {
    const model = customModelInput.trim();
    if (!model) return;
    await selectModel(
      currentProvider === "auto" ? "auto" : currentProvider,
      model,
      currentBaseUrl,
    );
  }

  // IPC listeners — stable callback refs, registered once
  useEffect(() => {
    const cleanupChunk = window.hermesAPI.onChatChunk((chunk) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        // Append to existing agent message
        if (last && last.role === "agent") {
          return [
            ...prev.slice(0, -1),
            { ...last, content: last.content + chunk },
          ];
        }
        // Only create a new message if chunk has visible content
        if (!chunk || !chunk.trim()) return prev;
        return [
          ...prev,
          { id: `agent-${Date.now()}`, role: "agent", content: chunk },
        ];
      });
    });

    const cleanupDone = window.hermesAPI.onChatDone(async (sessionId) => {
      if (sessionId) setHermesSessionId(sessionId);
      setToolProgress(null);
      setIsLoading(false);

      // Auto-TTS: speak the agent's last response
      try {
        const autoTts = await window.hermesAPI?.getConfig("voice.auto_tts");
        if (String(autoTts).toLowerCase() === "true") {
          const currentMessages = messagesRef.current;
          const lastMsg = currentMessages[currentMessages.length - 1];
          if (lastMsg && lastMsg.role === "agent") {
            // Strip markdown artefacts for cleaner TTS
            const plain = lastMsg.content
              .replace(/#{1,6}\s/g, "")
              .replace(/\*\*(.+?)\*\*/g, "$1")
              .replace(/\*(.+?)\*/g, "$1")
              .replace(/`{1,3}[^`]*`{1,3}/g, "")
              .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
              .replace(/>/g, "")
              .replace(/\n{3,}/g, "\n\n")
              .trim();
            if (plain.length > 0) {
              const mp3Path = await window.hermesAPI?.ttsSpeak(plain);
              if (mp3Path) {
                const audio = new Audio(`file://${mp3Path}`);
                audio.volume = 0.9;
                audio.play().catch(() => {});
              }
            }
          }
        }
      } catch (_) {}
    });

    const cleanupError = window.hermesAPI.onChatError((error) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "agent",
          content: `Error: ${error}`,
        },
      ]);
      setToolProgress(null);
      setIsLoading(false);
    });

    const cleanupToolProgress = window.hermesAPI.onChatToolProgress((tool) => {
      setToolProgress(
        typeof tool === "string"
          ? tool
          : tool.label ||
              tool.preview ||
              tool.tool ||
              tool.name ||
              "Tool activity",
      );
    });

    const cleanupUsage = window.hermesAPI.onChatUsage((u) => {
      setUsage((prev) => ({
        promptTokens: (prev?.promptTokens || 0) + u.promptTokens,
        completionTokens: (prev?.completionTokens || 0) + u.completionTokens,
        totalTokens: (prev?.totalTokens || 0) + u.totalTokens,
        cost: u.cost != null ? (prev?.cost || 0) + u.cost : prev?.cost,
      }));
    });

    return () => {
      cleanupChunk();
      cleanupDone();
      cleanupError();
      cleanupToolProgress();
      cleanupUsage();
    };
  }, [setMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Reset scroll lock when user sends a new message
  const prevMessageCountRef = useRef(messages.length);
  useEffect(() => {
    const prevCount = prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;
    // A new user message was just added — re-engage auto-scroll
    if (
      messages.length > prevCount &&
      messages[messages.length - 1]?.role === "user"
    ) {
      userScrolledUpRef.current = false;
      scrollToBottom(true);
    }
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  // Keyboard shortcut: Cmd+N for new chat
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        if (onNewChat) onNewChat();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNewChat]);

  async function handleSend(): Promise<void> {
    const text = input.trim();
    if (!text || isLoading) return;

    setSlashMenuOpen(false);
    setInput("");

    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    // Intercept slash commands that can be handled locally
    if (text.startsWith("/")) {
      const cmd = text.split(/\s+/)[0].toLowerCase();
      const isLocal = SLASH_COMMANDS.some(
        (c) => c.name === cmd && (c.local || c.category === "info"),
      );
      if (isLocal) {
        if (cmd !== "/new" && cmd !== "/clear") {
          setMessages((prev) => [
            ...prev,
            { id: `user-${Date.now()}`, role: "user", content: text },
          ]);
        }
        await executeLocalCommand(text);
        return;
      }
    }

    setIsLoading(true);
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: "user", content: text },
    ]);
    onSessionStarted?.();

    try {
      await window.hermesAPI.sendMessage(
        text,
        profile,
        hermesSessionId || undefined,
        messages.map((m) => ({ role: m.role, content: m.content })),
      );
    } catch {
      // Error already handled by onChatError IPC listener — avoid duplicate
    }
  }

  async function handleQuickAsk(): Promise<void> {
    const text = input.trim();
    if (!text || isLoading) return;
    // /btw sends an ephemeral side question that doesn't pollute conversation context
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setIsLoading(true);
    setMessages((prev) => [
      ...prev,
      { id: `user-btw-${Date.now()}`, role: "user", content: `💭 ${text}` },
    ]);
    try {
      await window.hermesAPI.sendMessage(
        `/btw ${text}`,
        profile,
        hermesSessionId || undefined,
        messages.map((m) => ({ role: m.role, content: m.content })),
      );
    } catch {
      // Error already handled by onChatError IPC listener — avoid duplicate
    }
  }

  function handleKeyDown(e: ReactKeyboardEvent): void {
    // Slash menu keyboard navigation
    if (slashMenuOpen && filteredSlashCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashSelectedIndex((i) =>
          i < filteredSlashCommands.length - 1 ? i + 1 : 0,
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashSelectedIndex((i) =>
          i > 0 ? i - 1 : filteredSlashCommands.length - 1,
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        handleSlashSelect(filteredSlashCommands[slashSelectedIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashMenuOpen(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInputChange(e: ChangeEvent<HTMLTextAreaElement>): void {
    const value = e.target.value;
    setInput(value);

    // Defer reflow-triggering resize to next frame
    const target = e.target;
    requestAnimationFrame(() => {
      target.style.height = "auto";
      target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
    });

    // Slash command detection: open menu when input starts with /
    if (value.startsWith("/") && !value.includes(" ")) {
      const query = value.split(" ")[0];
      setSlashMenuOpen(true);
      setSlashFilter(query);
      setSlashSelectedIndex(0);
    } else if (slashMenuOpen) {
      setSlashMenuOpen(false);
    }
  }

  /** Push a fake agent message into the chat (for locally-handled commands). */
  function pushLocalResponse(content: string): void {
    setMessages((prev) => [
      ...prev,
      { id: `agent-local-${Date.now()}`, role: "agent", content },
    ]);
  }

  /**
   * Execute a slash command that can be resolved entirely in the desktop app.
   * Returns true if handled, false if the command should go to the backend.
   */
  async function executeLocalCommand(cmdText: string): Promise<boolean> {
    const parts = cmdText.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();

    switch (cmd) {
      case "/new":
        onNewChat?.();
        return true;

      case "/clear":
        handleClear();
        return true;

      case "/model": {
        const mc = await window.hermesAPI.getModelConfig(profile);
        const display = mc.model || "Not set";
        const prov = mc.provider || "auto";
        pushLocalResponse(
          `**Current model:** \`${display}\`\n**Provider:** ${prov}${mc.baseUrl ? `\n**Base URL:** ${mc.baseUrl}` : ""}`,
        );
        return true;
      }

      case "/memory": {
        const mem = await window.hermesAPI.readMemory(profile);
        const lines: string[] = ["**Agent Memory**\n"];
        if (mem.memory.exists && mem.memory.content.trim()) {
          lines.push(mem.memory.content.trim());
        } else {
          lines.push(t("memory.noMemoryEntries"));
        }
        lines.push(
          `\n**Stats:** ${mem.stats.totalSessions} sessions, ${mem.stats.totalMessages} messages`,
        );
        pushLocalResponse(lines.join("\n"));
        return true;
      }

      case "/tools": {
        const tools = await window.hermesAPI.getToolsets(profile);
        if (!tools.length) {
          pushLocalResponse(t("memory.noToolsetsFound"));
        } else {
          const rows = tools
            .map(
              (t) =>
                `- **${t.label}** — ${t.description} ${t.enabled ? "*(enabled)*" : "*(disabled)*"}`,
            )
            .join("\n");
          pushLocalResponse(`**Available Toolsets**\n\n${rows}`);
        }
        return true;
      }

      case "/skills": {
        const skills = await window.hermesAPI.listInstalledSkills(profile);
        if (!skills.length) {
          pushLocalResponse("No skills installed.");
        } else {
          const rows = skills
            .map((s) => `- **${s.name}** (${s.category}) — ${s.description}`)
            .join("\n");
          pushLocalResponse(`**Installed Skills**\n\n${rows}`);
        }
        return true;
      }

      case "/persona": {
        const soul = await window.hermesAPI.readSoul(profile);
        pushLocalResponse(
          soul.trim()
            ? `**Current Persona**\n\n${soul.trim()}`
            : "_No persona configured._",
        );
        return true;
      }

      case "/version": {
        const [hermesVer, appVer] = await Promise.all([
          window.hermesAPI.getHermesVersion(),
          window.hermesAPI.getAppVersion(),
        ]);
        pushLocalResponse(
          `**80M Runtime:** ${hermesVer || "unknown"}\n**Desktop App:** v${appVer}`,
        );
        return true;
      }

      case "/fast": {
        const current = await window.hermesAPI.getConfig(
          "agent.service_tier",
          profile,
        );
        const isOn = current === "fast" || current === "priority";
        const next = !isOn;
        setFastMode(next);
        await window.hermesAPI.setConfig(
          "agent.service_tier",
          next ? "fast" : "normal",
          profile,
        );
        pushLocalResponse(
          next
            ? "**Fast Mode: ON** — Priority processing enabled for lower latency."
            : "**Fast Mode: OFF** — Standard processing restored.",
        );
        return true;
      }

      case "/usage": {
        if (usage) {
          let md = `**Token Usage**\n\n`;
          md += `- **Prompt:** ${usage.promptTokens.toLocaleString()} tokens\n`;
          md += `- **Completion:** ${usage.completionTokens.toLocaleString()} tokens\n`;
          md += `- **Total:** ${usage.totalTokens.toLocaleString()} tokens\n`;
          if (usage.cost != null) {
            md += `- **Cost:** $${usage.cost.toFixed(4)}\n`;
          }
          pushLocalResponse(md);
        } else {
          pushLocalResponse(t("chat.noUsageData"));
        }
        return true;
      }

      case "/help": {
        const grouped: Record<string, SlashCommand[]> = {};
        for (const c of SLASH_COMMANDS) {
          (grouped[c.category] ||= []).push(c);
        }
        const categoryLabels: Record<string, string> = {
          chat: t("chat.categoryChat"),
          agent: t("chat.categoryAgent"),
          tools: t("chat.categoryTools"),
          info: t("chat.categoryInfo"),
        };
        let md = `**${t("chat.availableCommands")}**\n`;
        for (const cat of ["chat", "agent", "tools", "info"]) {
          if (!grouped[cat]) continue;
          md += `\n**${categoryLabels[cat]}**\n`;
          for (const c of grouped[cat]) {
            md += `\`${c.name}\` — ${c.description}\n`;
          }
        }
        pushLocalResponse(md);
        return true;
      }

      default:
        return false;
    }
  }

  function handleSlashSelect(cmd: SlashCommand): void {
    setSlashMenuOpen(false);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";

    // Commands that need no arguments — execute immediately
    if (cmd.local || ["info"].includes(cmd.category)) {
      // Show as user message for non-UI commands
      if (cmd.name !== "/new" && cmd.name !== "/clear") {
        setMessages((prev) => [
          ...prev,
          { id: `user-${Date.now()}`, role: "user", content: cmd.name },
        ]);
      }
      executeLocalCommand(cmd.name);
      return;
    }

    // For backend commands that take arguments, insert command + space
    const newValue = cmd.name + " ";
    setInput(newValue);
    inputRef.current?.focus();
  }

  function handleAbort(): void {
    window.hermesAPI.abortChat();
    setIsLoading(false);
    // Refocus input after aborting
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleClear(): void {
    // Abort any in-flight request before clearing
    if (isLoading) {
      window.hermesAPI.abortChat();
      setIsLoading(false);
    }
    setMessages([]);
    setHermesSessionId(null);
    setUsage(null);
    setToolProgress(null);
  }

  const handleApprove = useCallback(() => {
    setInput("");
    setIsLoading(true);
    setMessages((prev) => [
      ...prev,
      { id: `user-approve-${Date.now()}`, role: "user", content: "/approve" },
    ]);
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    window.hermesAPI
      .sendMessage("/approve", profile, hermesSessionId || undefined, history)
      .catch(() => setIsLoading(false));
  }, [profile, hermesSessionId, setMessages, messages]);

  const handleDeny = useCallback(() => {
    setInput("");
    setIsLoading(true);
    setMessages((prev) => [
      ...prev,
      { id: `user-deny-${Date.now()}`, role: "user", content: "/deny" },
    ]);
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    window.hermesAPI
      .sendMessage("/deny", profile, hermesSessionId || undefined, history)
      .catch(() => setIsLoading(false));
  }, [profile, hermesSessionId, setMessages, messages]);

  const visibleMessages = useMemo(
    () => messages.filter((m) => m.content.trim()),
    [messages],
  );

  const displayModel = useMemo(
    () =>
      currentModel
        ? currentModel.split("/").pop() || currentModel
        : currentProvider === "auto"
          ? t("chat.auto")
          : t("chat.noModel"),
    [currentModel, currentProvider, t],
  );

  const lastMessageIsAgent = useMemo(
    () => messages.length > 0 && messages[messages.length - 1].role === "agent",
    [messages],
  );

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="chat-header-left">
          <div className="chat-header-title">
            {sessionId
              ? t("chat.sessionTitle", { id: sessionId.slice(-6) })
              : t("chat.title")}
          </div>
          {usage && (
            <span
              className="chat-token-counter"
              title={`Prompt: ${usage.promptTokens.toLocaleString()} | Completion: ${usage.completionTokens.toLocaleString()}${usage.cost != null ? ` | Cost: $${usage.cost.toFixed(4)}` : ""}`}
            >
              {usage.totalTokens.toLocaleString()} tokens
              {usage.cost != null && (
                <span className="chat-cost"> · ${usage.cost.toFixed(4)}</span>
              )}
            </span>
          )}
        </div>
        <div className="chat-header-actions">
          <div className="chat-fast-wrapper">
            <button
              className={`btn-ghost chat-fast-btn ${fastMode ? "chat-fast-active" : ""}`}
              onClick={async () => {
                const next = !fastMode;
                setFastMode(next);
                await window.hermesAPI.setConfig(
                  "agent.service_tier",
                  next ? "fast" : "normal",
                  profile,
                );
              }}
            >
              <Zap size={14} />
            </button>
            <div className="chat-fast-popover">
              <strong>
                {fastMode ? t("chat.fastModeOn") : t("chat.fastMode")}
              </strong>
              <span>
                {fastMode
                  ? t("chat.fastModeActive")
                  : t("chat.fastModeInactive")}
              </span>
            </div>
          </div>
          {onNewChat && (
            <button
              className="btn-ghost chat-clear-btn"
              onClick={onNewChat}
              title={t("chat.newChat")}
            >
              <Plus size={16} />
            </button>
          )}
          {messages.length > 0 && (
            <button
              className="btn-ghost chat-clear-btn"
              onClick={handleClear}
              title={t("chat.clearChat")}
            >
              <Trash size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="chat-messages" ref={messagesContainerRef}>
        {messages.length === 0 ? (
          <ChatEmptyState inputRef={inputRef} setInput={setInput} />
        ) : (
          visibleMessages.map((msg, i) => (
            <MessageRow
              key={msg.id}
              msg={msg}
              isLast={i === visibleMessages.length - 1}
              isLoading={isLoading}
              onApprove={handleApprove}
              onDeny={handleDeny}
            />
          ))
        )}

        {isLoading && !lastMessageIsAgent && (
          <div className="chat-message chat-message-agent">
            <HermesAvatar />
            <div className="chat-bubble chat-bubble-agent">
              {toolProgress ? (
                <div className="chat-tool-progress">{toolProgress}</div>
              ) : (
                <div className="chat-typing">
                  <span className="chat-typing-dot" />
                  <span className="chat-typing-dot" />
                  <span className="chat-typing-dot" />
                </div>
              )}
            </div>
          </div>
        )}

        {isLoading && toolProgress && lastMessageIsAgent && (
          <div className="chat-tool-progress-inline">{toolProgress}</div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        {slashMenuOpen && filteredSlashCommands.length > 0 && (
          <ChatSlashMenu
            commands={filteredSlashCommands}
            menuRef={slashMenuRef}
            selectedIndex={slashSelectedIndex}
            setSelectedIndex={setSlashSelectedIndex}
            onSelect={handleSlashSelect}
          />
        )}
        <div className="chat-input-wrapper">
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder={t("chat.typeMessage")}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isLoading}
            autoFocus
          />
          {isLoading ? (
            <button
              className="chat-send-btn chat-stop-btn"
              onClick={handleAbort}
              title={t("common.stop")}
            >
              <Stop size={14} />
            </button>
          ) : (
            <>
              {input.trim() && hermesSessionId && (
                <button
                  className="chat-btw-btn"
                  onClick={handleQuickAsk}
                  title={t("chat.quickAskTitle")}
                >
                  💭
                </button>
              )}
              <button
                className="chat-send-btn"
                onClick={handleSend}
                disabled={!input.trim()}
                title={t("chat.send")}
              >
                <Send size={16} />
              </button>
            </>
          )}
        </div>

        <ChatModelPicker
          pickerRef={pickerRef}
          displayModel={displayModel}
          showModelPicker={showModelPicker}
          setShowModelPicker={setShowModelPicker}
          loadModelConfig={() => void loadModelConfig()}
          modelGroups={modelGroups}
          currentModel={currentModel}
          currentProvider={currentProvider}
          customModelInput={customModelInput}
          setCustomModelInput={setCustomModelInput}
          selectModel={selectModel}
          handleCustomModelSubmit={handleCustomModelSubmit}
        />
      </div>
    </div>
  );
}

export default Chat;

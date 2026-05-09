import React, { useState, useCallback, useEffect, ReactNode } from "react";
import Sidebar from "./Sidebar";
import ChatArea from "./ChatArea";
import Settings from "./Settings";
import Sessions from "../../screens/Sessions/Sessions";
import Memory from "../../screens/Memory/Memory";
import Soul from "../../screens/Soul/Soul";
import Skills from "../../screens/Skills/Skills";
import Tools from "../../screens/Tools/Tools";
import Gateway from "../../screens/Gateway/Gateway";
import Models from "../../screens/Models/Models";
import Schedules from "../../screens/Schedules/Schedules";
import Kanban from "../../screens/Kanban/Kanban";
import CommandPalette from "./CommandPalette";
import AgentPreviewPanel from "./AgentPreviewPanel";
import ProjectsSidebar from "./ProjectsSidebar";
import {
  Columns2,
  Eye,
  Folder,
  FolderOpen,
  Plus,
  SquareStack,
  X,
} from "lucide-react";

type View =
  | "chat"
  | "sessions"
  | "memory"
  | "soul"
  | "skills"
  | "tools"
  | "gateway"
  | "settings"
  | "models"
  | "schedules"
  | "kanban";

type ConversationViewMode = "tabs" | "split";

interface ConversationTab {
  id: string;
  sessionId: string | null;
  profile: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

function createConversationTab(
  profile = "default",
  sessionId: string | null = null,
): ConversationTab {
  const now = Date.now();
  const id = `conversation-${now}-${Math.random().toString(16).slice(2)}`;
  return {
    id,
    sessionId,
    profile,
    title: sessionId ? `Session ${sessionId.slice(0, 6)}` : "New chat",
    createdAt: now,
    updatedAt: now,
  };
}

function labelForProfile(profile: string): string {
  return profile === "default" ? "Default Agent" : profile;
}

function labelForConversation(tab: ConversationTab): string {
  return tab.sessionId ? tab.title : "New chat";
}

const Layout80m: React.FC = () => {
  const [activeView, setActiveView] = useState<View>("chat");
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [activeChatRuns, setActiveChatRuns] = useState(0);
  const [runningConversationIds, setRunningConversationIds] = useState<
    Set<string>
  >(new Set());
  const initialConversationRef = React.useRef<ConversationTab | null>(null);
  if (!initialConversationRef.current) {
    initialConversationRef.current = createConversationTab();
  }
  const [conversations, setConversations] = useState<ConversationTab[]>(() => [
    initialConversationRef.current!,
  ]);
  const [activeConversationId, setActiveConversationId] = useState<string>(
    () => initialConversationRef.current!.id,
  );
  const [conversationViewMode, setConversationViewMode] =
    useState<ConversationViewMode>("tabs");

  const activeConversation =
    conversations.find((tab) => tab.id === activeConversationId) ||
    conversations[0];
  const selectedAgent = activeConversation?.profile || "default";
  const currentSession = activeConversation?.sessionId || null;

  // Projects state
  const [activeProject, setActiveProject] = useState<string | null>(() => {
    return localStorage.getItem("hermes-active-project") || null;
  });

  const handleProjectChange = useCallback((path: string | null) => {
    setActiveProject(path);
    if (path) {
      localStorage.setItem("hermes-active-project", path);
    } else {
      localStorage.removeItem("hermes-active-project");
    }
  }, []);

  const handleSelectProjectFolder = useCallback(async () => {
    if (!window.hermesAPI) return;
    const path = await window.hermesAPI.selectProjectDirectory();
    if (path) {
      handleProjectChange(path);
    }
  }, [handleProjectChange]);

  const handleFileClick = useCallback((path: string) => {
    // Inject file focus command via a custom event that InputBar / ChatArea can listen to
    const ev = new CustomEvent("inject-chat", {
      detail: `[System: User opened file ${path}]`,
    });
    window.dispatchEvent(ev);
  }, []);

  const openConversation = useCallback(
    (sessionId: string | null = null, profile = selectedAgent) => {
      if (sessionId) {
        const existing = conversations.find(
          (tab) => tab.sessionId === sessionId,
        );
        if (existing) {
          setActiveConversationId(existing.id);
          setActiveView("chat");
          return;
        }
      }

      const tab = createConversationTab(profile, sessionId);
      setConversations((current) => [...current, tab]);
      setActiveConversationId(tab.id);
      setActiveView("chat");
    },
    [conversations, selectedAgent],
  );

  const handleNewSession = useCallback(() => {
    // Hermes owns session ids. First send creates a real Hermes session and
    // ChatArea reports it back to the owning conversation tab.
    openConversation(null, selectedAgent);
    setActiveView("chat");
  }, [openConversation, selectedAgent]);

  const handleConversationSessionChange = useCallback(
    (conversationId: string, sessionId: string | null) => {
      setConversations((current) =>
        current.map((tab) => {
          if (tab.id !== conversationId) return tab;
          return {
            ...tab,
            sessionId,
            title: sessionId ? `Session ${sessionId.slice(0, 6)}` : "New chat",
            updatedAt: Date.now(),
          };
        }),
      );
    },
    [],
  );

  const handleSelectSession = useCallback(
    (id: string | null) => {
      if (id === null) {
        // New chat requested via sidebar
        handleNewSession();
        return;
      }
      openConversation(id, selectedAgent);
    },
    [handleNewSession, openConversation, selectedAgent],
  );

  const handleCloseConversation = useCallback(
    (id: string) => {
      if (runningConversationIds.has(id)) return;

      setConversations((current) => {
        if (current.length <= 1) {
          const replacement = createConversationTab(selectedAgent);
          setActiveConversationId(replacement.id);
          return [replacement];
        }

        const closeIndex = current.findIndex((tab) => tab.id === id);
        const next = current.filter((tab) => tab.id !== id);
        if (activeConversationId === id) {
          const nextIndex = Math.max(0, closeIndex - 1);
          setActiveConversationId(next[nextIndex]?.id || next[0].id);
        }
        return next;
      });
    },
    [activeConversationId, runningConversationIds, selectedAgent],
  );

  const handleBackToChat = useCallback(() => {
    setActiveView("chat");
  }, []);

  const handleViewChange = useCallback((v: string) => {
    setActiveView(v as View);
  }, []);

  // Ctrl+K / Cmd+K to open command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandPalette((p) => !p);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Listen for custom slash command events from InputBar
  useEffect(() => {
    const handleLayoutCmd = ((e: CustomEvent<string>) => {
      const cmd = e.detail;
      if (cmd === "new" || cmd === "clear") {
        handleNewSession();
      } else if (cmd === "settings") {
        setActiveView("settings");
      }
    }) as EventListener;
    window.addEventListener("layout-cmd", handleLayoutCmd);
    return () => window.removeEventListener("layout-cmd", handleLayoutCmd);
  }, [handleNewSession]);

  useEffect(() => {
    const handleChatStarted = (event: Event) => {
      const detail = (
        event as CustomEvent<{ conversationId?: string; requestId?: string }>
      ).detail;
      setActiveChatRuns((count) => count + 1);
      if (detail?.conversationId) {
        setRunningConversationIds((current) => {
          const next = new Set(current);
          next.add(detail.conversationId!);
          return next;
        });
      }
    };
    const handleChatFinished = (event: Event) => {
      const detail = (
        event as CustomEvent<{ conversationId?: string; requestId?: string }>
      ).detail;
      setActiveChatRuns((count) => Math.max(0, count - 1));
      if (detail?.conversationId) {
        setRunningConversationIds((current) => {
          const next = new Set(current);
          next.delete(detail.conversationId!);
          return next;
        });
      }
    };

    window.addEventListener("chat-started", handleChatStarted);
    window.addEventListener("chat-finished", handleChatFinished);
    return () => {
      window.removeEventListener("chat-started", handleChatStarted);
      window.removeEventListener("chat-finished", handleChatFinished);
    };
  }, []);

  useEffect(() => {
    const handlePreviewUrl = () => {
      setShowPreview(true);
    };
    window.addEventListener("open-agent-preview-url", handlePreviewUrl);
    return () =>
      window.removeEventListener("open-agent-preview-url", handlePreviewUrl);
  }, []);

  const renderMainContent = () => {
    const wrap = (_title: string, el: ReactNode) => (
      <div className="main-80m">
        <div className="screen-content-80m">{el}</div>
      </div>
    );

    const chatShell = (
      <div
        style={{
          display: activeView === "chat" ? "flex" : "none",
          flex: 1,
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        {activeProject && (
          <ProjectsSidebar
            activeProject={activeProject}
            onProjectChange={handleProjectChange}
            onFileClick={handleFileClick}
          />
        )}
        <div
          className="conversation-shell"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            minWidth: 0,
          }}
        >
          <div className="conversation-toolbar">
            <button
              className={`conversation-icon-btn conversation-project-btn${activeProject ? " active" : ""}`}
              onClick={handleSelectProjectFolder}
              title={
                activeProject
                  ? `Workspace: ${activeProject}`
                  : "Open Project Folder"
              }
              type="button"
            >
              {activeProject ? <FolderOpen size={14} /> : <Folder size={14} />}
            </button>

            <div
              className="conversation-tabs"
              role="tablist"
              aria-label="Open conversations"
            >
              {conversations.map((tab) => {
                const isActive = tab.id === activeConversationId;
                const isRunning = runningConversationIds.has(tab.id);
                return (
                  <div
                    key={tab.id}
                    className={`conversation-tab-wrap${isActive ? " active" : ""}${isRunning ? " running" : ""}`}
                  >
                    <button
                      className="conversation-tab"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => {
                        setActiveConversationId(tab.id);
                        setActiveView("chat");
                      }}
                      title={`${labelForConversation(tab)} - ${labelForProfile(tab.profile)}`}
                    >
                      <span className="conversation-tab-dot" />
                      <span className="conversation-tab-copy">
                        <span className="conversation-tab-title">
                          {labelForConversation(tab)}
                        </span>
                        <span className="conversation-tab-agent">
                          {labelForProfile(tab.profile)}
                        </span>
                      </span>
                    </button>
                    <button
                      className="conversation-tab-close"
                      onClick={() => handleCloseConversation(tab.id)}
                      disabled={isRunning}
                      title={
                        isRunning
                          ? "Conversation is running"
                          : "Close conversation"
                      }
                      type="button"
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
              <button
                className="conversation-icon-btn conversation-add-btn"
                onClick={handleNewSession}
                title="New conversation"
                type="button"
              >
                <Plus size={14} />
              </button>
            </div>

            <div className="conversation-action-cluster" aria-label="Chat view">
              <button
                className={`conversation-icon-btn${conversationViewMode === "tabs" ? " active" : ""}`}
                onClick={() => setConversationViewMode("tabs")}
                title="Tabbed conversations"
                type="button"
              >
                <SquareStack size={14} />
              </button>
              <button
                className={`conversation-icon-btn${conversationViewMode === "split" ? " active" : ""}`}
                onClick={() => setConversationViewMode("split")}
                title="Split screen conversations"
                type="button"
              >
                <Columns2 size={14} />
              </button>
              <button
                className={`conversation-icon-btn${showPreview ? " active" : ""}`}
                onClick={() => setShowPreview((open) => !open)}
                title={
                  showPreview
                    ? "Hide Agent Browser Preview"
                    : "Show Agent Browser Preview"
                }
                type="button"
              >
                <Eye size={14} />
              </button>
            </div>
          </div>

          <div
            className={`conversation-workspace conversation-workspace--${conversationViewMode}`}
          >
            {conversations.map((tab) => {
              const isActive = tab.id === activeConversationId;
              const isVisible = conversationViewMode === "split" || isActive;
              const isRunning = runningConversationIds.has(tab.id);

              return (
                <section
                  key={tab.id}
                  className={`conversation-pane${isActive ? " active" : ""}${isRunning ? " running" : ""}`}
                  style={{ display: isVisible ? "flex" : "none" }}
                  aria-hidden={!isVisible}
                >
                  <div className="conversation-pane-header">
                    <button
                      className="conversation-pane-title"
                      onClick={() => setActiveConversationId(tab.id)}
                      type="button"
                      title={`${labelForConversation(tab)} - ${labelForProfile(tab.profile)}`}
                    >
                      <span className="conversation-tab-dot" />
                      <span>{labelForConversation(tab)}</span>
                      <small>{labelForProfile(tab.profile)}</small>
                    </button>
                    <button
                      className="conversation-tab-close"
                      onClick={() => handleCloseConversation(tab.id)}
                      disabled={isRunning}
                      title={
                        isRunning
                          ? "Conversation is running"
                          : "Close conversation"
                      }
                      type="button"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <ChatArea
                    conversationId={tab.id}
                    currentSession={tab.sessionId}
                    onNewSession={() => undefined}
                    onSessionChange={(sessionId) =>
                      handleConversationSessionChange(tab.id, sessionId || null)
                    }
                    profile={
                      tab.profile !== "default" ? tab.profile : undefined
                    }
                    activeProject={activeProject}
                    isAudible={
                      conversationViewMode === "split" ||
                      activeConversationId === tab.id
                    }
                  />
                </section>
              );
            })}
          </div>
        </div>
      </div>
    );

    let activePanel: ReactNode = null;
    switch (activeView) {
      case "chat":
        break;
      case "sessions":
        activePanel = (
          <Sessions
            onResumeSession={(id) => openConversation(id, selectedAgent)}
            onNewChat={handleNewSession}
            currentSessionId={currentSession}
          />
        );
        break;
      case "memory":
        activePanel = (
          <Memory
            profile={selectedAgent !== "default" ? selectedAgent : undefined}
          />
        );
        break;
      case "soul":
        activePanel = wrap(
          "SOUL",
          <Soul
            profile={selectedAgent !== "default" ? selectedAgent : undefined}
          />,
        );
        break;
      case "skills":
        activePanel = wrap(
          "SKILLS",
          <Skills
            profile={selectedAgent !== "default" ? selectedAgent : undefined}
          />,
        );
        break;
      case "tools":
        activePanel = wrap(
          "TOOLS",
          <Tools
            profile={selectedAgent !== "default" ? selectedAgent : undefined}
          />,
        );
        break;
      case "gateway":
        activePanel = wrap("GATEWAY", <Gateway />);
        break;
      case "settings":
        activePanel = (
          <Settings
            onBack={handleBackToChat}
            profile={selectedAgent !== "default" ? selectedAgent : undefined}
          />
        );
        break;
      case "models":
        activePanel = wrap("MODELS", <Models />);
        break;
      case "schedules":
        activePanel = wrap(
          "SCHEDULES",
          <Schedules
            profile={selectedAgent !== "default" ? selectedAgent : undefined}
          />,
        );
        break;
      case "kanban":
        activePanel = wrap("KANBAN", <Kanban />);
        break;
      default:
        break;
    }

    return (
      <div
        style={{ display: "flex", flex: 1, overflow: "hidden", minWidth: 0 }}
      >
        {chatShell}
        {activePanel}
      </div>
    );
  };

  const handleAgentChange = useCallback(
    (agent: string) => {
      setConversations((current) =>
        current.map((tab) => {
          if (tab.id !== activeConversationId) return tab;
          return {
            ...tab,
            profile: agent,
            sessionId: agent !== tab.profile ? null : tab.sessionId,
            title: agent !== tab.profile ? "New chat" : tab.title,
            updatedAt: Date.now(),
          };
        }),
      );
    },
    [activeConversationId],
  );

  const agentThemeClass =
    selectedAgent && selectedAgent !== "default"
      ? `theme-${selectedAgent.toLowerCase().replace(/\s+/g, "-")}`
      : "";

  return (
    <div className={`layout-80m ${agentThemeClass}`}>
      <Sidebar
        activeView={activeView}
        onViewChange={handleViewChange}
        currentSession={currentSession}
        onSelectSession={handleSelectSession}
        selectedAgent={selectedAgent}
        onAgentChange={handleAgentChange}
      />
      {renderMainContent()}

      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onNavigate={(view) => {
          setActiveView(view as View);
          setShowCommandPalette(false);
        }}
        onNewChat={() => {
          handleNewSession();
          setShowCommandPalette(false);
        }}
      />

      <AgentPreviewPanel
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        activeProject={activeProject}
        isAgentWorking={activeChatRuns > 0}
      />

      {/* Expose toggle for Ctrl+K via a custom event */}
      <div
        id="layout80m-cmd-toggle"
        style={{ display: "none" }}
        onClick={() => setShowCommandPalette((p) => !p)}
      />

      {/* Global CRT Scanlines Overlay */}
      <div className="crt-overlay pointer-events-none" />
    </div>
  );
};

export default Layout80m;

import React from "react";
import {
  Brain,
  Columns2,
  Eye,
  Folder,
  FolderOpen,
  Plus,
  SquareStack,
  X,
} from "lucide-react";
import ChatArea from "./ChatArea";
import ProjectsSidebar from "./ProjectsSidebar";
import {
  ConversationTab,
  ConversationViewMode,
  labelForConversation,
  labelForProfile,
} from "./conversations";

interface ConversationWorkspaceProps {
  activeConversationId: string;
  activeProject: string | null;
  activeViewIsChat: boolean;
  conversationViewMode: ConversationViewMode;
  conversations: ConversationTab[];
  runningConversationIds: Set<string>;
  showProjectsSidebar: boolean;
  showPreview: boolean;
  onActiveConversationChange: (id: string) => void;
  onCloseConversation: (id: string) => void;
  onConversationSessionChange: (
    conversationId: string,
    sessionId: string | null,
  ) => void;
  onConversationViewModeChange: (mode: ConversationViewMode) => void;
  onFileClick: (path: string) => void;
  onNewSession: () => void;
  onOpenSecondBrain: () => void;
  onPreviewToggle: () => void;
  onProjectChange: (path: string | null) => void;
  onProjectToolbarToggle: () => void;
}

const ConversationWorkspace: React.FC<ConversationWorkspaceProps> = ({
  activeConversationId,
  activeProject,
  activeViewIsChat,
  conversationViewMode,
  conversations,
  runningConversationIds,
  showProjectsSidebar,
  showPreview,
  onActiveConversationChange,
  onCloseConversation,
  onConversationSessionChange,
  onConversationViewModeChange,
  onFileClick,
  onNewSession,
  onOpenSecondBrain,
  onPreviewToggle,
  onProjectChange,
  onProjectToolbarToggle,
}) => {
  return (
    <div
      style={{
        display: activeViewIsChat ? "flex" : "none",
        flex: 1,
        overflow: "hidden",
        minWidth: 0,
      }}
    >
      {activeProject && showProjectsSidebar && (
        <ProjectsSidebar
          activeProject={activeProject}
          onProjectChange={onProjectChange}
          onFileClick={onFileClick}
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
            className="conversation-icon-btn conversation-brain-btn"
            onClick={onOpenSecondBrain}
            title="Second Brain"
            type="button"
          >
            <span className="conversation-brain-pulse">
              <Brain size={15} />
            </span>
          </button>
          <button
            className={`conversation-icon-btn conversation-project-btn${activeProject && showProjectsSidebar ? " active" : ""}`}
            onClick={onProjectToolbarToggle}
            title={
              activeProject
                ? showProjectsSidebar
                  ? `Close project: ${activeProject}`
                  : `Show workspace: ${activeProject}`
                : "Open Project Folder"
            }
            type="button"
          >
            {activeProject && showProjectsSidebar ? (
              <FolderOpen size={14} />
            ) : (
              <Folder size={14} />
            )}
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
                    onClick={() => onActiveConversationChange(tab.id)}
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
                    onClick={() => onCloseConversation(tab.id)}
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
              onClick={onNewSession}
              title="New conversation"
              type="button"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="conversation-action-cluster" aria-label="Chat view">
            <button
              className={`conversation-icon-btn${conversationViewMode === "tabs" ? " active" : ""}`}
              onClick={() => onConversationViewModeChange("tabs")}
              title="Tabbed conversations"
              type="button"
            >
              <SquareStack size={14} />
            </button>
            <button
              className={`conversation-icon-btn${conversationViewMode === "split" ? " active" : ""}`}
              onClick={() => onConversationViewModeChange("split")}
              title="Split screen conversations"
              type="button"
            >
              <Columns2 size={14} />
            </button>
            <button
              className={`conversation-icon-btn${showPreview ? " active" : ""}`}
              onClick={onPreviewToggle}
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
                    onClick={() => onActiveConversationChange(tab.id)}
                    type="button"
                    title={`${labelForConversation(tab)} - ${labelForProfile(tab.profile)}`}
                  >
                    <span className="conversation-tab-dot" />
                    <span>{labelForConversation(tab)}</span>
                    <small>{labelForProfile(tab.profile)}</small>
                  </button>
                  <button
                    className="conversation-tab-close"
                    onClick={() => onCloseConversation(tab.id)}
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
                    onConversationSessionChange(tab.id, sessionId || null)
                  }
                  profile={tab.profile !== "default" ? tab.profile : undefined}
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
};

export default ConversationWorkspace;

import React from "react";
import AgentPreviewPanel from "./AgentPreviewPanel";

interface AgentPreviewDockProps {
  activeProject: string | null;
  isAgentWorking: boolean;
  onClose: () => void;
  onResizeStart: (event: React.MouseEvent<HTMLDivElement>) => void;
  width: number;
}

const AgentPreviewDock: React.FC<AgentPreviewDockProps> = ({
  activeProject,
  isAgentWorking,
  onClose,
  onResizeStart,
  width,
}) => (
  <aside
    className="agent-preview-dock"
    style={{ width }}
    aria-label="Agent browser preview"
  >
    <div
      className="agent-preview-resize-handle"
      onMouseDown={onResizeStart}
      role="separator"
      aria-orientation="vertical"
      title="Resize Preview"
    />
    <AgentPreviewPanel
      isOpen
      onClose={onClose}
      activeProject={activeProject}
      isAgentWorking={isAgentWorking}
    />
  </aside>
);

export default AgentPreviewDock;

import type React from "react";
import type { KanbanTask } from "./kanbanTypes";
import { badgeLabel, formatTime } from "./kanbanUtils";

interface TaskCardProps {
  task: KanbanTask;
  active: boolean;
  onClick: () => void;
}

export default function TaskCard({
  task,
  active,
  onClick,
}: TaskCardProps): React.JSX.Element {
  return (
    <button
      className={`kanban-card ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <div className="kanban-card-top">
        <span className="kanban-card-id">{task.id}</span>
        {task.priority !== 0 && (
          <b className="kanban-priority">P{task.priority}</b>
        )}
      </div>
      <strong>{task.title}</strong>
      {task.body && <p>{task.body}</p>}
      <div className="kanban-card-meta">
        <span>{badgeLabel(task)}</span>
        <span>{formatTime(task.created_at)}</span>
      </div>
      {task.skills?.length > 0 && (
        <div className="kanban-skill-row">
          {task.skills.slice(0, 3).map((skill) => (
            <span key={skill}>{skill}</span>
          ))}
        </div>
      )}
    </button>
  );
}

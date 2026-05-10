import type { Dispatch, SetStateAction } from "react";
import {
  Archive,
  Ban,
  CheckCircle2,
  MessageSquare,
  Send,
  UserPlus,
  X,
} from "lucide-react";
import type {
  KanbanBoardData,
  KanbanStatus,
  KanbanTaskDetails,
} from "./kanbanTypes";
import { formatTime } from "./kanbanUtils";
import type { KanbanTaskDraft } from "./KanbanCreateModal";

interface KanbanDrawerProps {
  action: string | null;
  selected: KanbanTaskDetails;
  spawnableAssignees: KanbanBoardData["assignees"];
  newTask: KanbanTaskDraft;
  commentText: string;
  completionSummary: string;
  blockReason: string;
  setSelected: (task: KanbanTaskDetails | null) => void;
  setNewTask: Dispatch<SetStateAction<KanbanTaskDraft>>;
  setCommentText: Dispatch<SetStateAction<string>>;
  setCompletionSummary: Dispatch<SetStateAction<string>>;
  setBlockReason: Dispatch<SetStateAction<string>>;
  onRunTaskAction: (
    taskId: string,
    status: KanbanStatus,
    options?: {
      reason?: string;
      summary?: string;
      metadata?: Record<string, unknown>;
    },
  ) => void;
  onAssignTask: (taskId: string) => void;
  onAddComment: () => void;
}

export function KanbanDrawer({
  action,
  selected,
  spawnableAssignees,
  newTask,
  commentText,
  completionSummary,
  blockReason,
  setSelected,
  setNewTask,
  setCommentText,
  setCompletionSummary,
  setBlockReason,
  onRunTaskAction,
  onAssignTask,
  onAddComment,
}: KanbanDrawerProps): React.JSX.Element {
  return (
    <aside className="kanban-drawer">
      <div className="kanban-drawer-header">
        <div>
          <span className="kanban-card-id">{selected.task.id}</span>
          <h3>{selected.task.title}</h3>
        </div>
        <button className="btn-ghost" onClick={() => setSelected(null)}>
          <X size={16} />
        </button>
      </div>
      <div className="kanban-drawer-body">
        <div className="kanban-detail-grid">
          <span>Status</span>
          <b>{selected.task.status}</b>
          <span>Assignee</span>
          <b>{selected.task.assignee || "unassigned"}</b>
          <span>Tenant</span>
          <b>{selected.task.tenant || "default"}</b>
          <span>Created</span>
          <b>{formatTime(selected.task.created_at)}</b>
        </div>

        {selected.task.body && (
          <div className="kanban-detail-section">
            <h4>Body</h4>
            <p>{selected.task.body}</p>
          </div>
        )}

        <div className="kanban-action-grid">
          <button
            className="btn btn-secondary"
            onClick={() => onRunTaskAction(selected.task.id, "ready")}
            disabled={action?.startsWith(selected.task.id)}
          >
            <Send size={14} />
            Ready
          </button>
          <button
            className="btn btn-secondary"
            onClick={() =>
              onRunTaskAction(selected.task.id, "blocked", {
                reason: blockReason || "Needs input from 80m desktop",
              })
            }
            disabled={action?.startsWith(selected.task.id)}
          >
            <Ban size={14} />
            Block
          </button>
          <button
            className="btn btn-secondary"
            onClick={() =>
              onRunTaskAction(selected.task.id, "done", {
                summary:
                  completionSummary || "Completed from 80m desktop Kanban.",
              })
            }
            disabled={action?.startsWith(selected.task.id)}
          >
            <CheckCircle2 size={14} />
            Done
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => onRunTaskAction(selected.task.id, "archived")}
            disabled={action?.startsWith(selected.task.id)}
          >
            <Archive size={14} />
            Archive
          </button>
        </div>

        <label>
          Completion summary
          <textarea
            className="input kanban-textarea"
            value={completionSummary}
            onChange={(e) => setCompletionSummary(e.target.value)}
            rows={3}
          />
        </label>
        <label>
          Block reason
          <input
            className="input"
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
          />
        </label>
        <label>
          Assign profile
          <div className="kanban-inline-action">
            <select
              className="input"
              value={newTask.assignee}
              onChange={(e) =>
                setNewTask((t) => ({ ...t, assignee: e.target.value }))
              }
            >
              <option value="">Unassigned</option>
              {spawnableAssignees.map((assignee) => (
                <option key={assignee.name} value={assignee.name}>
                  {assignee.name}
                </option>
              ))}
            </select>
            <button
              className="btn btn-secondary"
              onClick={() => onAssignTask(selected.task.id)}
              disabled={action === `${selected.task.id}:assign`}
            >
              <UserPlus size={14} />
            </button>
          </div>
        </label>

        <div className="kanban-detail-section">
          <h4>Comments</h4>
          <div className="kanban-comment-list">
            {selected.comments.length === 0 && (
              <div className="kanban-empty">No comments</div>
            )}
            {selected.comments.map((comment, index) => (
              <div
                key={`${comment.created_at}-${index}`}
                className="kanban-comment"
              >
                <span>
                  {comment.author} - {formatTime(comment.created_at)}
                </span>
                <p>{comment.body}</p>
              </div>
            ))}
          </div>
          <div className="kanban-inline-action">
            <input
              className="input"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add durable note"
            />
            <button
              className="btn btn-secondary"
              onClick={onAddComment}
              disabled={!commentText.trim() || action === "comment"}
            >
              <MessageSquare size={14} />
            </button>
          </div>
        </div>

        <div className="kanban-detail-section">
          <h4>Run History</h4>
          <div className="kanban-run-list">
            {selected.runs.length === 0 && (
              <div className="kanban-empty">No runs yet</div>
            )}
            {selected.runs.map((run) => (
              <div key={run.id} className="kanban-run">
                <div>
                  <b>{run.outcome || run.status}</b>
                  <span>{run.profile || "unknown"}</span>
                </div>
                <p>{run.summary || run.error || "No summary"}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

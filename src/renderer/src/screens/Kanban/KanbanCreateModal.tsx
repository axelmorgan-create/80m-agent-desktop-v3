import type { Dispatch, SetStateAction } from "react";
import { Plus, X } from "lucide-react";
import type { KanbanBoardData } from "./kanbanTypes";

export interface KanbanTaskDraft {
  title: string;
  body: string;
  assignee: string;
  tenant: string;
  priority: string;
  workspace: string;
  maxRuntime: string;
  skills: string;
  triage: boolean;
}

interface KanbanCreateModalProps {
  action: string | null;
  newTask: KanbanTaskDraft;
  setNewTask: Dispatch<SetStateAction<KanbanTaskDraft>>;
  spawnableAssignees: KanbanBoardData["assignees"];
  onClose: () => void;
  onCreate: () => void;
}

export function KanbanCreateModal({
  action,
  newTask,
  setNewTask,
  spawnableAssignees,
  onClose,
  onCreate,
}: KanbanCreateModalProps): React.JSX.Element {
  return (
    <div className="skills-detail-overlay" onClick={onClose}>
      <div className="kanban-modal" onClick={(e) => e.stopPropagation()}>
        <div className="kanban-modal-header">
          <h3>New Kanban Task</h3>
          <button className="btn-ghost" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="kanban-modal-body">
          <label>
            Title
            <input
              className="input"
              value={newTask.title}
              onChange={(e) =>
                setNewTask((t) => ({ ...t, title: e.target.value }))
              }
              placeholder="Design auth schema"
            />
          </label>
          <label>
            Body
            <textarea
              className="input kanban-textarea"
              value={newTask.body}
              onChange={(e) =>
                setNewTask((t) => ({ ...t, body: e.target.value }))
              }
              placeholder="Acceptance criteria, handoff notes, constraints"
              rows={4}
            />
          </label>
          <div className="kanban-form-grid">
            <label>
              Assignee
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
            </label>
            <label>
              Tenant
              <input
                className="input"
                value={newTask.tenant}
                onChange={(e) =>
                  setNewTask((t) => ({ ...t, tenant: e.target.value }))
                }
                placeholder="content-ops"
              />
            </label>
            <label>
              Priority
              <input
                className="input"
                type="number"
                value={newTask.priority}
                onChange={(e) =>
                  setNewTask((t) => ({ ...t, priority: e.target.value }))
                }
              />
            </label>
            <label>
              Max runtime
              <input
                className="input"
                value={newTask.maxRuntime}
                onChange={(e) =>
                  setNewTask((t) => ({ ...t, maxRuntime: e.target.value }))
                }
                placeholder="30m"
              />
            </label>
          </div>
          <label>
            Workspace
            <input
              className="input"
              value={newTask.workspace}
              onChange={(e) =>
                setNewTask((t) => ({ ...t, workspace: e.target.value }))
              }
              placeholder="scratch | worktree | dir:/absolute/path"
            />
          </label>
          <label>
            Skills
            <input
              className="input"
              value={newTask.skills}
              onChange={(e) =>
                setNewTask((t) => ({ ...t, skills: e.target.value }))
              }
              placeholder="github-code-review, translation"
            />
          </label>
          <label className="kanban-checkbox">
            <input
              type="checkbox"
              checked={newTask.triage}
              onChange={(e) =>
                setNewTask((t) => ({ ...t, triage: e.target.checked }))
              }
            />
            Park in triage
          </label>
        </div>
        <div className="kanban-modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={onCreate}
            disabled={!newTask.title.trim() || action === "create"}
          >
            <Plus size={14} />
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

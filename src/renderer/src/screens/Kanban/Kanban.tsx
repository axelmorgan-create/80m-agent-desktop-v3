import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Archive,
  Ban,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  FileText,
  FolderOpen,
  GitBranch,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  UserPlus,
  X,
  Zap,
} from "lucide-react";

type KanbanStatus =
  | "triage"
  | "todo"
  | "ready"
  | "running"
  | "blocked"
  | "done"
  | "archived";

interface KanbanTask {
  id: string;
  title: string;
  body: string | null;
  assignee: string | null;
  status: KanbanStatus;
  priority: number;
  tenant: string | null;
  workspace_kind: string;
  workspace_path: string | null;
  created_by: string | null;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
  result: string | null;
  skills: string[];
}

interface KanbanBoardData {
  tasks: KanbanTask[];
  columns: Record<KanbanStatus, KanbanTask[]>;
  boards: Array<{ slug: string; name: string; is_current?: boolean }>;
  assignees: Array<{
    name: string;
    on_disk: boolean;
    counts: Record<string, number>;
  }>;
  stats: {
    by_status: Record<string, number>;
    by_assignee: Record<string, Record<string, number>>;
    oldest_ready_age_seconds: number | null;
    now: number;
  };
  docs: KanbanDocs;
}

interface KanbanTaskDetails {
  task: KanbanTask;
  parents: string[];
  children: string[];
  comments: Array<{ author: string; body: string; created_at: number }>;
  events: Array<{
    kind: string;
    payload: unknown;
    created_at: number;
    run_id: number | null;
  }>;
  runs: Array<{
    id: number;
    profile: string | null;
    status: string;
    outcome: string | null;
    summary: string | null;
    error: string | null;
    metadata: string | null;
    started_at: number;
    ended_at: number | null;
  }>;
}

interface KanbanDocs {
  pluginPath: string;
  releaseNotesPath: string;
  overviewPath: string;
  tutorialPath: string;
  workerPath: string;
  orchestratorPath: string;
  specPath: string;
  mediumPagePath: string;
  officialDocsUrl: string;
  officialTutorialUrl: string;
  upstreamPluginUrl: string;
  upstreamReleaseUrl: string;
}

interface KanbanCommandResult<T = unknown> {
  success: boolean;
  data?: T;
  output?: string;
  error?: string;
}

const COLUMNS: Array<{
  id: KanbanStatus;
  label: string;
  short: string;
}> = [
  { id: "triage", label: "Triage", short: "Spec" },
  { id: "todo", label: "Todo", short: "Queued" },
  { id: "ready", label: "Ready", short: "Dispatch" },
  { id: "running", label: "In progress", short: "Live" },
  { id: "blocked", label: "Blocked", short: "Needs input" },
  { id: "done", label: "Done", short: "Closed" },
];

const EMPTY_COLUMNS = COLUMNS.reduce(
  (acc, col) => ({ ...acc, [col.id]: [] }),
  {} as Record<KanbanStatus, KanbanTask[]>,
);

function formatAge(seconds: number | null | undefined): string {
  if (seconds == null) return "--";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function formatTime(ts: number | null | undefined): string {
  if (!ts) return "--";
  return new Date(ts * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseSkillList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function taskMatches(
  task: KanbanTask,
  query: string,
  assignee: string,
): boolean {
  if (assignee && task.assignee !== assignee) return false;
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  return [
    task.id,
    task.title,
    task.body || "",
    task.assignee || "",
    task.tenant || "",
  ]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

function badgeLabel(task: KanbanTask): string {
  if (task.tenant) return task.tenant;
  if (task.assignee) return task.assignee;
  return task.workspace_kind;
}

export default function Kanban(): React.JSX.Element {
  const [boardData, setBoardData] = useState<KanbanBoardData | null>(null);
  const [selected, setSelected] = useState<KanbanTaskDetails | null>(null);
  const [activeBoard, setActiveBoard] = useState<string>("default");
  const [tenantFilter, setTenantFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [lanesByProfile, setLanesByProfile] = useState(true);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [completionSummary, setCompletionSummary] = useState("");
  const [blockReason, setBlockReason] = useState("");

  const [newTask, setNewTask] = useState({
    title: "",
    body: "",
    assignee: "",
    tenant: "",
    priority: "0",
    workspace: "scratch",
    maxRuntime: "",
    skills: "",
    triage: false,
  });

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError("");
    const result = (await window.hermesAPI.listKanbanBoard({
      board: activeBoard,
      tenant: tenantFilter || undefined,
      includeArchived,
    })) as KanbanCommandResult<KanbanBoardData>;
    if (result.success && result.data) {
      setBoardData(result.data);
    } else {
      setError(result.error || "Failed to load Kanban board.");
    }
    setLoading(false);
  }, [activeBoard, tenantFilter, includeArchived]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadBoard();
    }, 20000);
    return () => window.clearInterval(timer);
  }, [loadBoard]);

  const filteredColumns = useMemo(() => {
    if (!boardData) return EMPTY_COLUMNS;
    return COLUMNS.reduce(
      (acc, col) => ({
        ...acc,
        [col.id]: (boardData.columns[col.id] || []).filter((task) =>
          taskMatches(task, search, assigneeFilter),
        ),
      }),
      {} as Record<KanbanStatus, KanbanTask[]>,
    );
  }, [boardData, search, assigneeFilter]);

  const tenants = useMemo(() => {
    const values = new Set<string>();
    for (const task of boardData?.tasks || []) {
      if (task.tenant) values.add(task.tenant);
    }
    return Array.from(values).sort();
  }, [boardData]);

  async function refreshSelected(taskId: string): Promise<void> {
    const result = (await window.hermesAPI.getKanbanTask(
      taskId,
      activeBoard,
    )) as KanbanCommandResult<KanbanTaskDetails>;
    if (result.success && result.data) {
      setSelected(result.data);
    }
  }

  async function openTask(task: KanbanTask): Promise<void> {
    setSelected({
      task,
      parents: [],
      children: [],
      comments: [],
      events: [],
      runs: [],
    });
    await refreshSelected(task.id);
  }

  async function runTaskAction(
    taskId: string,
    status: KanbanStatus,
    options: {
      reason?: string;
      summary?: string;
      metadata?: Record<string, unknown>;
    } = {},
  ): Promise<void> {
    setAction(`${taskId}:${status}`);
    setError("");
    const result = (await window.hermesAPI.updateKanbanTaskStatus(
      taskId,
      status,
      { ...options, board: activeBoard },
    )) as KanbanCommandResult;
    if (!result.success) {
      setError(result.error || "Task action failed.");
    }
    await loadBoard();
    await refreshSelected(taskId);
    setAction(null);
  }

  async function createTask(): Promise<void> {
    if (!newTask.title.trim()) return;
    setAction("create");
    setError("");
    const result = (await window.hermesAPI.createKanbanTask({
      title: newTask.title,
      body: newTask.body || undefined,
      assignee: newTask.assignee || undefined,
      tenant: newTask.tenant || undefined,
      priority: Number(newTask.priority) || 0,
      workspace: newTask.workspace || "scratch",
      maxRuntime: newTask.maxRuntime || undefined,
      skills: parseSkillList(newTask.skills),
      triage: newTask.triage,
      board: activeBoard,
    })) as KanbanCommandResult<KanbanTask>;
    if (!result.success) {
      setError(result.error || "Failed to create task.");
    } else {
      setShowCreate(false);
      setNewTask({
        title: "",
        body: "",
        assignee: "",
        tenant: "",
        priority: "0",
        workspace: "scratch",
        maxRuntime: "",
        skills: "",
        triage: false,
      });
      await loadBoard();
      if (result.data) await openTask(result.data);
    }
    setAction(null);
  }

  async function assignTask(taskId: string): Promise<void> {
    setAction(`${taskId}:assign`);
    const result = (await window.hermesAPI.assignKanbanTask(
      taskId,
      newTask.assignee || null,
      activeBoard,
    )) as KanbanCommandResult;
    if (!result.success) setError(result.error || "Failed to assign task.");
    await loadBoard();
    await refreshSelected(taskId);
    setAction(null);
  }

  async function addComment(): Promise<void> {
    if (!selected || !commentText.trim()) return;
    setAction("comment");
    const result = (await window.hermesAPI.commentKanbanTask(
      selected.task.id,
      commentText,
      activeBoard,
    )) as KanbanCommandResult;
    if (!result.success) {
      setError(result.error || "Failed to add comment.");
    } else {
      setCommentText("");
      await refreshSelected(selected.task.id);
    }
    setAction(null);
  }

  async function nudgeDispatcher(): Promise<void> {
    setAction("dispatch");
    const result = (await window.hermesAPI.nudgeKanbanDispatcher(
      activeBoard,
    )) as KanbanCommandResult;
    if (!result.success) setError(result.error || "Dispatcher nudge failed.");
    await loadBoard();
    setAction(null);
  }

  const docs = boardData?.docs;

  return (
    <div className="kanban-container">
      {showCreate && (
        <div
          className="skills-detail-overlay"
          onClick={() => setShowCreate(false)}
        >
          <div className="kanban-modal" onClick={(e) => e.stopPropagation()}>
            <div className="kanban-modal-header">
              <h3>New Kanban Task</h3>
              <button
                className="btn-ghost"
                onClick={() => setShowCreate(false)}
              >
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
                  <input
                    className="input"
                    value={newTask.assignee}
                    onChange={(e) =>
                      setNewTask((t) => ({ ...t, assignee: e.target.value }))
                    }
                    placeholder="researcher"
                  />
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
              <button
                className="btn btn-secondary"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={createTask}
                disabled={!newTask.title.trim() || action === "create"}
              >
                <Plus size={14} />
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="kanban-header">
        <div className="kanban-title-block">
          <div className="kanban-eyebrow">
            <GitBranch size={14} />
            80M Kanban
          </div>
          <h2 className="kanban-title">Multi-Agent Board</h2>
          <div className="kanban-stats-row">
            <span>{boardData?.tasks.length || 0} tasks</span>
            <span>{boardData?.assignees.length || 0} profiles</span>
            <span>
              oldest ready{" "}
              {formatAge(boardData?.stats.oldest_ready_age_seconds)}
            </span>
          </div>
        </div>
        <div className="kanban-header-actions">
          <button
            className="btn btn-secondary"
            onClick={loadBoard}
            disabled={loading}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          <button
            className="btn btn-secondary"
            onClick={nudgeDispatcher}
            disabled={action === "dispatch"}
          >
            <Zap size={14} />
            Nudge
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreate(true)}
          >
            <Plus size={14} />
            New Task
          </button>
        </div>
      </div>

      {error && (
        <div className="skills-error kanban-error">
          {error}
          <button className="btn-ghost" onClick={() => setError("")}>
            <X size={14} />
          </button>
        </div>
      )}

      <div className="kanban-toolbar">
        <select
          className="input kanban-select"
          value={activeBoard}
          onChange={(e) => setActiveBoard(e.target.value)}
        >
          {(boardData?.boards.length
            ? boardData.boards
            : [{ slug: "default", name: "Default" }]
          ).map((board) => (
            <option key={board.slug} value={board.slug}>
              {board.name || board.slug}
            </option>
          ))}
        </select>
        <input
          className="input kanban-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks"
        />
        <select
          className="input kanban-select"
          value={tenantFilter}
          onChange={(e) => setTenantFilter(e.target.value)}
        >
          <option value="">All tenants</option>
          {tenants.map((tenant) => (
            <option key={tenant} value={tenant}>
              {tenant}
            </option>
          ))}
        </select>
        <select
          className="input kanban-select"
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
        >
          <option value="">All profiles</option>
          {(boardData?.assignees || []).map((assignee) => (
            <option key={assignee.name} value={assignee.name}>
              {assignee.name}
            </option>
          ))}
        </select>
        <button
          className={`kanban-toggle ${lanesByProfile ? "active" : ""}`}
          onClick={() => setLanesByProfile((v) => !v)}
        >
          Lanes by profile
        </button>
        <button
          className={`kanban-toggle ${includeArchived ? "active" : ""}`}
          onClick={() => setIncludeArchived((v) => !v)}
        >
          Archived
        </button>
      </div>

      <div className="kanban-main">
        <div className="kanban-board">
          {loading && !boardData ? (
            <div className="kanban-loading">
              <div className="loading-spinner" />
            </div>
          ) : (
            COLUMNS.map((column) => {
              const tasks = filteredColumns[column.id] || [];
              const runningByProfile =
                column.id === "running" && lanesByProfile
                  ? Object.entries(
                      tasks.reduce(
                        (acc, task) => {
                          const key = task.assignee || "unassigned";
                          acc[key] = [...(acc[key] || []), task];
                          return acc;
                        },
                        {} as Record<string, KanbanTask[]>,
                      ),
                    )
                  : [];

              return (
                <section
                  key={column.id}
                  className={`kanban-column kanban-${column.id}`}
                >
                  <div className="kanban-column-header">
                    <span
                      className={`kanban-status-dot kanban-status-${column.id}`}
                    />
                    <div>
                      <h3>{column.label}</h3>
                      <span>{column.short}</span>
                    </div>
                    <strong>{tasks.length}</strong>
                  </div>
                  <div className="kanban-column-body">
                    {tasks.length === 0 && (
                      <div className="kanban-empty">Empty</div>
                    )}
                    {runningByProfile.length > 0
                      ? runningByProfile.map(([profile, laneTasks]) => (
                          <div key={profile} className="kanban-lane">
                            <div className="kanban-lane-title">
                              <span>{profile}</span>
                              <b>{laneTasks.length}</b>
                            </div>
                            {laneTasks.map((task) => (
                              <TaskCard
                                key={task.id}
                                task={task}
                                active={selected?.task.id === task.id}
                                onClick={() => openTask(task)}
                              />
                            ))}
                          </div>
                        ))
                      : tasks.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            active={selected?.task.id === task.id}
                            onClick={() => openTask(task)}
                          />
                        ))}
                  </div>
                </section>
              );
            })
          )}
        </div>

        <aside className="kanban-research-panel">
          <div className="kanban-panel-section">
            <h3>Research Notes</h3>
            <DocButton
              icon={<BookOpen size={14} />}
              label="Overview"
              onClick={() =>
                docs && window.hermesAPI.openLocalPath(docs.overviewPath)
              }
            />
            <DocButton
              icon={<FileText size={14} />}
              label="Tutorial"
              onClick={() =>
                docs && window.hermesAPI.openLocalPath(docs.tutorialPath)
              }
            />
            <DocButton
              icon={<FileText size={14} />}
              label="Release Notes"
              onClick={() =>
                docs && window.hermesAPI.openLocalPath(docs.releaseNotesPath)
              }
            />
            <DocButton
              icon={<FileText size={14} />}
              label="Spec PDF"
              onClick={() =>
                docs && window.hermesAPI.openLocalPath(docs.specPath)
              }
            />
            <DocButton
              icon={<BookOpen size={14} />}
              label="Medium Page"
              onClick={() =>
                docs && window.hermesAPI.openLocalPath(docs.mediumPagePath)
              }
            />
          </div>
          <div className="kanban-panel-section">
            <h3>Sources</h3>
            <DocButton
              icon={<ExternalLink size={14} />}
              label="Official Docs"
              onClick={() =>
                docs && window.hermesAPI.openExternal(docs.officialDocsUrl)
              }
            />
            <DocButton
              icon={<ExternalLink size={14} />}
              label="Tutorial Online"
              onClick={() =>
                docs && window.hermesAPI.openExternal(docs.officialTutorialUrl)
              }
            />
            <DocButton
              icon={<FolderOpen size={14} />}
              label="Plugin Folder"
              onClick={() =>
                docs && window.hermesAPI.openLocalPath(docs.pluginPath)
              }
            />
          </div>
        </aside>
      </div>

      {selected && (
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
                onClick={() => runTaskAction(selected.task.id, "ready")}
                disabled={action?.startsWith(selected.task.id)}
              >
                <Send size={14} />
                Ready
              </button>
              <button
                className="btn btn-secondary"
                onClick={() =>
                  runTaskAction(selected.task.id, "blocked", {
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
                  runTaskAction(selected.task.id, "done", {
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
                onClick={() => runTaskAction(selected.task.id, "archived")}
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
                <input
                  className="input"
                  value={newTask.assignee}
                  onChange={(e) =>
                    setNewTask((t) => ({ ...t, assignee: e.target.value }))
                  }
                  placeholder="profile-name"
                />
                <button
                  className="btn btn-secondary"
                  onClick={() => assignTask(selected.task.id)}
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
                  onClick={addComment}
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
      )}
    </div>
  );
}

function TaskCard({
  task,
  active,
  onClick,
}: {
  task: KanbanTask;
  active: boolean;
  onClick: () => void;
}): React.JSX.Element {
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

function DocButton({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button className="kanban-doc-button" onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

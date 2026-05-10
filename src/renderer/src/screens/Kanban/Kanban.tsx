import { useCallback, useEffect, useMemo, useState } from "react";
import { GitBranch, Plus, RefreshCw, X, Zap } from "lucide-react";
import { KanbanBoardView } from "./KanbanBoardView";
import { KanbanCreateModal, type KanbanTaskDraft } from "./KanbanCreateModal";
import { KanbanDrawer } from "./KanbanDrawer";
import type {
  KanbanBoardData,
  KanbanCommandResult,
  KanbanDispatchResult,
  KanbanStatus,
  KanbanTask,
  KanbanTaskDetails,
} from "./kanbanTypes";
import {
  COLUMNS,
  EMPTY_COLUMNS,
  formatAge,
  parseSkillList,
  summarizeDispatch,
  taskMatches,
} from "./kanbanUtils";

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
  const [notice, setNotice] = useState<{
    tone: "info" | "warning";
    message: string;
  } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [completionSummary, setCompletionSummary] = useState("");
  const [blockReason, setBlockReason] = useState("");

  const [newTask, setNewTask] = useState<KanbanTaskDraft>({
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

  useEffect(() => {
    const refreshBoard = (): void => {
      void loadBoard();
    };
    const unsubscribe = window.hermesAPI?.onProfilesChanged?.(refreshBoard);
    window.addEventListener("focus", refreshBoard);
    const handleVisibility = (): void => {
      if (!document.hidden) refreshBoard();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      unsubscribe?.();
      window.removeEventListener("focus", refreshBoard);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
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

  const spawnableAssignees = useMemo(
    () =>
      (boardData?.assignees || []).filter(
        (assignee) => assignee.on_disk && assignee.spawnable !== false,
      ),
    [boardData],
  );

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
    setNewTask((current) => ({ ...current, assignee: task.assignee || "" }));
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
    setNotice(null);
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
      const createdTask = result.data;
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
      if (createdTask) await openTask(createdTask);
      if (createdTask?.assignee && createdTask.status === "ready") {
        const dispatch = (await window.hermesAPI.nudgeKanbanDispatcher(
          activeBoard,
        )) as KanbanCommandResult<KanbanDispatchResult>;
        if (dispatch.success) {
          setNotice(summarizeDispatch(dispatch.data));
          await loadBoard();
          await refreshSelected(createdTask.id);
        } else {
          setError(dispatch.error || "Dispatcher nudge failed.");
        }
      }
    }
    setAction(null);
  }

  async function assignTask(taskId: string): Promise<void> {
    setAction(`${taskId}:assign`);
    setError("");
    setNotice(null);
    const result = (await window.hermesAPI.assignKanbanTask(
      taskId,
      newTask.assignee || null,
      activeBoard,
    )) as KanbanCommandResult;
    if (!result.success) setError(result.error || "Failed to assign task.");
    if (
      result.success &&
      selected?.task.status === "ready" &&
      newTask.assignee
    ) {
      const dispatch = (await window.hermesAPI.nudgeKanbanDispatcher(
        activeBoard,
      )) as KanbanCommandResult<KanbanDispatchResult>;
      if (dispatch.success) {
        setNotice(summarizeDispatch(dispatch.data));
      } else {
        setError(dispatch.error || "Dispatcher nudge failed.");
      }
    }
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
    setError("");
    setNotice(null);
    const result = (await window.hermesAPI.nudgeKanbanDispatcher(
      activeBoard,
    )) as KanbanCommandResult<KanbanDispatchResult>;
    if (!result.success) {
      setError(result.error || "Dispatcher nudge failed.");
    } else {
      setNotice(summarizeDispatch(result.data));
    }
    await loadBoard();
    setAction(null);
  }

  return (
    <div className="kanban-container">
      {showCreate && (
        <KanbanCreateModal
          action={action}
          newTask={newTask}
          setNewTask={setNewTask}
          spawnableAssignees={spawnableAssignees}
          onClose={() => setShowCreate(false)}
          onCreate={() => void createTask()}
        />
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
            <span>{spawnableAssignees.length} profiles</span>
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

      {notice && (
        <div className={`kanban-notice kanban-notice-${notice.tone}`}>
          {notice.message}
          <button className="btn-ghost" onClick={() => setNotice(null)}>
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

      <KanbanBoardView
        loading={loading}
        boardData={boardData}
        filteredColumns={filteredColumns}
        lanesByProfile={lanesByProfile}
        selectedTaskId={selected?.task.id}
        onOpenTask={(task) => void openTask(task)}
      />

      {selected && (
        <KanbanDrawer
          action={action}
          selected={selected}
          spawnableAssignees={spawnableAssignees}
          newTask={newTask}
          commentText={commentText}
          completionSummary={completionSummary}
          blockReason={blockReason}
          setSelected={setSelected}
          setNewTask={setNewTask}
          setCommentText={setCommentText}
          setCompletionSummary={setCompletionSummary}
          setBlockReason={setBlockReason}
          onRunTaskAction={(taskId, status, options) => {
            void runTaskAction(taskId, status, options);
          }}
          onAssignTask={(taskId) => void assignTask(taskId)}
          onAddComment={() => void addComment()}
        />
      )}
    </div>
  );
}

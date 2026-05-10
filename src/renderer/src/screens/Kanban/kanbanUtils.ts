import type {
  KanbanDispatchResult,
  KanbanStatus,
  KanbanTask,
} from "./kanbanTypes";

export const COLUMNS: Array<{
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

export const EMPTY_COLUMNS = COLUMNS.reduce(
  (acc, col) => ({ ...acc, [col.id]: [] }),
  {} as Record<KanbanStatus, KanbanTask[]>,
);

export function formatAge(seconds: number | null | undefined): string {
  if (seconds == null) return "--";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export function formatTime(ts: number | null | undefined): string {
  if (!ts) return "--";
  return new Date(ts * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function parseSkillList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function taskMatches(
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

export function badgeLabel(task: KanbanTask): string {
  if (task.tenant) return task.tenant;
  if (task.assignee) return task.assignee;
  return task.workspace_kind;
}

export function summarizeDispatch(result: KanbanDispatchResult | undefined): {
  tone: "info" | "warning";
  message: string;
} | null {
  if (!result) return null;
  const spawned = result.spawned?.length || 0;
  const skippedNonspawnable = result.skipped_nonspawnable?.length || 0;
  const skippedUnassigned = result.skipped_unassigned?.length || 0;
  if (spawned > 0) {
    return {
      tone: "info",
      message: `Dispatcher started ${spawned} task${spawned === 1 ? "" : "s"}.`,
    };
  }
  if (skippedNonspawnable > 0 || skippedUnassigned > 0) {
    return {
      tone: "warning",
      message: `No worker started: ${skippedNonspawnable} invalid profile, ${skippedUnassigned} unassigned.`,
    };
  }
  return { tone: "info", message: "Dispatcher checked the board." };
}

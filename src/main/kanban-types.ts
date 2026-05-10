export type KanbanStatus =
  | "triage"
  | "todo"
  | "ready"
  | "running"
  | "blocked"
  | "done"
  | "archived";

export interface KanbanTask {
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

export interface KanbanBoard {
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  db_path?: string;
  is_current?: boolean;
  counts?: Record<string, number>;
  total?: number;
}

export interface KanbanAssignee {
  name: string;
  on_disk: boolean;
  counts: Record<string, number>;
  spawnable?: boolean;
}

export interface KanbanBoardData {
  tasks: KanbanTask[];
  columns: Record<KanbanStatus, KanbanTask[]>;
  boards: KanbanBoard[];
  assignees: KanbanAssignee[];
  stats: {
    by_status: Record<string, number>;
    by_assignee: Record<string, Record<string, number>>;
    oldest_ready_age_seconds: number | null;
    now: number;
  };
  docs: KanbanDocs;
}

export interface KanbanTaskDetails {
  task: KanbanTask;
  parents: string[];
  children: string[];
  comments: Array<{
    author: string;
    body: string;
    created_at: number;
  }>;
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
    worker_pid?: number | null;
    started_at: number;
    ended_at: number | null;
  }>;
}

export interface KanbanDocs {
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

export interface KanbanCommandResult<T = unknown> {
  success: boolean;
  data?: T;
  output?: string;
  error?: string;
}

export interface CreateKanbanTaskInput {
  title: string;
  body?: string;
  assignee?: string;
  tenant?: string;
  priority?: number;
  workspace?: string;
  triage?: boolean;
  parents?: string[];
  skills?: string[];
  maxRuntime?: string;
  board?: string;
}

export const STATUS_ORDER: KanbanStatus[] = [
  "triage",
  "todo",
  "ready",
  "running",
  "blocked",
  "done",
  "archived",
];

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

export interface KanbanBoardData {
  tasks: KanbanTask[];
  columns: Record<KanbanStatus, KanbanTask[]>;
  boards: Array<{ slug: string; name: string; is_current?: boolean }>;
  assignees: Array<{
    name: string;
    on_disk: boolean;
    spawnable?: boolean;
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

export interface KanbanTaskDetails {
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

export interface KanbanDispatchResult {
  spawned?: Array<{ task_id: string; assignee: string; workspace?: string }>;
  skipped_unassigned?: string[];
  skipped_nonspawnable?: string[];
}

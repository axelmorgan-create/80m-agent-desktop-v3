import type {
  KanbanStatus,
  KanbanTask,
  KanbanDocs,
  KanbanBoardData,
  KanbanTaskDetails,
  KanbanCommandResult,
  CreateKanbanTaskInput,
  CronCreateOptions,
} from "./hermes-api-common.types";

export interface HermesAutomationAPI {
  // Cron Jobs
  listCronJobs: (
    includeDisabled?: boolean,
    profile?: string,
  ) => Promise<
    Array<{
      id: string;
      name: string;
      schedule: string;
      prompt: string;
      state: "active" | "paused" | "completed";
      enabled: boolean;
      next_run_at: string | null;
      last_run_at: string | null;
      last_status: string | null;
      last_error: string | null;
      repeat: { times: number | null; completed: number } | null;
      deliver: string[];
      skills: string[];
      script: string | null;
      origin: string | null;
      model: string | null;
      provider: string | null;
      session_id: string | null;
      session_title: string | null;
    }>
  >;
  createCronJob: (
    schedule: string,
    prompt?: string,
    name?: string,
    deliver?: string,
    profile?: string,
    options?: CronCreateOptions,
  ) => Promise<{ success: boolean; error?: string }>;
  removeCronJob: (
    jobId: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  pauseCronJob: (
    jobId: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  resumeCronJob: (
    jobId: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  triggerCronJob: (
    jobId: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;

  // Kanban
  listKanbanBoard: (options?: {
    board?: string;
    tenant?: string;
    includeArchived?: boolean;
  }) => Promise<KanbanCommandResult<KanbanBoardData>>;
  getKanbanTask: (
    taskId: string,
    board?: string,
  ) => Promise<KanbanCommandResult<KanbanTaskDetails>>;
  createKanbanTask: (
    input: CreateKanbanTaskInput,
  ) => Promise<KanbanCommandResult<KanbanTask>>;
  updateKanbanTaskStatus: (
    taskId: string,
    status: KanbanStatus,
    options?: {
      board?: string;
      reason?: string;
      summary?: string;
      metadata?: Record<string, unknown>;
    },
  ) => Promise<KanbanCommandResult>;
  assignKanbanTask: (
    taskId: string,
    assignee: string | null,
    board?: string,
  ) => Promise<KanbanCommandResult>;
  commentKanbanTask: (
    taskId: string,
    body: string,
    board?: string,
  ) => Promise<KanbanCommandResult>;
  nudgeKanbanDispatcher: (
    board?: string,
  ) => Promise<KanbanCommandResult<unknown>>;
  getKanbanDocs: () => Promise<KanbanDocs>;
}

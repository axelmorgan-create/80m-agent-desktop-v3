import { ipcRenderer } from "electron";
import type { HermesAPI } from "./hermes-api.types";

export const hermesAutomationApi = {
  // Cron Jobs
  listCronJobs: (
    includeDisabled?: boolean,
    profile?: string,
  ): Promise<
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
    }>
  > => ipcRenderer.invoke("list-cron-jobs", includeDisabled, profile),

  createCronJob: (
    schedule: string,
    prompt?: string,
    name?: string,
    deliver?: string,
    profile?: string,
    options?: {
      repeat?: number | string;
      skills?: string[];
      script?: string;
      noAgent?: boolean;
      workdir?: string;
    },
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(
      "create-cron-job",
      schedule,
      prompt,
      name,
      deliver,
      profile,
      options,
    ),

  removeCronJob: (
    jobId: string,
    profile?: string,
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("remove-cron-job", jobId, profile),

  pauseCronJob: (
    jobId: string,
    profile?: string,
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("pause-cron-job", jobId, profile),

  resumeCronJob: (
    jobId: string,
    profile?: string,
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("resume-cron-job", jobId, profile),

  triggerCronJob: (
    jobId: string,
    profile?: string,
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("trigger-cron-job", jobId, profile),

  // Kanban
  listKanbanBoard: (options?: {
    board?: string;
    tenant?: string;
    includeArchived?: boolean;
  }): Promise<unknown> => ipcRenderer.invoke("list-kanban-board", options),

  getKanbanTask: (taskId: string, board?: string): Promise<unknown> =>
    ipcRenderer.invoke("get-kanban-task", taskId, board),

  createKanbanTask: (input: unknown): Promise<unknown> =>
    ipcRenderer.invoke("create-kanban-task", input),

  updateKanbanTaskStatus: (
    taskId: string,
    status: string,
    options?: {
      board?: string;
      reason?: string;
      summary?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<unknown> =>
    ipcRenderer.invoke("update-kanban-task-status", taskId, status, options),

  assignKanbanTask: (
    taskId: string,
    assignee: string | null,
    board?: string,
  ): Promise<unknown> =>
    ipcRenderer.invoke("assign-kanban-task", taskId, assignee, board),

  commentKanbanTask: (
    taskId: string,
    body: string,
    board?: string,
  ): Promise<unknown> =>
    ipcRenderer.invoke("comment-kanban-task", taskId, body, board),

  nudgeKanbanDispatcher: (board?: string): Promise<unknown> =>
    ipcRenderer.invoke("nudge-kanban-dispatcher", board),

  getKanbanDocs: (): Promise<unknown> => ipcRenderer.invoke("get-kanban-docs"),
} as Partial<HermesAPI>;

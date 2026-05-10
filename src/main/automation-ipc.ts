import { ipcMain } from "electron";
import {
  getClaw3dLogs,
  getClaw3dPort,
  getClaw3dStatus,
  getClaw3dWsUrl,
  setClaw3dPort,
  setClaw3dWsUrl,
  setupClaw3d,
  startAdapter,
  startAll as startClaw3dAll,
  startDevServer,
  stopAdapter,
  stopAll as stopClaw3d,
  stopDevServer,
  type Claw3dSetupProgress,
} from "./claw3d";
import {
  createCronJob,
  listCronJobs,
  pauseCronJob,
  removeCronJob,
  resumeCronJob,
  triggerCronJob,
  type CronCreateOptions,
} from "./cronjobs";
import {
  assignKanbanTask,
  commentKanbanTask,
  createKanbanTask,
  getKanbanDocs,
  getKanbanTask,
  listKanbanBoard,
  nudgeKanbanDispatcher,
  updateKanbanTaskStatus,
  type CreateKanbanTaskInput,
  type KanbanStatus,
} from "./kanban";

export function registerAutomationIpc(): void {
  ipcMain.handle("claw3d-status", () => getClaw3dStatus());
  ipcMain.handle("claw3d-setup", async (event) => {
    try {
      await setupClaw3d((progress: Claw3dSetupProgress) => {
        event.sender.send("claw3d-setup-progress", progress);
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle("claw3d-get-port", () => getClaw3dPort());
  ipcMain.handle("claw3d-set-port", (_event, port: number) => {
    setClaw3dPort(port);
    return true;
  });
  ipcMain.handle("claw3d-get-ws-url", () => getClaw3dWsUrl());
  ipcMain.handle("claw3d-set-ws-url", (_event, url: string) => {
    setClaw3dWsUrl(url);
    return true;
  });

  ipcMain.handle("claw3d-start-all", () => startClaw3dAll());
  ipcMain.handle("claw3d-stop-all", () => {
    stopClaw3d();
    return true;
  });
  ipcMain.handle("claw3d-get-logs", () => getClaw3dLogs());
  ipcMain.handle("claw3d-start-dev", () => startDevServer());
  ipcMain.handle("claw3d-stop-dev", () => {
    stopDevServer();
    return true;
  });
  ipcMain.handle("claw3d-start-adapter", () => startAdapter());
  ipcMain.handle("claw3d-stop-adapter", () => {
    stopAdapter();
    return true;
  });

  ipcMain.handle(
    "list-cron-jobs",
    (_event, includeDisabled?: boolean, profile?: string) =>
      listCronJobs(includeDisabled, profile),
  );
  ipcMain.handle(
    "create-cron-job",
    (
      _event,
      schedule: string,
      prompt?: string,
      name?: string,
      deliver?: string,
      profile?: string,
      options?: CronCreateOptions,
    ) => createCronJob(schedule, prompt, name, deliver, profile, options),
  );
  ipcMain.handle("remove-cron-job", (_event, jobId: string, profile?: string) =>
    removeCronJob(jobId, profile),
  );
  ipcMain.handle("pause-cron-job", (_event, jobId: string, profile?: string) =>
    pauseCronJob(jobId, profile),
  );
  ipcMain.handle("resume-cron-job", (_event, jobId: string, profile?: string) =>
    resumeCronJob(jobId, profile),
  );
  ipcMain.handle(
    "trigger-cron-job",
    (_event, jobId: string, profile?: string) => triggerCronJob(jobId, profile),
  );

  ipcMain.handle(
    "list-kanban-board",
    (
      _event,
      options?: { board?: string; tenant?: string; includeArchived?: boolean },
    ) => listKanbanBoard(options),
  );
  ipcMain.handle("get-kanban-task", (_event, taskId: string, board?: string) =>
    getKanbanTask(taskId, board),
  );
  ipcMain.handle("create-kanban-task", (_event, input: CreateKanbanTaskInput) =>
    createKanbanTask(input),
  );
  ipcMain.handle(
    "update-kanban-task-status",
    (
      _event,
      taskId: string,
      status: KanbanStatus,
      options?: {
        board?: string;
        reason?: string;
        summary?: string;
        metadata?: Record<string, unknown>;
      },
    ) => updateKanbanTaskStatus(taskId, status, options),
  );
  ipcMain.handle(
    "assign-kanban-task",
    (_event, taskId: string, assignee: string | null, board?: string) =>
      assignKanbanTask(taskId, assignee, board),
  );
  ipcMain.handle(
    "comment-kanban-task",
    (_event, taskId: string, body: string, board?: string) =>
      commentKanbanTask(taskId, body, board),
  );
  ipcMain.handle("nudge-kanban-dispatcher", (_event, board?: string) =>
    nudgeKanbanDispatcher(board),
  );
  ipcMain.handle("get-kanban-docs", () => getKanbanDocs());
}

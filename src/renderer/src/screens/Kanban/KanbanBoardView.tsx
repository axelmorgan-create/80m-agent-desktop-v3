import TaskCard from "./TaskCard";
import type { KanbanBoardData, KanbanStatus, KanbanTask } from "./kanbanTypes";
import { COLUMNS } from "./kanbanUtils";

interface KanbanBoardViewProps {
  loading: boolean;
  boardData: KanbanBoardData | null;
  filteredColumns: Record<KanbanStatus, KanbanTask[]>;
  lanesByProfile: boolean;
  selectedTaskId?: string;
  onOpenTask: (task: KanbanTask) => void;
}

export function KanbanBoardView({
  loading,
  boardData,
  filteredColumns,
  lanesByProfile,
  selectedTaskId,
  onOpenTask,
}: KanbanBoardViewProps): React.JSX.Element {
  return (
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
                              active={selectedTaskId === task.id}
                              onClick={() => onOpenTask(task)}
                            />
                          ))}
                        </div>
                      ))
                    : tasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          active={selectedTaskId === task.id}
                          onClick={() => onOpenTask(task)}
                        />
                      ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}

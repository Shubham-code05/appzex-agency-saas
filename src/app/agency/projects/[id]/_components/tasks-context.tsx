"use client";

import { createContext, useCallback, useContext, useMemo, useOptimistic, useState, useTransition } from "react";
import type { TaskStatus } from "@prisma/client";
import { updateTaskStatus } from "@/actions/agency-actions";
import { deriveProgress } from "@/lib/progress";
import { ProgressMeter } from "@/components/agency/badges";

export interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: string;
  dueDate: string | null;
  createdAt: string;
  assignee: { id: string; name: string } | null;
}

interface TasksContextValue {
  tasks: TaskItem[];
  /** Server "now", so due-state badges render identically on server and client. */
  nowIso: string;
  pendingIds: ReadonlySet<string>;
  error: string | null;
  dismissError: () => void;
  changeStatus: (taskId: string, status: TaskStatus) => void;
}

const TasksContext = createContext<TasksContextValue | null>(null);

export function useTasks(): TasksContextValue {
  const value = useContext(TasksContext);
  if (!value) throw new Error("useTasks must be used inside <TasksProvider>");
  return value;
}

/**
 * Holds the project's tasks with optimistic status updates. Toggling a task
 * updates the board AND the header progress instantly; the server action then
 * persists it, revalidates, and the fresh server props replace the optimistic
 * state. If the action fails, React discards the optimistic change (rollback).
 */
export function TasksProvider({
  tasks,
  nowIso,
  children,
}: {
  tasks: TaskItem[];
  nowIso: string;
  children: React.ReactNode;
}) {
  const [optimisticTasks, applyStatus] = useOptimistic(
    tasks,
    (state: TaskItem[], update: { id: string; status: TaskStatus }) =>
      state.map((task) => (task.id === update.id ? { ...task, status: update.status } : task)),
  );
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const changeStatus = useCallback(
    (taskId: string, status: TaskStatus) => {
      setError(null);
      setPendingIds((prev) => new Set(prev).add(taskId));
      startTransition(async () => {
        applyStatus({ id: taskId, status });
        try {
          const result = await updateTaskStatus(taskId, status);
          if (!result.ok) setError(result.error);
        } catch {
          setError("Could not update the task. Please try again.");
        } finally {
          setPendingIds((prev) => {
            const next = new Set(prev);
            next.delete(taskId);
            return next;
          });
        }
      });
    },
    [applyStatus],
  );

  const value = useMemo<TasksContextValue>(
    () => ({
      tasks: optimisticTasks,
      nowIso,
      pendingIds,
      error,
      dismissError: () => setError(null),
      changeStatus,
    }),
    [optimisticTasks, nowIso, pendingIds, error, changeStatus],
  );

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

/** Header progress, derived live from (optimistic) task statuses. */
export function ProjectProgress() {
  const { tasks } = useTasks();
  const done = tasks.filter((task) => task.status === "DONE").length;
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <p className="mb-2 text-xs font-medium tracking-wider text-slate-500 uppercase">Progress</p>
      <p className="mb-3 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">{deriveProgress(tasks)}%</p>
      <ProgressMeter value={deriveProgress(tasks)} done={done} total={tasks.length} size="sm" />
    </div>
  );
}

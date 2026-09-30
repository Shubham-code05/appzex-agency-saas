"use client";

import { useMemo, useState } from "react";
import type { TaskStatus } from "@prisma/client";
import { AlarmClock, CalendarClock, CheckCircle2, ChevronDown, Circle, CircleDashed, Layers, X } from "lucide-react";
import { TASK_STATUSES, TASK_STATUS_LABEL } from "@/lib/agency-enums";
import { formatShortDate, getDueState, type DueState } from "@/lib/dates";
import { Avatar, DueBadge, PriorityBadge } from "@/components/agency/badges";
import { useTasks, type TaskItem } from "./tasks-context";

type Filter = "all" | "overdue" | "due_this_week";

const COLUMN_STYLE: Record<TaskStatus, { dot: string; Icon: typeof Circle }> = {
  TODO: { dot: "text-slate-400", Icon: Circle },
  IN_PROGRESS: { dot: "text-sky-500", Icon: CircleDashed },
  DONE: { dot: "text-emerald-500", Icon: CheckCircle2 },
};

const DUE_RANK: Record<string, number> = { overdue: 0, due_this_week: 1, none: 2 };

function sortTasks(tasks: TaskItem[], dueStates: Map<string, DueState>): TaskItem[] {
  return [...tasks].sort((a, b) => {
    const rank = DUE_RANK[dueStates.get(a.id) ?? "none"] - DUE_RANK[dueStates.get(b.id) ?? "none"];
    if (rank !== 0) return rank;
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    return a.createdAt < b.createdAt ? -1 : 1;
  });
}

export function TaskBoard() {
  const { tasks, nowIso, error, dismissError } = useTasks();
  const [filter, setFilter] = useState<Filter>("all");

  const dueStates = useMemo(
    () => new Map(tasks.map((task) => [task.id, getDueState(task.dueDate, task.status, nowIso)])),
    [tasks, nowIso],
  );
  const overdueCount = tasks.filter((task) => dueStates.get(task.id) === "overdue").length;
  const dueSoonCount = tasks.filter((task) => dueStates.get(task.id) === "due_this_week").length;

  const visible = filter === "all" ? tasks : tasks.filter((task) => dueStates.get(task.id) === filter);
  const sorted = sortTasks(visible, dueStates);

  return (
    <section aria-label="Tasks" className="space-y-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter tasks">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} Icon={Layers} count={tasks.length}>
          All
        </FilterChip>
        <FilterChip
          active={filter === "overdue"}
          onClick={() => setFilter("overdue")}
          Icon={AlarmClock}
          count={overdueCount}
          tone="rose"
        >
          Overdue
        </FilterChip>
        <FilterChip
          active={filter === "due_this_week"}
          onClick={() => setFilter("due_this_week")}
          Icon={CalendarClock}
          count={dueSoonCount}
          tone="amber"
        >
          Due this week
        </FilterChip>
      </div>

      {error && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
          <button type="button" onClick={dismissError} className="shrink-0 rounded p-0.5 hover:bg-rose-100">
            <X className="h-4 w-4" aria-hidden />
            <span className="sr-only">Dismiss</span>
          </button>
        </div>
      )}

      {tasks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          No tasks yet. Add the first one above — progress is calculated from completed tasks.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {TASK_STATUSES.map((status) => {
            const columnTasks = sorted.filter((task) => task.status === status);
            const { dot, Icon } = COLUMN_STYLE[status];
            return (
              <div key={status} className="flex flex-col rounded-xl bg-slate-100/70 p-3">
                <h3 className="mb-3 flex items-center gap-2 px-1 text-sm font-semibold text-slate-700">
                  <Icon className={`h-4 w-4 ${dot}`} aria-hidden />
                  {TASK_STATUS_LABEL[status]}
                  <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500 tabular-nums">
                    {columnTasks.length}
                  </span>
                </h3>
                {columnTasks.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-400">
                    {filter === "all" ? "No tasks" : "No matching tasks"}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {columnTasks.map((task) => (
                      <TaskCard key={task.id} task={task} dueState={dueStates.get(task.id) ?? null} />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function TaskCard({ task, dueState }: { task: TaskItem; dueState: DueState }) {
  const { changeStatus, pendingIds } = useTasks();
  const pending = pendingIds.has(task.id);
  const done = task.status === "DONE";

  return (
    <li
      className={`rounded-lg border bg-white p-3 shadow-xs transition ${
        dueState === "overdue" ? "border-rose-200" : "border-slate-200"
      } ${pending ? "opacity-70" : ""}`}
    >
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={() => changeStatus(task.id, done ? "TODO" : "DONE")}
          aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
          aria-pressed={done}
          className="mt-0.5 shrink-0 rounded-full text-slate-300 transition hover:text-emerald-500 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
        >
          {done ? <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden /> : <Circle className="h-5 w-5" aria-hidden />}
        </button>

        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium break-words ${done ? "text-slate-400 line-through" : "text-slate-900"}`}>
            {task.title}
          </p>
          {task.description && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{task.description}</p>}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <PriorityBadge priority={task.priority} />
            <DueBadge state={dueState} />
            {task.dueDate && (
              <span className={`text-xs ${dueState === "overdue" ? "font-medium text-rose-600" : "text-slate-500"}`}>
                {formatShortDate(task.dueDate)}
              </span>
            )}
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-2">
            {task.assignee ? (
              <span className="flex min-w-0 items-center gap-1.5 text-xs text-slate-600">
                <Avatar name={task.assignee.name} />
                <span className="truncate">{task.assignee.name}</span>
              </span>
            ) : (
              <span className="text-xs text-slate-400">Unassigned</span>
            )}

            <label className="relative shrink-0">
              <span className="sr-only">Status for {task.title}</span>
              <select
                value={task.status}
                disabled={pending}
                onChange={(e) => changeStatus(task.id, e.target.value as TaskStatus)}
                className="appearance-none rounded-md border border-slate-200 bg-slate-50 py-1 pr-6 pl-2 text-xs font-medium text-slate-600 transition hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              >
                {TASK_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {TASK_STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-1.5 h-3 w-3 -translate-y-1/2 text-slate-400" aria-hidden />
            </label>
          </div>
        </div>
      </div>
    </li>
  );
}

function FilterChip({
  active,
  onClick,
  Icon,
  count,
  tone = "indigo",
  children,
}: {
  active: boolean;
  onClick: () => void;
  Icon: typeof Layers;
  count: number;
  tone?: "indigo" | "rose" | "amber";
  children: React.ReactNode;
}) {
  const activeTone = {
    indigo: "border-indigo-300 bg-indigo-50 text-indigo-700",
    rose: "border-rose-300 bg-rose-50 text-rose-700",
    amber: "border-amber-300 bg-amber-50 text-amber-800",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition ${
        active ? activeTone : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {children}
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  );
}

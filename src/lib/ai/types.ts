/** Shapes shared by the AI route handlers, pure heuristics and client UI. Dependency-free. */

export type AiMode =
  /** A real LLM produced the result. */
  | "ai"
  /** No API key configured: deterministic rule-based engine. */
  | "demo"
  /** An API key is configured but the provider failed: rule-based result instead. */
  | "fallback";

export type TaskPriorityValue = "LOW" | "MEDIUM" | "HIGH";

export interface AiTaskDraft {
  title: string;
  description: string | null;
  priority: TaskPriorityValue;
  /** Days from today (UTC); null when the notes give no timing. */
  suggestedDueDateDays: number | null;
}

export interface ExtractTasksResponse {
  mode: AiMode;
  model: string | null;
  notice: string | null;
  tasks: AiTaskDraft[];
}

export type HealthStatus = "GREEN" | "AMBER" | "RED";

export interface HealthReport {
  status: HealthStatus;
  headline: string;
  bottlenecks: string[];
  nextSteps: string[];
}

/** Facts gathered from the database. The only project data an LLM ever sees. */
export interface HealthMetrics {
  projectName: string;
  clientName: string;
  projectStatus: string;
  today: string;
  startDate: string | null;
  endDate: string | null;
  daysToDeadline: number | null;
  totalTasks: number;
  doneTasks: number;
  inProgressTasks: number;
  todoTasks: number;
  progress: number;
  /** % of the planned timeline already elapsed (null without start+end dates). */
  expectedProgress: number | null;
  completedLast7Days: number;
  overdueTasks: { title: string; daysOverdue: number; priority: string; assignee: string | null }[];
  dueThisWeek: { title: string; daysUntilDue: number; priority: string; assignee: string | null }[];
  unassignedOpenHighPriority: number;
  workload: { name: string; openTasks: number; overdueTasks: number }[];
  milestones: { title: string; status: string; dueDate: string | null; daysUntilDue: number | null }[];
  openFeedback: { title: string; status: string; daysOpen: number; awaitingAgencyReply: boolean; daysWaiting: number }[];
}

export interface ProjectHealthResponse {
  mode: AiMode;
  model: string | null;
  notice: string | null;
  generatedAt: string;
  report: HealthReport;
  metrics: {
    progress: number;
    expectedProgress: number | null;
    totalTasks: number;
    doneTasks: number;
    overdueTasks: number;
    dueThisWeek: number;
    openFeedback: number;
    daysToDeadline: number | null;
  };
  markdown: string;
}

export interface AiErrorResponse {
  error: string;
}

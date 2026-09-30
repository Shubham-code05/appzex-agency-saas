/** UI-facing enum subsets. Dependency-free so client components can import them cheaply. */
export const PROJECT_STATUSES = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"] as const;
export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
/** The spec allows LOW | MEDIUM | HIGH; the DB enum's URGENT is not offered in the UI. */
export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

export const TASK_STATUS_LABEL: Record<(typeof TASK_STATUSES)[number], string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};

export const TASK_PRIORITY_LABEL: Record<(typeof TASK_PRIORITIES)[number], string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

/**
 * Project progress is derived, never stored: DONE tasks / total tasks, rounded
 * to the nearest whole percent. A project with no tasks is 0%.
 */
export function deriveProgress(tasks: ReadonlyArray<{ status: string }>): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter((task) => task.status === "DONE").length;
  return Math.round((done / tasks.length) * 100);
}

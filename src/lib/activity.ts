/** Canonical ActivityLog.action values. Keep in one place so audit queries stay consistent. */
export const ActivityAction = {
  USER_LOGIN: "USER_LOGIN",
  AGENCY_STATUS_CHANGED: "AGENCY_STATUS_CHANGED",
  SUPPORT_MODE_STARTED: "SUPPORT_MODE_STARTED",
  SUPPORT_MODE_ENDED: "SUPPORT_MODE_ENDED",
  CLIENT_CREATED: "CLIENT_CREATED",
  PROJECT_CREATED: "PROJECT_CREATED",
  TASK_CREATED: "TASK_CREATED",
  TASK_STATUS_CHANGED: "TASK_STATUS_CHANGED",
  /** Legacy (seed data); new code logs TASK_STATUS_CHANGED. */
  TASK_COMPLETED: "TASK_COMPLETED",
  MEETING_CREATED: "MEETING_CREATED",
  MEETING_SHARING_CHANGED: "MEETING_SHARING_CHANGED",
  FEEDBACK_SUBMITTED: "FEEDBACK_SUBMITTED",
  FEEDBACK_REPLIED: "FEEDBACK_REPLIED",
  FEEDBACK_STATUS_CHANGED: "FEEDBACK_STATUS_CHANGED",
  FILE_UPLOADED: "FILE_UPLOADED",
  FILE_SHARING_CHANGED: "FILE_SHARING_CHANGED",
} as const;

export type ActivityActionName = (typeof ActivityAction)[keyof typeof ActivityAction];

/** Actions surfaced in the Super Admin audit feed. */
export const PLATFORM_AUDIT_ACTIONS: ActivityActionName[] = [
  ActivityAction.AGENCY_STATUS_CHANGED,
  ActivityAction.SUPPORT_MODE_STARTED,
  ActivityAction.SUPPORT_MODE_ENDED,
];

/** Actions surfaced in an agency's own workspace feed (work items only). */
export const AGENCY_FEED_ACTIONS: ActivityActionName[] = [
  ActivityAction.CLIENT_CREATED,
  ActivityAction.PROJECT_CREATED,
  ActivityAction.TASK_CREATED,
  ActivityAction.TASK_STATUS_CHANGED,
  ActivityAction.TASK_COMPLETED,
  ActivityAction.MEETING_CREATED,
  ActivityAction.MEETING_SHARING_CHANGED,
  ActivityAction.FEEDBACK_SUBMITTED,
  ActivityAction.FEEDBACK_REPLIED,
  ActivityAction.FEEDBACK_STATUS_CHANGED,
  ActivityAction.FILE_UPLOADED,
  ActivityAction.FILE_SHARING_CHANGED,
];

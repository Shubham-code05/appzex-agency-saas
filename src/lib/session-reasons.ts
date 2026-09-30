/**
 * Reasons a server-side session check can end a session. Pages redirect to
 * /login?reason=<code>; middleware clears the cookie for any of these codes so
 * the user sees the login form instead of a /login ⇄ dashboard redirect loop.
 * Edge-safe: no Node imports.
 */
export const SESSION_END_REASONS = {
  session_ended: "Your session has ended. Please sign in again.",
  agency_suspended: "Your agency account is suspended. Contact support for help.",
  agency_inactive: "Your agency account is inactive. Contact support for help.",
} as const;

export type SessionEndReason = keyof typeof SESSION_END_REASONS;

export function isSessionEndReason(value: unknown): value is SessionEndReason {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(SESSION_END_REASONS, value);
}

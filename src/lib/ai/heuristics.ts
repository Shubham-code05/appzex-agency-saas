/**
 * Deterministic, dependency-free engines used when no LLM is configured
 * ("demo" mode) or the provider fails ("fallback" mode). They are also the
 * safety floor for the AI health check: the LLM may escalate a status, never
 * downgrade it below what these rules compute.
 */
import type { AiTaskDraft, HealthMetrics, HealthReport, HealthStatus, TaskPriorityValue } from "./types";

// ─── Meeting notes → task drafts ────────────────────────────────────────────

const MAX_DRAFTS = 15;
const BULLET = /^\s*(?:[-*•–]|\d{1,2}[.)]|\[\s?[xX ]?\s?\])\s+/;
const EXPLICIT = /^\s*(?:action(?:\s+item)?s?|todo|to-do|next\s+steps?|follow[ -]?ups?|ai)\s*[:\-–]\s*/i;
const ACTION_HINT =
  /\b(will|to|needs?\s+to|must|should|action|todo|follow[ -]?up|send|prepare|create|update|fix|review|set\s?up|schedule|share|confirm|draft|design|build|migrate|deploy|write|add|remove|check|finali[sz]e|book|test|publish|order|investigate)\b/i;
const NOISE = /^\s*(?:#|attendees?|agenda|date|time|location|present|notes?|minutes|summary)\b/i;
const OWNER_PREFIX = /^@?([A-Z][\w'-]{1,30}(?:\s[A-Z][\w'-]{1,30})?)\s*[:\-–]\s+/;
const OWNER_WILL = /^@?([A-Z][\w'-]{1,30})\s+(?:will|to|needs?\s+to|should|must)\s+/;

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function daysUntilWeekday(now: Date, weekday: number): number {
  const diff = (weekday - now.getUTCDay() + 7) % 7;
  return diff === 0 ? 7 : diff;
}

export function inferDueDays(text: string, now: Date = new Date()): number | null {
  const t = text.toLowerCase();
  if (/\b(today|eod|end of (?:the )?day|asap|immediately)\b/.test(t)) return 0;
  if (/\btomorrow\b/.test(t)) return 1;
  const inDays = /\bin\s+(\d{1,3})\s+days?\b/.exec(t) ?? /\bwithin\s+(\d{1,3})\s+days?\b/.exec(t);
  if (inDays) return Math.min(365, Number(inDays[1]));
  const inWeeks = /\bin\s+(\d{1,2})\s+weeks?\b/.exec(t);
  if (inWeeks) return Math.min(365, Number(inWeeks[1]) * 7);
  if (/\b(this week|end of (?:the )?week|eow)\b/.test(t)) return daysUntilWeekday(now, 5);
  if (/\bnext week\b/.test(t)) return 7;
  if (/\b(end of (?:the )?month|eom)\b/.test(t)) {
    const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
    return Math.max(0, lastDay - now.getUTCDate());
  }
  if (/\bnext month\b/.test(t)) return 30;
  const weekday = WEEKDAYS.findIndex((day) => new RegExp(`\\b${day}\\b`).test(t));
  if (weekday !== -1) return daysUntilWeekday(now, weekday);
  return null;
}

export function inferPriority(text: string): TaskPriorityValue {
  if (/\b(urgent|asap|immediately|blocker|blocking|blocked|critical|high[ -]priority|today|tomorrow|eod)\b|!/i.test(text)) return "HIGH";
  if (/\b(nice[ -]to[ -]have|low[ -]priority|someday|eventually|later|if time|optional)\b/i.test(text)) return "LOW";
  return "MEDIUM";
}

function toTitle(text: string): string {
  let title = text.replace(/\s+/g, " ").replace(/[.;:,\s]+$/, "").trim();
  title = title.charAt(0).toUpperCase() + title.slice(1);
  if (title.length > 120) title = `${title.slice(0, 117).replace(/\s+\S*$/, "")}…`;
  return title;
}

/** Rule-based action-item extraction from free-form meeting notes. */
export function extractTasksHeuristically(notes: string, now: Date = new Date()): AiTaskDraft[] {
  const drafts: AiTaskDraft[] = [];
  const seen = new Set<string>();

  for (const rawLine of notes.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length < 8 || line.endsWith(":") || NOISE.test(line)) continue;

    const isBullet = BULLET.test(line);
    const isExplicit = EXPLICIT.test(line);
    const hasHint = ACTION_HINT.test(line);
    const strongPhrase = /\b(will|needs?\s+to|must|action|todo|follow[ -]?up)\b/i.test(line);
    if (!((isBullet || isExplicit) && hasHint) && !strongPhrase) continue;

    let text = line.replace(BULLET, "").replace(EXPLICIT, "").trim();
    let owner: string | null = null;
    const prefixed = OWNER_PREFIX.exec(text);
    if (prefixed) {
      owner = prefixed[1];
      text = text.slice(prefixed[0].length);
    } else {
      const willMatch = OWNER_WILL.exec(text);
      if (willMatch) {
        owner = willMatch[1];
        text = text.slice(willMatch[0].length);
      }
    }
    if (text.length < 4) continue;

    const title = toTitle(text);
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const source = line.length > 240 ? `${line.slice(0, 237)}…` : line;
    drafts.push({
      title,
      description: `${owner ? `Owner mentioned: ${owner}. ` : ""}From meeting notes: “${source}”`,
      priority: inferPriority(line),
      suggestedDueDateDays: inferDueDays(line, now),
    });
    if (drafts.length >= MAX_DRAFTS) break;
  }
  return drafts;
}

// ─── Project health ─────────────────────────────────────────────────────────

const SEVERITY: Record<HealthStatus, number> = { GREEN: 0, AMBER: 1, RED: 2 };

export function worstStatus(a: HealthStatus, b: HealthStatus): HealthStatus {
  return SEVERITY[a] >= SEVERITY[b] ? a : b;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** Rule-based RAG assessment. Every statement is derived from `metrics`. */
export function assessHealthHeuristically(m: HealthMetrics): HealthReport {
  const red: string[] = [];
  const amber: string[] = [];
  const bottlenecks: string[] = [];
  const nextSteps: string[] = [];

  const openTasks = m.totalTasks - m.doneTasks;
  const overdue = m.overdueTasks.length;
  const scheduleGap = m.expectedProgress !== null ? m.expectedProgress - m.progress : null;
  const overdueMilestones = m.milestones.filter((ms) => ms.daysUntilDue !== null && ms.daysUntilDue < 0);
  const waitingFeedback = m.openFeedback.filter((f) => f.awaitingAgencyReply);

  if (m.totalTasks === 0) {
    amber.push("no tasks planned");
    bottlenecks.push("The project has no tasks yet, so progress cannot be measured.");
    nextSteps.push("Break the scope into tasks with owners and due dates so progress becomes visible.");
  }

  if (m.daysToDeadline !== null && m.daysToDeadline < 0 && m.progress < 100) {
    red.push("past its deadline");
    bottlenecks.push(`The target date passed ${plural(-m.daysToDeadline, "day")} ago with the project at ${m.progress}%.`);
    nextSteps.push("Agree a revised delivery date with the client and re-plan the remaining work.");
  }

  if (overdueMilestones.length > 0) {
    red.push(plural(overdueMilestones.length, "overdue milestone"));
    const ms = overdueMilestones[0];
    bottlenecks.push(`Milestone “${ms.title}” is ${plural(-(ms.daysUntilDue ?? 0), "day")} overdue.`);
    nextSteps.push(`Decide whether “${ms.title}” can still land this week or needs a new date communicated to the client.`);
  }

  if (overdue > 0) {
    const ratio = openTasks > 0 ? overdue / openTasks : 0;
    if (overdue >= 2 && ratio >= 0.3) red.push(`${Math.round(ratio * 100)}% of open tasks overdue`);
    else amber.push(plural(overdue, "overdue task"));

    const worst = [...m.overdueTasks].sort((a, b) => b.daysOverdue - a.daysOverdue)[0];
    bottlenecks.push(
      `${plural(overdue, "task")} overdue — the oldest, “${worst.title}”, is ${plural(worst.daysOverdue, "day")} late${
        worst.assignee ? ` (${worst.assignee})` : " and unassigned"
      }.`,
    );
    nextSteps.push(`Unblock “${worst.title}” first: confirm the owner, remove blockers and set a realistic new date.`);
  }

  const overloaded = m.workload.filter((w) => w.overdueTasks >= 2 || (openTasks >= 4 && w.openTasks / openTasks >= 0.6));
  for (const person of overloaded.slice(0, 2)) {
    amber.push("workload concentration");
    bottlenecks.push(`${person.name} holds ${plural(person.openTasks, "open task")} (${person.overdueTasks} overdue) — a single point of failure.`);
    nextSteps.push(`Rebalance work away from ${person.name} or pair someone on their overdue items.`);
  }

  if (scheduleGap !== null && scheduleGap >= 15) {
    (scheduleGap >= 30 ? red : amber).push("behind schedule");
    bottlenecks.push(`Progress is ${m.progress}% while ~${m.expectedProgress}% of the timeline has elapsed (${scheduleGap} points behind).`);
    nextSteps.push("Review scope with the client: cut or defer lower-priority items to protect the deadline.");
  }

  if (waitingFeedback.length > 0) {
    const longest = [...waitingFeedback].sort((a, b) => b.daysWaiting - a.daysWaiting)[0];
    if (longest.daysWaiting >= 2) amber.push("client waiting on replies");
    bottlenecks.push(
      `${plural(waitingFeedback.length, "client request")} awaiting an agency reply — “${longest.title}” for ${plural(longest.daysWaiting, "day")}.`,
    );
    nextSteps.push(`Reply to “${longest.title}” today; unanswered client requests erode trust fast.`);
  }

  if (m.unassignedOpenHighPriority > 0) {
    amber.push("unassigned high-priority work");
    bottlenecks.push(`${plural(m.unassignedOpenHighPriority, "high-priority task")} has no owner.`);
    nextSteps.push("Assign an owner to every high-priority task.");
  }

  if (m.dueThisWeek.length > 0) {
    nextSteps.push(`Check in on the ${plural(m.dueThisWeek.length, "task")} due this week, starting with “${m.dueThisWeek[0].title}”.`);
  }

  const status: HealthStatus = red.length > 0 ? "RED" : amber.length > 0 ? "AMBER" : "GREEN";
  const reasons = [...new Set([...red, ...amber])];
  const headline =
    status === "GREEN"
      ? `On track: ${m.progress}% complete with no overdue work${m.daysToDeadline !== null ? ` and ${plural(m.daysToDeadline, "day")} to the target date` : ""}.`
      : `${status === "RED" ? "Off track" : "At risk"}: ${reasons.slice(0, 3).join(", ")}.`;

  if (status === "GREEN") {
    if (bottlenecks.length === 0) bottlenecks.push("No bottlenecks detected: nothing is overdue and client requests are answered.");
    if (nextSteps.length === 0) nextSteps.push("Keep the cadence: share a short progress update with the client this week.");
    nextSteps.push("Look ahead at the next milestone and confirm its dependencies are on track.");
  }

  return { status, headline, bottlenecks: bottlenecks.slice(0, 6), nextSteps: [...new Set(nextSteps)].slice(0, 6) };
}

const STATUS_LABEL: Record<HealthStatus, string> = { GREEN: "🟢 Green", AMBER: "🟠 Amber", RED: "🔴 Red" };

export function healthReportToMarkdown(
  report: HealthReport,
  m: Pick<HealthMetrics, "projectName" | "progress" | "doneTasks" | "totalTasks" | "daysToDeadline" | "expectedProgress"> & {
    overdue: number;
    dueThisWeek: number;
    openFeedback: number;
  },
  footer: string,
): string {
  const lines = [
    `## Project health — ${m.projectName}`,
    "",
    `**Overall status: ${STATUS_LABEL[report.status]}**`,
    "",
    report.headline,
    "",
    "### Key metrics",
    `- Progress: ${m.progress}% (${m.doneTasks}/${m.totalTasks} tasks done)${m.expectedProgress !== null ? `, ~${m.expectedProgress}% of timeline elapsed` : ""}`,
    `- Overdue tasks: ${m.overdue} · Due this week: ${m.dueThisWeek}`,
    `- Open client requests: ${m.openFeedback}`,
    ...(m.daysToDeadline !== null ? [`- Days to target date: ${m.daysToDeadline}`] : []),
    "",
    "### Bottlenecks & overdue risks",
    ...report.bottlenecks.map((item) => `- ${item}`),
    "",
    "### Recommended next steps",
    ...report.nextSteps.map((item, index) => `${index + 1}. ${item}`),
    "",
    `_${footer}_`,
  ];
  return lines.join("\n");
}

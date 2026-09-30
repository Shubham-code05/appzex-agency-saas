"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, CircleAlert, Copy, HeartPulse, ListChecks, RefreshCw, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import type { AiErrorResponse, HealthStatus, ProjectHealthResponse } from "@/lib/ai/types";
import { formatDateTime } from "@/lib/dates";
import { Drawer } from "@/components/ui/drawer";
import { AiModeNotice } from "@/components/ai/ai-mode-notice";

const STATUS_META: Record<HealthStatus, { label: string; Icon: LucideIcon; card: string; pill: string }> = {
  GREEN: { label: "Green · On track", Icon: ShieldCheck, card: "border-emerald-200 bg-emerald-50", pill: "bg-emerald-600" },
  AMBER: { label: "Amber · At risk", Icon: AlertTriangle, card: "border-amber-200 bg-amber-50", pill: "bg-amber-500" },
  RED: { label: "Red · Off track", Icon: CircleAlert, card: "border-rose-200 bg-rose-50", pill: "bg-rose-600" },
};

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: ProjectHealthResponse };

export function AiHealthButton({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [copied, setCopied] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ kind: "loading" });
    try {
      const response = await fetch("/api/ai/project-health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
        signal: controller.signal,
      });
      const json = (await response.json().catch(() => null)) as ProjectHealthResponse | AiErrorResponse | null;
      if (!response.ok || !json || "error" in json) {
        setState({ kind: "error", message: json && "error" in json ? json.error : "The health check failed. Please try again." });
        return;
      }
      setState({ kind: "ready", data: json });
    } catch (error) {
      if ((error as Error).name !== "AbortError") setState({ kind: "error", message: "Network error. Please try again." });
    }
  }, [projectId]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  function openDrawer() {
    setOpen(true);
    if (state.kind === "idle" || state.kind === "error") void run();
  }

  async function copyMarkdown(markdown: string) {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable (e.g. insecure context) — ignore */
    }
  }

  const ready = state.kind === "ready" ? state.data : null;

  return (
    <>
      <button
        type="button"
        onClick={openDrawer}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-violet-500 hover:to-indigo-500 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <Sparkles className="h-4 w-4" aria-hidden />
        AI Project Health
      </button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="AI Project Health"
        description={projectName}
        footer={
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">{ready ? `Generated ${formatDateTime(ready.generatedAt)}` : "Uses live project data"}</p>
            <div className="flex gap-2">
              {ready && (
                <button
                  type="button"
                  onClick={() => copyMarkdown(ready.markdown)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                  {copied ? "Copied" : "Copy as Markdown"}
                </button>
              )}
              <button
                type="button"
                onClick={() => void run()}
                disabled={state.kind === "loading"}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${state.kind === "loading" ? "animate-spin" : ""}`} aria-hidden />
                Regenerate
              </button>
            </div>
          </div>
        }
      >
        {state.kind === "loading" || state.kind === "idle" ? (
          <HealthSkeleton />
        ) : state.kind === "error" ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
            <p className="font-medium">Couldn&apos;t run the health check</p>
            <p className="mt-1">{state.message}</p>
          </div>
        ) : (
          <HealthReportView data={state.data} />
        )}
      </Drawer>
    </>
  );
}

function HealthReportView({ data }: { data: ProjectHealthResponse }) {
  const meta = STATUS_META[data.report.status];
  const { metrics } = data;
  const behind = metrics.expectedProgress !== null ? metrics.expectedProgress - metrics.progress : null;

  return (
    <div className="space-y-6" aria-live="polite">
      <AiModeNotice mode={data.mode} model={data.model} notice={data.notice} />

      <section className={`rounded-xl border p-5 ${meta.card}`}>
        <div className="mb-2 flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-white ${meta.pill}`}>
            <meta.Icon className="h-3.5 w-3.5" aria-hidden />
            {meta.label}
          </span>
        </div>
        <p className="text-base font-medium text-slate-900">{data.report.headline}</p>
      </section>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Progress" value={`${metrics.progress}%`} hint={behind !== null && behind > 0 ? `${behind} pts behind plan` : `${metrics.doneTasks}/${metrics.totalTasks} tasks`} warn={behind !== null && behind >= 15} />
        <Metric label="Overdue" value={metrics.overdueTasks} warn={metrics.overdueTasks > 0} />
        <Metric label="Due this week" value={metrics.dueThisWeek} />
        <Metric
          label="Open requests"
          value={metrics.openFeedback}
          hint={metrics.daysToDeadline !== null ? `${metrics.daysToDeadline}d to target` : undefined}
        />
      </dl>

      <section>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <HeartPulse className="h-4 w-4 text-rose-500" aria-hidden />
          Bottlenecks & overdue risks
        </h3>
        <ul className="space-y-2">
          {data.report.bottlenecks.map((item, index) => (
            <li key={index} className="flex gap-2.5 rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <ListChecks className="h-4 w-4 text-indigo-500" aria-hidden />
          Recommended next steps
        </h3>
        <ol className="space-y-2">
          {data.report.nextSteps.map((item, index) => (
            <li key={index} className="flex gap-3 text-sm text-slate-700">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700">
                {index + 1}
              </span>
              <span className="pt-0.5">{item}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Metric({ label, value, hint, warn = false }: { label: string; value: string | number; hint?: string; warn?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${warn ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white"}`}>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`text-lg font-semibold tabular-nums ${warn ? "text-rose-700" : "text-slate-900"}`}>{value}</dd>
      {hint && <dd className="text-[11px] text-slate-500">{hint}</dd>}
    </div>
  );
}

function HealthSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Analysing project">
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Sparkles className="h-4 w-4 text-violet-500" aria-hidden />
        Analysing tasks, milestones and client requests…
      </p>
      <div className="space-y-3 rounded-xl border border-slate-200 p-5">
        <div className="h-6 w-32 rounded-full bg-slate-200" />
        <div className="h-4 w-full rounded bg-slate-200" />
        <div className="h-4 w-2/3 rounded bg-slate-200" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-16 rounded-lg bg-slate-100" />
        ))}
      </div>
      {Array.from({ length: 2 }, (_, section) => (
        <div key={section} className="space-y-2">
          <div className="h-4 w-48 rounded bg-slate-200" />
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-10 rounded-lg bg-slate-100" />
          ))}
        </div>
      ))}
    </div>
  );
}

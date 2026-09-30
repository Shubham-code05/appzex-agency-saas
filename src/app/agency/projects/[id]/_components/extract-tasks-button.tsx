"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowLeft, CheckCircle2, ListPlus, Loader2, Sparkles, Wand2 } from "lucide-react";
import { createTasksFromAi } from "@/actions/agency-actions";
import type { AiErrorResponse, AiTaskDraft, ExtractTasksResponse } from "@/lib/ai/types";
import { TASK_PRIORITIES, TASK_PRIORITY_LABEL } from "@/lib/agency-enums";
import { formatShortDate, startOfUtcDay } from "@/lib/dates";
import { Modal } from "@/components/ui/modal";
import { inputClass } from "@/components/ui/form";
import { AiModeNotice } from "@/components/ai/ai-mode-notice";

interface EditableDraft extends AiTaskDraft {
  key: string;
  selected: boolean;
}

type Step = "input" | "review" | "done";

/**
 * Meeting notes → AI task drafts → human review/edit → one-click batch create.
 * The route only returns drafts; tasks are created solely by the
 * createTasksFromAi server action after the user confirms.
 */
export function ExtractTasksButton({
  projectId,
  initialNotes = "",
  sourceLabel,
  variant = "secondary",
}: {
  projectId: string;
  initialNotes?: string;
  sourceLabel?: string;
  variant?: "secondary" | "inline";
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("input");
  const [notes, setNotes] = useState(initialNotes);
  const [drafts, setDrafts] = useState<EditableDraft[]>([]);
  const [meta, setMeta] = useState<Pick<ExtractTasksResponse, "mode" | "model" | "notice"> | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function openModal() {
    setNotes(initialNotes);
    setStep("input");
    setDrafts([]);
    setError(null);
    setOpen(true);
  }

  async function extract() {
    setExtracting(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/meeting-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, notes }),
      });
      const json = (await response.json().catch(() => null)) as ExtractTasksResponse | AiErrorResponse | null;
      if (!response.ok || !json || "error" in json) {
        setError(json && "error" in json ? json.error : "Extraction failed. Please try again.");
        return;
      }
      setMeta({ mode: json.mode, model: json.model, notice: json.notice });
      setDrafts(json.tasks.map((task, index) => ({ ...task, key: `${Date.now()}-${index}`, selected: true })));
      setStep("review");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setExtracting(false);
    }
  }

  function update(key: string, patch: Partial<EditableDraft>) {
    setDrafts((current) => current.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft)));
  }

  const selected = drafts.filter((draft) => draft.selected && draft.title.trim());

  function addToProject() {
    setError(null);
    startSaving(async () => {
      const result = await createTasksFromAi(
        projectId,
        selected.map(({ title, description, priority, suggestedDueDateDays }) => ({
          title: title.trim(),
          description: description?.trim() || null,
          priority,
          suggestedDueDateDays,
        })),
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setResultMessage(result.message);
      setStep("done");
    });
  }

  const today = startOfUtcDay();

  return (
    <>
      {variant === "inline" ? (
        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-violet-700 transition hover:bg-violet-50"
        >
          <Wand2 className="h-3.5 w-3.5" aria-hidden />
          AI Extract Tasks
        </button>
      ) : (
        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3.5 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          Extract tasks from notes
        </button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title="AI: meeting notes → tasks"
        description={sourceLabel ? `From “${sourceLabel}”` : "Paste raw notes; review the suggestions before anything is created."}
      >
        {error && (
          <p role="alert" className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        {step === "input" && (
          <div className="space-y-4">
            <div>
              <label htmlFor="ai-notes" className="mb-1.5 flex justify-between text-sm font-medium text-slate-700">
                Meeting notes
                <span className="text-xs font-normal text-slate-400 tabular-nums">{notes.length.toLocaleString()} / 20,000</span>
              </label>
              <textarea
                id="ai-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={12}
                maxLength={20000}
                placeholder={"- Devon to set up staging by tomorrow (blocker)\n- Alicia will send revised timeline next week\n- Nice to have: dark mode later"}
                className={`${inputClass} font-mono text-[13px]`}
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void extract()}
                disabled={extracting || notes.trim().length < 20}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {extracting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
                {extracting ? "Extracting…" : "Extract tasks"}
              </button>
            </div>
          </div>
        )}

        {step === "review" && meta && (
          <div className="space-y-4">
            <AiModeNotice mode={meta.mode} model={meta.model} notice={meta.notice} />

            {drafts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                No action items found. Try notes with bullet points like “Devon to …” or “Action: …”.
              </p>
            ) : (
              <ul className="space-y-3">
                {drafts.map((draft) => (
                  <li
                    key={draft.key}
                    className={`rounded-xl border p-3 transition ${draft.selected ? "border-violet-200 bg-white" : "border-slate-200 bg-slate-50 opacity-60"}`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={draft.selected}
                        onChange={(e) => update(draft.key, { selected: e.target.checked })}
                        aria-label={`Include “${draft.title}”`}
                        className="mt-2.5 h-4 w-4 accent-violet-600"
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <input
                          value={draft.title}
                          onChange={(e) => update(draft.key, { title: e.target.value })}
                          maxLength={200}
                          aria-label="Task title"
                          className={`${inputClass} font-medium`}
                        />
                        {draft.description && (
                          <textarea
                            value={draft.description}
                            onChange={(e) => update(draft.key, { description: e.target.value })}
                            rows={2}
                            maxLength={5000}
                            aria-label="Task description"
                            className={`${inputClass} text-xs`}
                          />
                        )}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                          <label className="flex items-center gap-1.5">
                            Priority
                            <select
                              value={draft.priority}
                              onChange={(e) => update(draft.key, { priority: e.target.value as AiTaskDraft["priority"] })}
                              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                            >
                              {TASK_PRIORITIES.map((priority) => (
                                <option key={priority} value={priority}>
                                  {TASK_PRIORITY_LABEL[priority]}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="flex items-center gap-1.5">
                            Due in
                            <input
                              type="number"
                              min={0}
                              max={365}
                              value={draft.suggestedDueDateDays ?? ""}
                              placeholder="—"
                              onChange={(e) =>
                                update(draft.key, {
                                  suggestedDueDateDays:
                                    e.target.value === "" ? null : Math.min(365, Math.max(0, Math.trunc(Number(e.target.value)) || 0)),
                                })
                              }
                              className="w-16 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs tabular-nums"
                            />
                            days
                          </label>
                          <span className="text-slate-400">
                            {draft.suggestedDueDateDays === null
                              ? "No due date"
                              : `→ ${formatShortDate(new Date(today.getTime() + draft.suggestedDueDateDays * 86_400_000))}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep("input")}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Edit notes
              </button>
              <button
                type="button"
                onClick={addToProject}
                disabled={saving || selected.length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ListPlus className="h-4 w-4" aria-hidden />}
                Add {selected.length} task{selected.length === 1 ? "" : "s"} to project
              </button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center py-8 text-center">
            <CheckCircle2 className="mb-3 h-10 w-10 text-emerald-500" aria-hidden />
            <p className="font-medium text-slate-900">{resultMessage}</p>
            <p className="mt-1 text-sm text-slate-500">Project progress has been recalculated.</p>
            <Link
              href={`/agency/projects/${projectId}`}
              onClick={() => setOpen(false)}
              className="mt-5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              View tasks
            </Link>
          </div>
        )}
      </Modal>
    </>
  );
}

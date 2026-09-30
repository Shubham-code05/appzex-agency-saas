"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Tone = "violet" | "indigo" | "sky" | "emerald" | "slate" | "teal" | "rose";

export interface DemoAccount {
  label: string;
  detail: string;
  email: string;
  password: string;
  tone: Tone;
}

const TONE_DOT: Record<Tone, string> = {
  violet: "bg-violet-500",
  indigo: "bg-indigo-500",
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
  slate: "bg-slate-400",
  teal: "bg-teal-500",
  rose: "bg-rose-500",
};

interface LoginFormProps {
  next?: string;
  notice?: string;
  demoAccounts: DemoAccount[];
}

export function LoginForm({ next, notice, demoAccounts }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);

  function fillDemo(account: DemoAccount) {
    setEmail(account.email);
    setPassword(account.password);
    setSelectedEmail(account.email);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, next }),
        credentials: "same-origin",
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; redirectTo?: string };

      if (!response.ok) {
        setError(data.error ?? "Sign in failed. Please try again.");
        setPending(false);
        return;
      }

      router.replace(data.redirectTo ?? "/");
      router.refresh();
    } catch {
      setError("Network error. Please check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        {notice && !error && (
          <p className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setSelectedEmail(null);
              }}
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              placeholder="you@agency.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setSelectedEmail(null);
              }}
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={pending || !email || !password}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
            )}
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>

      {demoAccounts.length > 0 && (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-5 backdrop-blur-sm">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Quick demo credentials</h2>
            <span className="text-xs text-slate-400">Click to fill</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {demoAccounts.map((account) => {
              const selected = selectedEmail === account.email;
              return (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => fillDemo(account)}
                  aria-pressed={selected}
                  className={`group flex items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
                    selected
                      ? "border-indigo-400 bg-indigo-50"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE_DOT[account.tone]}`} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-800">{account.label}</span>
                    <span className="block truncate text-xs text-slate-500">{account.detail}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            All demo accounts use <code className="rounded bg-slate-100 px-1 py-0.5 text-slate-600">Password123!</code>
          </p>
        </section>
      )}
    </div>
  );
}

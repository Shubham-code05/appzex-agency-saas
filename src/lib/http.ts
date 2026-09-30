import type { NextRequest } from "next/server";

/**
 * CSRF defence-in-depth for state-changing endpoints. Browsers always send
 * `Origin` on cross-origin POSTs; if present it must match the host serving
 * the request. Non-browser clients (curl, tests) that omit it are allowed —
 * they cannot ride on a victim's cookies anyway.
 */
export function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

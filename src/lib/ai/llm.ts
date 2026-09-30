import "server-only";
import type { z } from "zod";

/**
 * Minimal OpenAI-compatible Chat Completions client (plain fetch, no SDK).
 * Works with Groq (default when GROQ_API_KEY is set) and OpenAI.
 * API keys never leave the server and are never logged.
 */

export interface LlmConfig {
  provider: "groq" | "openai";
  model: string;
  baseUrl: string;
  apiKey: string;
}

export class LlmError extends Error {}

const REQUEST_TIMEOUT_MS = 30_000;

export function getLlmConfig(): LlmConfig | null {
  const override = process.env.AI_MODEL?.trim();
  if (process.env.GROQ_API_KEY) {
    return {
      provider: "groq",
      model: override || "llama-3.3-70b-versatile",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY,
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: "openai",
      model: override || "gpt-4o-mini",
      baseUrl: "https://api.openai.com/v1",
      apiKey: process.env.OPENAI_API_KEY,
    };
  }
  return null;
}

/**
 * Sends a system + user prompt in JSON mode and validates the reply against
 * `schema`. Anything malformed becomes an LlmError, so callers can fall back.
 */
export async function chatJson<T>(
  config: LlmConfig,
  options: { system: string; user: string; schema: z.ZodType<T>; maxTokens: number; temperature?: number },
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: options.system },
          { role: "user", content: options.user },
        ],
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    throw new LlmError(error instanceof Error && error.name === "TimeoutError" ? "AI provider timed out" : "AI provider unreachable");
  }

  if (!response.ok) {
    // Log status only — never the prompt (tenant data) or the key.
    console.error(`[ai] ${config.provider} responded ${response.status}`);
    throw new LlmError(response.status === 429 ? "AI provider rate limit reached" : `AI provider error (${response.status})`);
  }

  const payload = (await response.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
  } | null;
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) throw new LlmError("AI provider returned an empty response");

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new LlmError("AI returned invalid JSON");
  }

  const result = options.schema.safeParse(parsed);
  if (!result.success) throw new LlmError("AI returned an unexpected format");
  return result.data;
}

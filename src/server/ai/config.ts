import "server-only";

export type AiProviderName = "anthropic" | "openai-compatible" | "demo" | "none";

export interface AiConfig {
  provider: AiProviderName;
  model: string;
  apiKey: string | null;
  baseUrl: string | null;
  /** true when real or demo generation can run */
  available: boolean;
  /** true when outputs are clearly-labelled sample data, not real model output */
  demo: boolean;
  timeoutMs: number;
  maxRetries: number;
  maxOutputTokens: number;
  dailyTokenLimit: number;
  maxContextChars: number;
}

/**
 * Centralised, environment-driven AI configuration. The model is never hard-coded elsewhere.
 *   AI_PROVIDER=anthropic | openai-compatible | demo | none (default: none)
 *   AI_MODEL, AI_API_KEY, AI_BASE_URL (openai-compatible only)
 */
export function getAiConfig(): AiConfig {
  const raw = (process.env.AI_PROVIDER ?? "none").toLowerCase();
  const provider: AiProviderName = raw === "anthropic" || raw === "openai-compatible" || raw === "demo" ? raw : "none";
  const apiKey = process.env.AI_API_KEY || null;
  const defaults: Record<AiProviderName, string> = {
    anthropic: "claude-opus-5-5",
    "openai-compatible": "gpt-4o-mini",
    demo: "demo-fixtures",
    none: "",
  };
  const needsKey = provider === "anthropic" || provider === "openai-compatible";
  return {
    provider,
    model: process.env.AI_MODEL || defaults[provider],
    apiKey,
    baseUrl: process.env.AI_BASE_URL || null,
    available: provider === "demo" || (needsKey && !!apiKey),
    demo: provider === "demo",
    timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 45_000),
    maxRetries: Number(process.env.AI_MAX_RETRIES ?? 2),
    maxOutputTokens: Number(process.env.AI_MAX_OUTPUT_TOKENS ?? 2048),
    dailyTokenLimit: Number(process.env.AI_DAILY_TOKEN_LIMIT ?? 200_000),
    maxContextChars: Number(process.env.AI_MAX_CONTEXT_CHARS ?? 24_000),
  };
}

/** Client-safe summary (never includes secrets). */
export function publicAiStatus() {
  const c = getAiConfig();
  return { available: c.available, demo: c.demo, provider: c.provider, model: c.available ? c.model : null };
}

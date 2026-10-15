import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { AppError } from "../errors";
import type { AiConfig } from "./config";
import { demoOutput } from "./demo";
import type { AiKind } from "./schemas";

export interface GenerateRequest<T> {
  kind: AiKind;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
}

export interface GenerateResult<T> {
  data: T;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export interface AiProvider {
  generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>>;
}

const unavailable = (msg: string) => new AppError(msg, "UNAVAILABLE");

/** Anthropic Messages API via the official SDK, with schema-constrained structured output. */
class AnthropicProvider implements AiProvider {
  private client: Anthropic;
  constructor(private cfg: AiConfig) {
    this.client = new Anthropic({ apiKey: cfg.apiKey ?? undefined, timeout: cfg.timeoutMs, maxRetries: cfg.maxRetries });
  }
  async generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>> {
    try {
      const response = await this.client.messages.parse({
        model: this.cfg.model,
        max_tokens: this.cfg.maxOutputTokens,
        system: req.system,
        messages: [{ role: "user", content: req.prompt }],
        output_config: { format: zodOutputFormat(req.schema as z.ZodType<T> & z.ZodObject) },
      });
      if (response.stop_reason === "refusal") throw unavailable("The AI provider declined this request.");
      if (response.stop_reason === "max_tokens") throw unavailable("The AI response was cut off. Try a narrower request.");
      const parsed = req.schema.safeParse(response.parsed_output);
      if (!parsed.success) throw unavailable("The AI returned output in an unexpected shape, so it was discarded.");
      return { data: parsed.data, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, model: response.model };
    } catch (e) {
      if (e instanceof AppError) throw e;
      if (e instanceof Anthropic.RateLimitError) throw new AppError("The AI provider is rate limiting requests. Try again shortly.", "RATE_LIMITED");
      if (e instanceof Anthropic.AuthenticationError) throw unavailable("The AI provider rejected the configured API key.");
      if (e instanceof Anthropic.APIError) throw unavailable(`The AI provider returned an error (${e.status ?? "network"}).`);
      throw unavailable("The AI request failed.");
    }
  }
}

/** Any OpenAI-compatible chat completions endpoint (self-hosted or third-party). */
class OpenAiCompatibleProvider implements AiProvider {
  constructor(private cfg: AiConfig) {}
  async generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>> {
    const base = (this.cfg.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.cfg.maxRetries; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.cfg.timeoutMs);
      try {
        const res = await fetch(`${base}/chat/completions`, {
          method: "POST",
          signal: ctrl.signal,
          headers: { "content-type": "application/json", authorization: `Bearer ${this.cfg.apiKey}` },
          body: JSON.stringify({
            model: this.cfg.model,
            max_tokens: this.cfg.maxOutputTokens,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: `${req.system}\nRespond with a single JSON object only.` },
              { role: "user", content: req.prompt },
            ],
          }),
        });
        if (res.status === 429 || res.status >= 500) {
          lastError = new Error(`HTTP ${res.status}`);
          await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
          continue;
        }
        if (!res.ok) throw unavailable(`The AI provider returned an error (${res.status}).`);
        const body = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number }; model?: string };
        const text = body.choices?.[0]?.message?.content ?? "";
        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          throw unavailable("The AI returned malformed JSON, so it was discarded.");
        }
        const parsed = req.schema.safeParse(json);
        if (!parsed.success) throw unavailable("The AI returned output in an unexpected shape, so it was discarded.");
        return { data: parsed.data, inputTokens: body.usage?.prompt_tokens ?? 0, outputTokens: body.usage?.completion_tokens ?? 0, model: body.model ?? this.cfg.model };
      } catch (e) {
        if (e instanceof AppError) throw e;
        lastError = e;
      } finally {
        clearTimeout(timer);
      }
    }
    console.error("[worldforge] AI request failed", lastError);
    throw unavailable("The AI request failed or timed out.");
  }
}

/** Clearly-labelled sample outputs for demonstrations; never presented as real model output. */
class DemoProvider implements AiProvider {
  async generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>> {
    const parsed = req.schema.safeParse(demoOutput(req.kind, req.prompt));
    if (!parsed.success) throw unavailable("Demo fixture failed validation.");
    return { data: parsed.data, inputTokens: 0, outputTokens: 0, model: "demo-fixtures" };
  }
}

export function createProvider(cfg: AiConfig): AiProvider {
  if (!cfg.available) throw unavailable("AI is not configured on this server. Set AI_PROVIDER and AI_API_KEY to enable it.");
  switch (cfg.provider) {
    case "anthropic":
      return new AnthropicProvider(cfg);
    case "openai-compatible":
      return new OpenAiCompatibleProvider(cfg);
    case "demo":
      return new DemoProvider();
    default:
      throw unavailable("AI is not configured on this server.");
  }
}

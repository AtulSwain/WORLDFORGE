import { afterEach, describe, expect, it } from "vitest";
import { getAiConfig, publicAiStatus } from "@/server/ai/config";
import { demoOutput } from "@/server/ai/demo";
import { AI_KINDS, SCHEMA_BY_KIND } from "@/server/ai/schemas";

const saved = { ...process.env };
afterEach(() => {
  for (const k of ["AI_PROVIDER", "AI_MODEL", "AI_API_KEY"]) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("AI configuration", () => {
  it("is off by default and explains why", () => {
    delete process.env.AI_PROVIDER;
    const c = getAiConfig();
    expect(c.available).toBe(false);
    expect(c.unavailableReason).toMatch(/No AI provider/);
  });

  it("requires an API key and an explicit model for real providers", () => {
    process.env.AI_PROVIDER = "anthropic";
    delete process.env.AI_API_KEY;
    process.env.AI_MODEL = "some-model";
    expect(getAiConfig().unavailableReason).toMatch(/API key/);
    process.env.AI_API_KEY = "test-key";
    delete process.env.AI_MODEL;
    expect(getAiConfig().unavailableReason).toMatch(/AI_MODEL/);
    process.env.AI_MODEL = "some-model";
    expect(getAiConfig().available).toBe(true);
  });

  it("never exposes the API key in the client-safe status", () => {
    process.env.AI_PROVIDER = "anthropic";
    process.env.AI_API_KEY = "sk-very-secret";
    process.env.AI_MODEL = "some-model";
    expect(JSON.stringify(publicAiStatus())).not.toContain("sk-very-secret");
  });

  it("runs the demo provider without credentials", () => {
    process.env.AI_PROVIDER = "demo";
    expect(getAiConfig()).toMatchObject({ available: true, demo: true });
  });
});

describe("demo fixtures", () => {
  it("produce schema-valid output for every task", () => {
    const prompt = "SUBJECT [id:subject-0001] CANDIDATES [id:candidate-01] [id:candidate-02]";
    for (const kind of AI_KINDS) {
      const r = SCHEMA_BY_KIND[kind].safeParse(demoOutput(kind, prompt));
      expect(r.success, kind).toBe(true);
    }
  });

  it("only reference IDs that appear in the prompt", () => {
    const out = JSON.stringify(demoOutput("CHARACTER_RELATIONSHIPS", "[id:candidate-01] [id:candidate-02] [id:candidate-03]"));
    for (const m of out.matchAll(/"targetId":"([^"]+)"/g)) expect(["candidate-01", "candidate-02", "candidate-03"]).toContain(m[1]);
  });
});

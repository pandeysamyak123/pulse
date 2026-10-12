// Gemini Flash wrapper: structured JSON output, zod validation, one retry on
// invalid output, per-model rate limiting, backoff on 429/5xx, per-run counters.
//
// Free-tier Gemini quotas are per model (e.g. 5 requests/min each), so calls
// are spread over a pool of Flash models: GEMINI_MODEL first, then
// GEMINI_FALLBACK_MODELS. A model that returns 429 is benched for the delay
// Gemini asks for (or for the rest of the process on a daily-quota 429).
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const FALLBACKS = (process.env.GEMINI_FALLBACK_MODELS ?? "gemini-3.7-flash,gemini-3.6-flash")
  .split(",")
  .map((m) => m.trim())
  .filter((m) => m && m !== GEMINI_MODEL);
const RPM = Number(process.env.GEMINI_RPM || 5);

let client: GoogleGenAI | null = null;
const ai = () => (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! }));

export type GeminiUsage = { calls: number; tokens: number; models?: Record<string, number> };
export const newUsage = (): GeminiUsage => ({ calls: 0, tokens: 0, models: {} });

function jsonSchemaFor(schema: z.ZodType) {
  const js = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  delete js.$schema;
  return js;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ───────────── per-model rate limiter ─────────────
type ModelState = { name: string; starts: number[]; benchedUntil: number };
const pool: ModelState[] = [GEMINI_MODEL, ...FALLBACKS].map((name) => ({ name, starts: [], benchedUntil: 0 }));
let gate: Promise<void> = Promise.resolve();

function nextFree(m: ModelState, now: number) {
  const recent = m.starts.filter((t) => now - t < 60_000);
  m.starts = recent;
  const byRate = recent.length < RPM ? now : recent[0] + 60_000 + 50;
  return Math.max(byRate, m.benchedUntil);
}

/** Reserve a request slot on whichever model frees up first. Serialized so slots never double-book. */
function acquire(): Promise<ModelState> {
  const run = gate.then(async () => {
    for (;;) {
      const now = Date.now();
      const best = pool.map((m) => ({ m, at: nextFree(m, now) })).sort((a, b) => a.at - b.at)[0];
      if (best.at === Infinity) throw new Error("All Gemini models have exhausted their daily quota");
      if (best.at <= now) {
        best.m.starts.push(now);
        return best.m;
      }
      await sleep(Math.min(best.at - now, 15_000));
    }
  });
  gate = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function quotaInfo(e: unknown) {
  const msg = String((e as Error)?.message ?? e);
  const is429 = /\b429\b|RESOURCE_EXHAUSTED/.test(msg);
  const daily = /PerDay|per day|daily/i.test(msg);
  const m = msg.match(/retry in ([\d.]+)s|"retryDelay":"(\d+)s"/);
  const retryMs = m ? Math.ceil(Number(m[1] ?? m[2]) * 1000) + 500 : 30_000;
  return { is429, daily, retryMs };
}

function isRetryable(e: unknown) {
  const msg = String((e as Error)?.message ?? e);
  return /\b(429|500|502|503|504)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded|fetch failed|ECONNRESET/i.test(msg);
}

/**
 * Call Gemini with a zod schema. Returns parsed data, or null after one
 * validation retry fails (caller logs + skips). Transport errors rotate models
 * / back off up to 6 attempts, then throw.
 */
export async function generateJson<T extends z.ZodType>(opts: {
  schema: T;
  system: string;
  prompt: string;
  usage?: GeminiUsage;
  temperature?: number;
  label?: string;
  /** Flash "thinking" depth; LOW keeps batch classification fast. */
  thinking?: "MINIMAL" | "LOW" | "MEDIUM" | "HIGH";
}): Promise<z.infer<T> | null> {
  const responseJsonSchema = jsonSchemaFor(opts.schema);
  let lastIssue = "";

  for (let validationAttempt = 0; validationAttempt < 2; validationAttempt++) {
    let text = "";
    for (let attempt = 0; ; attempt++) {
      const model = await acquire();
      try {
        const res = await ai().models.generateContent({
          model: model.name,
          contents:
            validationAttempt === 0
              ? opts.prompt
              : `${opts.prompt}\n\nYour previous answer was invalid (${lastIssue}). Return JSON that matches the schema exactly.`,
          config: {
            systemInstruction: opts.system,
            responseMimeType: "application/json",
            responseJsonSchema,
            temperature: opts.temperature ?? 0.2,
            ...(opts.thinking ? { thinkingConfig: { thinkingLevel: ThinkingLevel[opts.thinking] } } : {}),
          },
        });
        if (opts.usage) {
          opts.usage.calls++;
          opts.usage.tokens += res.usageMetadata?.totalTokenCount ?? 0;
          if (opts.usage.models) opts.usage.models[model.name] = (opts.usage.models[model.name] ?? 0) + 1;
        }
        text = res.text ?? "";
        break;
      } catch (e) {
        if (opts.usage) opts.usage.calls++;
        const q = quotaInfo(e);
        if (q.is429) model.benchedUntil = q.daily ? Infinity : Date.now() + q.retryMs;
        if (attempt >= 5 || !isRetryable(e)) throw e;
        if (!q.is429) await sleep(1500 * 2 ** Math.min(attempt, 3) + Math.random() * 500);
      }
    }

    try {
      const parsed = opts.schema.safeParse(JSON.parse(text));
      if (parsed.success) return parsed.data;
      lastIssue = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    } catch {
      lastIssue = "response was not valid JSON";
    }
  }
  console.warn(`[gemini] ${opts.label ?? "call"} failed validation twice: ${lastIssue}`);
  return null;
}

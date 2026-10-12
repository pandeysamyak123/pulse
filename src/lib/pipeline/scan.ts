// Scan orchestrator. Split into start / scanAccounts / finish so a Vercel route
// can process accounts in batches across several invocations.
//
// OWNERSHIP: this module never writes ARJUN tables. It inserts into SYSTEM
// tables (articles, signals, outreach_drafts, note_digests, score_history,
// scan_runs) and touches `accounts` ONLY through apply_signal_update().
import pLimit from "p-limit";
import { supabaseAdmin, must } from "../supabase";
import { newUsage, type GeminiUsage } from "../gemini";
import { fetchAccount, fetchGdeltAll } from "./fetch";
import { prefilter, BACKFILL_CAP, BACKFILL_DAYS } from "./prefilter";
import { classifyAccount } from "./classify";
import { clusterSignals, scoreAccount, type SignalRow } from "./score";
import { SCORING_LOOKBACK_DAYS } from "./config";
import type { AccountRow, RawItem } from "./types";

const DAY = 86_400_000;

export type AccountResult = {
  account_id: string;
  company: string;
  fetched: number;
  prefiltered: number;
  stored: number;
  on_company: number;
  new_signals: number;
  score: number;
  prev_score: number;
  tier: string;
  prev_tier: string;
  drafts: number;
  error?: string;
};

export type ProgressEvent =
  | { stage: "fetching" | "filtering" | "reading" | "scoring" | "drafting"; company: string }
  | { stage: "done"; result: AccountResult };

export type ScanOptions = {
  /** Phase-4 hook: brief/angle/drafts/digest after scoring. */
  enrich?: (ctx: EnrichContext) => Promise<{ drafts: number }>;
  onProgress?: (e: ProgressEvent) => void;
  concurrency?: number;
};

export type EnrichContext = {
  account: AccountRow;
  signals: SignalRow[];
  newSignals: number;
  usage: GeminiUsage;
  runId: string;
};

export async function startRun(trigger: string): Promise<string> {
  const db = supabaseAdmin();
  const hash = must(await db.rpc("arjun_data_hash"), "hash") as string;
  const row = must(
    await db.from("scan_runs").insert({ trigger, arjun_hash_before: hash, status: "running" }).select("id").single(),
    "scan_runs insert",
  ) as { id: string };
  return row.id;
}

export async function finishRun(runId: string) {
  const db = supabaseAdmin();
  const run = must(await db.from("scan_runs").select("*").eq("id", runId).single(), "run") as {
    arjun_hash_before: string;
    errors: unknown[];
  };
  const after = must(await db.rpc("arjun_data_hash"), "hash") as string;
  const ok = after === run.arjun_hash_before;
  must(
    await db
      .from("scan_runs")
      .update({
        finished_at: new Date().toISOString(),
        arjun_hash_after: after,
        integrity_ok: ok,
        status: ok ? (run.errors.length ? "completed_with_errors" : "completed") : "integrity_failed",
      })
      .eq("id", runId),
    "finish run",
  );
  return { integrity_ok: ok, hash_before: run.arjun_hash_before, hash_after: after };
}

async function scanOne(
  a: AccountRow,
  gdeltPool: RawItem[],
  runId: string,
  usage: GeminiUsage,
  opts: ScanOptions,
): Promise<AccountResult> {
  const db = supabaseAdmin();
  const emit = (stage: "fetching" | "filtering" | "reading" | "scoring" | "drafting") =>
    opts.onProgress?.({ stage, company: a.company_name });
  const res: AccountResult = {
    account_id: a.id,
    company: a.company_name,
    fetched: 0,
    prefiltered: 0,
    stored: 0,
    on_company: 0,
    new_signals: 0,
    score: 0,
    prev_score: Number(a.warmth_score),
    tier: a.warmth_tier,
    prev_tier: a.warmth_tier,
    drafts: 0,
  };

  // 1. Fetch (a brand-new account gets a one-time 30-day backfill)
  emit("fetching");
  const stored = must(await db.from("articles").select("url").eq("account_id", a.id), "stored urls") as { url: string }[];
  const firstScan = stored.length === 0;
  const { items, errors } = await fetchAccount(a, gdeltPool, firstScan ? BACKFILL_DAYS : 7);
  if (errors.length) res.error = errors.join("; ");

  // 2. Prefilter (no AI)
  emit("filtering");
  const { kept, stats } = prefilter(
    a,
    items,
    new Set(stored.map((s) => s.url)),
    firstScan ? { windowDays: BACKFILL_DAYS, cap: BACKFILL_CAP } : {},
  );
  res.fetched = stats.fetched;
  res.prefiltered = kept.length;

  // 3. Classify (one Gemini call) + store
  if (kept.length) {
    emit("reading");
    const known = must(
      await db
        .from("signals")
        .select("event_key, chip, signal_type")
        .eq("account_id", a.id)
        .not("event_key", "is", null)
        .gte("detected_at", new Date(Date.now() - 30 * DAY).toISOString()),
      "known events",
    ) as { event_key: string; chip: string | null; signal_type: string }[];
    const classified = await classifyAccount(a, kept, usage, known);
    if (classified === null) {
      res.error = [res.error, "classification failed validation twice; skipped"].filter(Boolean).join("; ");
    } else {
      const rows = classified.map((c) => ({
        account_id: a.id,
        title: c.item.title,
        url: c.item.url,
        source_name: c.item.source_name,
        published_at: c.item.published_at,
        snippet: c.item.snippet || null,
        is_about_company: c.is_about_this_company,
        is_trigger: c.is_trigger,
        ai_one_liner: c.ai_one_liner,
        fetched_via: c.item.fetched_via,
      }));
      const inserted = must(
        await db.from("articles").upsert(rows, { onConflict: "account_id,url", ignoreDuplicates: true }).select("id, url"),
        "articles upsert",
      ) as { id: string; url: string }[];
      res.stored = inserted.length;
      res.on_company = classified.filter((c) => c.is_about_this_company).length;
      const idByUrl = new Map(inserted.map((r) => [r.url, r.id]));

      const sigRows = classified
        .filter((c) => c.is_trigger && idByUrl.has(c.item.url))
        .map((c) => ({
          account_id: a.id,
          article_id: idByUrl.get(c.item.url)!,
          signal_type: c.signal_type,
          chip: c.chip,
          summary: c.summary,
          evidence_snippet: c.evidence_snippet,
          confidence: c.confidence,
          relevance_reason: c.relevance_reason,
          people_mentioned: c.people_mentioned,
          event_key: c.event_key || null,
          published_at: c.item.published_at ?? (c.event_date ? `${c.event_date}T00:00:00Z` : null),
        }));
      if (sigRows.length) {
        const ins = must(
          await db.from("signals").upsert(sigRows, { onConflict: "article_id", ignoreDuplicates: true }).select("id"),
          "signals insert",
        ) as { id: string }[];
        res.new_signals = ins.length;
      }
    }
  }

  // 4–5. Cluster + score over the lookback window (decay makes quiet accounts sink).
  emit("scoring");
  const since = new Date(Date.now() - SCORING_LOOKBACK_DAYS * DAY).toISOString();
  const signals = must(
    await db
      .from("signals")
      .select("id, signal_type, chip, summary, evidence_snippet, confidence, published_at, detected_at, cluster_id, is_cluster_lead, corroborations, event_key")
      .eq("account_id", a.id)
      .gte("detected_at", since),
    "signals",
  ) as SignalRow[];
  const before = new Map(signals.map((s) => [s.id, `${s.cluster_id}|${s.is_cluster_lead}|${s.corroborations}`]));
  clusterSignals(signals);
  for (const s of signals) {
    if (before.get(s.id) !== `${s.cluster_id}|${s.is_cluster_lead}|${s.corroborations}`) {
      must(
        await db
          .from("signals")
          .update({ cluster_id: s.cluster_id, is_cluster_lead: s.is_cluster_lead, corroborations: s.corroborations })
          .eq("id", s.id),
        "cluster update",
      );
    }
  }

  const { score, tier, trend, breakdown } = scoreAccount(signals, a.stage, Number(a.warmth_score));
  const top = breakdown[0];
  const pubTimes = signals.map((s) => Date.parse(s.published_at ?? s.detected_at));
  const now = Date.now();
  must(
    await db.rpc("apply_signal_update", {
      p_account_id: a.id,
      p_payload: {
        warmth_score: score,
        warmth_tier: tier,
        score_trend: trend,
        score_breakdown: breakdown,
        top_signal_id: top?.signal_id ?? "",
        signals_last_3d: pubTimes.filter((t) => now - t <= 3 * DAY).length,
        signals_last_14d: pubTimes.filter((t) => now - t <= 14 * DAY).length,
        last_signal_at: pubTimes.length ? new Date(Math.max(...pubTimes)).toISOString() : "",
        last_scanned_at: new Date().toISOString(),
        signal_summary: top ? top.summary : null, // refined by the Phase-4 brief
      },
    }),
    "apply_signal_update",
  );
  must(await db.from("score_history").insert({ account_id: a.id, scan_run_id: runId, score, tier }), "score_history");
  res.score = score;
  res.tier = tier;

  // 6–7. Brief, angle, drafts, note digest (Phase 4).
  if (opts.enrich) {
    emit("drafting");
    const fresh = must(await db.from("accounts").select("*").eq("id", a.id).single(), "account") as AccountRow;
    const out = await opts.enrich({ account: fresh, signals, newSignals: res.new_signals, usage, runId });
    res.drafts = out.drafts;
  }
  return res;
}

/** Scan a set of accounts and fold the counts into scan_runs. Never throws for a single account. */
export async function scanAccounts(runId: string, accountIds: string[] | "all", opts: ScanOptions = {}) {
  const db = supabaseAdmin();
  let q = db.from("accounts").select("*").order("company_name");
  if (accountIds !== "all") q = q.in("id", accountIds);
  const accounts = must(await q, "accounts") as AccountRow[];

  const usage = newUsage();
  const errors: { company: string; error: string }[] = [];
  const gdeltPool = await fetchGdeltAll(accounts).catch((e) => {
    errors.push({ company: "*", error: `gdelt: ${e.message}` });
    return [] as RawItem[];
  });

  const limit = pLimit(opts.concurrency ?? 4);
  const results = await Promise.all(
    accounts.map((a) =>
      limit(async () => {
        try {
          const r = await scanOne(a, gdeltPool, runId, usage, opts);
          if (r.error) errors.push({ company: a.company_name, error: r.error });
          opts.onProgress?.({ stage: "done", result: r });
          return r;
        } catch (e) {
          const msg = (e as Error).message;
          errors.push({ company: a.company_name, error: msg });
          console.error(`[scan] ${a.company_name}: ${msg}`);
          return null;
        }
      }),
    ),
  );
  const ok = results.filter((r): r is AccountResult => !!r);

  const run = must(await db.from("scan_runs").select("*").eq("id", runId).single(), "run") as Record<string, number | unknown[]>;
  must(
    await db
      .from("scan_runs")
      .update({
        accounts_scanned: (run.accounts_scanned as number) + ok.length,
        articles_fetched: (run.articles_fetched as number) + ok.reduce((s, r) => s + r.fetched, 0),
        articles_after_prefilter: (run.articles_after_prefilter as number) + ok.reduce((s, r) => s + r.prefiltered, 0),
        articles_stored: (run.articles_stored as number) + ok.reduce((s, r) => s + r.stored, 0),
        signals_created: (run.signals_created as number) + ok.reduce((s, r) => s + r.new_signals, 0),
        drafts_created: (run.drafts_created as number) + ok.reduce((s, r) => s + r.drafts, 0),
        gemini_calls: (run.gemini_calls as number) + usage.calls,
        tokens: (run.tokens as number) + usage.tokens,
        errors: [...(run.errors as unknown[]), ...errors],
        summary: mergeModels(run.summary as unknown as { models?: Record<string, number> }, usage.models ?? {}),
      })
      .eq("id", runId),
    "run counters",
  );
  return { results: ok, errors, usage };
}

function mergeModels(summary: { models?: Record<string, number> } | null, models: Record<string, number>) {
  const merged = { ...(summary?.models ?? {}) };
  for (const [m, n] of Object.entries(models)) merged[m] = (merged[m] ?? 0) + n;
  return { ...(summary ?? {}), models: merged };
}

export async function runScan(trigger: string, opts: ScanOptions = {}) {
  const runId = await startRun(trigger);
  const scan = await scanAccounts(runId, "all", opts);
  const integrity = await finishRun(runId);
  return { runId, ...scan, integrity };
}

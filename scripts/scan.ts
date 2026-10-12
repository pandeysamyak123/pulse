// npm run scan — run a full scan locally and print a ranked table with score breakdowns.
import { config } from "dotenv";
config({ path: ".env.local" });

import { runScan } from "../src/lib/pipeline/scan";
import { supabaseAdmin, must } from "../src/lib/supabase";
import type { BreakdownEntry } from "../src/lib/pipeline/score";

async function main() {
  const t0 = Date.now();
  const enrich = process.argv.includes("--no-enrich")
    ? undefined
    : await import("../src/lib/pipeline/enrich").then((m) => m.enrichAccount).catch(() => undefined);
  const out = await runScan("cli", {
    enrich,
    onProgress: (e) => e.stage === "done" && console.log(`  ✓ ${e.result.company.padEnd(24)} fetched ${e.result.fetched}, kept ${e.result.prefiltered}, +${e.result.new_signals} signals, score ${e.result.prev_score}→${e.result.score}`),
  });
  console.log(`\nRun ${out.runId} in ${((Date.now() - t0) / 1000).toFixed(0)}s · Gemini calls ${out.usage.calls} · tokens ${out.usage.tokens}`);
  console.log(`Integrity: ${out.integrity.integrity_ok ? "OK ✓" : "FAILED ✗"}  (${out.integrity.hash_before} → ${out.integrity.hash_after})`);
  if (out.errors.length) console.log("Errors:", out.errors);

  const db = supabaseAdmin();
  const accs = must(
    await db.from("accounts").select("company_name, stage, warmth_score, warmth_tier, score_trend, score_breakdown, signals_last_14d").order("warmth_score", { ascending: false }),
    "accounts",
  ) as { company_name: string; stage: string; warmth_score: number; warmth_tier: string; score_trend: string; score_breakdown: BreakdownEntry[]; signals_last_14d: number }[];

  console.log("\n#  Account                  Stage     Score  Tier   Trend    14d");
  accs.forEach((a, i) => {
    console.log(`${String(i + 1).padStart(2)} ${a.company_name.padEnd(24)} ${a.stage.padEnd(9)} ${String(a.warmth_score).padStart(5)}  ${a.warmth_tier.padEnd(6)} ${a.score_trend.padEnd(8)} ${a.signals_last_14d}`);
    for (const b of a.score_breakdown.filter((x) => x.counted)) {
      console.log(
        `      ${b.score.toFixed(1).padStart(5)} = ${b.base} × ${b.confidence} conf × ${b.decay} decay (${b.age_days}d / ${b.half_life}d)${b.stage_mult !== 1 ? ` × ${b.stage_mult} stage` : ""}${b.corroborations ? ` [+${b.corroborations} sources]` : ""}  ${b.type}: ${b.chip} — ${b.summary}`,
      );
    }
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

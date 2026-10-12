// Server-side scan for cron: batches of accounts within a time budget so the
// function stays inside Vercel's limit. Unscanned accounts are recorded as errors
// and picked up by the next run.
import "server-only";
import { supabaseAdmin, must } from "./supabase";
import { finishRun, scanAccounts, startRun } from "./pipeline/scan";
import { enrichAccount } from "./pipeline/enrich";

export async function cronScan(trigger: string, budgetMs = 250_000) {
  const t0 = Date.now();
  const runId = await startRun(trigger);
  const ids = (must(await supabaseAdmin().from("accounts").select("id").order("last_scanned_at", { ascending: true, nullsFirst: true }), "ids") as { id: string }[]).map(
    (r) => r.id,
  );
  let done = 0;
  for (let i = 0; i < ids.length; i += 3) {
    if (Date.now() - t0 > budgetMs - 60_000) break; // leave room for one more batch + finish
    await scanAccounts(runId, ids.slice(i, i + 3), { enrich: enrichAccount });
    done = Math.min(ids.length, i + 3);
  }
  if (done < ids.length) {
    const db = supabaseAdmin();
    const run = must(await db.from("scan_runs").select("errors").eq("id", runId).single(), "run") as { errors: unknown[] };
    await db
      .from("scan_runs")
      .update({ errors: [...run.errors, { company: "*", error: `time budget reached: ${ids.length - done} accounts deferred to next run` }] })
      .eq("id", runId);
  }
  const integrity = await finishRun(runId);
  return { runId, scanned: done, total: ids.length, integrity, ms: Date.now() - t0 };
}

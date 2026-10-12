// Abuse / quota guards for the open app. All state lives in the database (serverless
// instances share nothing), so limits hold across every Vercel invocation.
import "server-only";
import { supabaseAdmin, must } from "./supabase";
import { finishRun } from "./pipeline/scan";

const MIN = 60_000;

export class LimitError extends Error {}

export const LIMITS = {
  scanCooldownMin: 10,
  regenPerAccountPerHour: 4,
  regenCooldownMin: 2,
  sendsPerHour: 10,
  staleRunMin: 15,
};

/** Close runs whose browser went away mid-scan, recording the integrity hash honestly. */
export async function closeStaleRuns() {
  const db = supabaseAdmin();
  const stale = must(
    await db
      .from("scan_runs")
      .select("id")
      .is("finished_at", null)
      .lt("started_at", new Date(Date.now() - LIMITS.staleRunMin * MIN).toISOString()),
    "stale runs",
  ) as { id: string }[];
  for (const r of stale) {
    await finishRun(r.id);
    await db.from("scan_runs").update({ status: "abandoned" }).eq("id", r.id);
  }
  return stale.length;
}

export async function assertScanAllowed() {
  await closeStaleRuns();
  const db = supabaseAdmin();
  const { data } = await db.from("scan_runs").select("started_at, finished_at").order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return;
  if (!data.finished_at) throw new LimitError("A scan is already running — watch it on the Runs page.");
  const mins = (Date.now() - Date.parse(data.started_at)) / MIN;
  if (mins < LIMITS.scanCooldownMin)
    throw new LimitError(`Last scan was ${Math.floor(mins)} min ago. Next one available in ${Math.ceil(LIMITS.scanCooldownMin - mins)} min (protects the AI quota).`);
}

export async function assertRegenAllowed(accountId: string) {
  const db = supabaseAdmin();
  const since = new Date(Date.now() - 60 * MIN).toISOString();
  const rows = must(
    await db.from("outreach_drafts").select("created_at").eq("account_id", accountId).eq("channel", "email").gte("created_at", since).order("created_at", { ascending: false }),
    "recent drafts",
  ) as { created_at: string }[];
  if (rows[0] && Date.now() - Date.parse(rows[0].created_at) < LIMITS.regenCooldownMin * MIN)
    throw new LimitError("Drafts were just regenerated — give it a couple of minutes.");
  if (rows.length >= LIMITS.regenPerAccountPerHour)
    throw new LimitError(`Regenerated ${rows.length}× this hour for this account — try again later (protects the AI quota).`);
}

export async function assertSendAllowed() {
  const db = supabaseAdmin();
  const { count } = await db
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("created_via", "send_button")
    .gte("created_at", new Date(Date.now() - 60 * MIN).toISOString());
  if ((count ?? 0) >= LIMITS.sendsPerHour) throw new LimitError(`Send limit reached (${LIMITS.sendsPerHour}/hour). Try again later.`);
}

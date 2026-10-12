// npm run test:integrity — proves automation cannot overwrite Arjun's data.
//  1. Hash all ARJUN data.
//  2. Run the FULL pipeline (fetch → classify → score → briefs/drafts/digests),
//     plus a hostile apply_signal_update payload that tries to set ARJUN columns.
//     `--quick` skips the live pipeline (no network / Gemini).
//  3. Re-hash; assert identical.
//  4. Assert that forbidden writes throw: system-actor edits/inserts (integrity_probe)
//     and raw service-role writes that bypass the RPCs.
import { config } from "dotenv";
config({ path: ".env.local" });

import { supabaseAdmin, must } from "../src/lib/supabase";
import { runScan } from "../src/lib/pipeline/scan";
import { enrichAccount } from "../src/lib/pipeline/enrich";

const db = supabaseAdmin();
let failures = 0;
const ok = (cond: boolean, label: string, detail = "") => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${label}${detail ? `  — ${detail}` : ""}`);
  if (!cond) failures++;
};

let snapshot: { id: string; [k: string]: unknown }[] = [];

async function systemWrites() {
  const accounts = must(
    await db.from("accounts").select("id, company_name, warmth_score, warmth_tier, signal_summary, last_scanned_at"),
    "accounts",
  ) as { id: string; company_name: string; [k: string]: unknown }[];
  snapshot = accounts;
  for (const a of accounts) {
    // A hostile payload: SYSTEM keys plus ARJUN keys the pipeline must never be able to set.
    must(
      await db.rpc("apply_signal_update", {
        p_account_id: a.id,
        p_payload: {
          warmth_score: 42,
          warmth_tier: "warm",
          signal_summary: "integrity test",
          last_scanned_at: new Date().toISOString(),
          arjun_notes: "OVERWRITTEN BY PIPELINE",
          last_contact_date: "2000-01-01",
          stage: "customer",
        },
      }),
      `apply_signal_update ${a.company_name}`,
    );
  }
  return accounts.length;
}

async function main() {
  console.log("Pulse integrity test\n");

  const before = must(await db.rpc("arjun_data_hash"), "hash before") as string;
  console.log(`  hash before: ${before}`);

  if (!process.argv.includes("--quick")) {
    console.log("  running the full pipeline (live fetch + Gemini)…");
    const scan = await runScan("integrity-test", { enrich: enrichAccount });
    console.log(`  pipeline: ${scan.results.length} accounts, ${scan.usage.calls} Gemini calls, run integrity_ok=${scan.integrity.integrity_ok}`);
    ok(scan.integrity.integrity_ok, "scan_runs records identical before/after hashes");
  }
  const n = await systemWrites();
  console.log(`  sent a hostile payload through apply_signal_update on ${n} accounts`);

  const after = must(await db.rpc("arjun_data_hash"), "hash after") as string;
  console.log(`  hash after:  ${after}\n`);
  ok(before === after, "ARJUN data hash unchanged after automation");

  const probe = must(await db.rpc("integrity_probe"), "probe") as Record<string, string>;
  ok(probe.system_edit_arjun_notes === "BLOCKED", "system actor editing arjun_notes throws", probe.msg_notes);
  ok(probe.system_edit_last_contact === "BLOCKED", "system actor editing last_contact_date throws");
  ok(probe.system_insert_activity === "BLOCKED", "system actor inserting an activity throws", probe.msg_activity);
  ok(probe.system_insert_note === "BLOCKED", "system actor inserting a note throws");
  ok(probe.system_edit_contact === "BLOCKED", "system actor editing a contact throws");
  ok(probe.no_actor_edit_relationship === "BLOCKED", "write with no actor set throws");

  // Raw service-role writes that skip the RPCs entirely must also fail.
  const acc = must(await db.from("accounts").select("id").limit(1).single(), "acc") as { id: string };
  const raw1 = await db.from("accounts").update({ arjun_notes: "raw overwrite" }).eq("id", acc.id);
  ok(!!raw1.error, "raw service-role update of arjun_notes throws", raw1.error?.message);
  const raw2 = await db.from("activities").insert({ account_id: acc.id, channel: "email", note: "raw insert" });
  ok(!!raw2.error, "raw service-role insert into activities throws", raw2.error?.message);
  const raw3 = await db.from("notes").delete().eq("account_id", acc.id);
  ok(!!raw3.error, "raw service-role delete of notes throws", raw3.error?.message);

  // Restore the SYSTEM fields the synthetic writes touched.
  for (const a of snapshot) {
    const { id, company_name: _n, ...sys } = a;
    must(await db.rpc("apply_signal_update", { p_account_id: id, p_payload: sys }), "restore");
  }

  const final = must(await db.rpc("arjun_data_hash"), "hash final") as string;
  ok(final === before, "hash still unchanged after all attempts", final);

  console.log(failures ? `\n${failures} FAILED` : "\nAll integrity checks passed ✓");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

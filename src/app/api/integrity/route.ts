// Live proof of the ownership rule: attempts forbidden writes as the pipeline
// (and with no actor) inside a transaction that is always rolled back, and
// returns which were blocked, plus the Arjun-data hash before/after.
import { NextResponse } from "next/server";
import { supabaseAdmin, must } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const db = supabaseAdmin();
  const before = must(await db.rpc("arjun_data_hash"), "hash") as string;
  const probe = must(await db.rpc("integrity_probe"), "probe") as Record<string, string>;
  // A raw admin write that skips every RPC — must also fail.
  const { data: acc } = await db.from("accounts").select("id").limit(1).single();
  const raw = await db.from("accounts").update({ arjun_notes: "overwritten by automation" }).eq("id", acc!.id);
  const after = must(await db.rpc("arjun_data_hash"), "hash") as string;

  const checks = [
    { label: "Pipeline edits Arjun's headline note", result: probe.system_edit_arjun_notes, detail: probe.msg_notes },
    { label: "Pipeline moves last-contact date", result: probe.system_edit_last_contact },
    { label: "Pipeline inserts a fake activity", result: probe.system_insert_activity, detail: probe.msg_activity },
    { label: "Pipeline inserts a note", result: probe.system_insert_note },
    { label: "Pipeline edits a contact", result: probe.system_edit_contact },
    { label: "Write with no actor at all", result: probe.no_actor_edit_relationship },
    { label: "Raw admin UPDATE skipping every RPC", result: raw.error ? "BLOCKED" : "ALLOWED", detail: raw.error?.message },
  ];
  return NextResponse.json({
    checks,
    allBlocked: checks.every((c) => c.result === "BLOCKED"),
    hashBefore: before,
    hashAfter: after,
    unchanged: before === after,
  });
}

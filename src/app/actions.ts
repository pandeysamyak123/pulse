"use server";

// UI write path. Every ARJUN write goes through an Arjun RPC (app.actor = 'arjun');
// every action requires the passcode session. Pipeline code never imports this file.
import { revalidatePath } from "next/cache";
import { clearSession, passcodeMatches, requireAuth, setSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { newUsage } from "@/lib/gemini";
import { regenerateDrafts, type Tone } from "@/lib/pipeline/enrich";
import { assertRegenAllowed } from "@/lib/guards";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function guard<T>(fn: () => Promise<T>, paths: string[] = []): Promise<Result<T>> {
  try {
    await requireAuth();
    const data = await fn();
    paths.forEach((p) => revalidatePath(p));
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function rpcOk<T>(res: { data: T; error: { message: string } | null }) {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

// ───────── session ─────────
export async function login(passcode: string): Promise<Result> {
  if (!passcode || !passcodeMatches(passcode.trim())) return { ok: false, error: "Wrong passcode" };
  await setSession();
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function logout(): Promise<Result> {
  await clearSession();
  revalidatePath("/", "layout");
  return { ok: true };
}

// ───────── notes ─────────
export async function addNote(accountId: string, body: string, pinned = false) {
  return guard(async () => {
    if (!body.trim()) throw new Error("Note is empty");
    return rpcOk(await supabaseAdmin().rpc("add_note", { p_account_id: accountId, p_body: body.trim(), p_pinned: pinned })) as string;
  }, [`/accounts/${accountId}`]);
}

export async function setNotePinned(accountId: string, noteId: string, pinned: boolean) {
  return guard(async () => {
    rpcOk(await supabaseAdmin().rpc("set_note_pinned", { p_note_id: noteId, p_pinned: pinned }));
  }, [`/accounts/${accountId}`]);
}

// ───────── activities ─────────
export type LogActivityInput = {
  account_id: string;
  contact_id?: string | null;
  channel: "email" | "linkedin" | "call" | "meeting" | "whatsapp" | "other";
  direction?: "outbound" | "inbound";
  subject?: string | null;
  body_sent?: string | null;
  outcome?: string | null;
  note?: string | null;
  occurred_at?: string | null;
  created_via?: "manual" | "send_button" | "linkedin_mark_sent";
  draft_id?: string | null;
};

export async function logActivity(input: LogActivityInput) {
  return guard(async () => rpcOk(await supabaseAdmin().rpc("log_activity", { p: input })) as string, [
    `/accounts/${input.account_id}`,
    "/",
  ]);
}

export async function setActivityOutcome(accountId: string, activityId: string, outcome: string) {
  return guard(async () => {
    rpcOk(await supabaseAdmin().rpc("set_activity_outcome", { p_activity_id: activityId, p_outcome: outcome }));
  }, [`/accounts/${accountId}`, "/"]);
}

// ───────── contacts + manual fields ─────────
export async function upsertContact(input: {
  id?: string;
  account_id: string;
  full_name: string;
  title?: string | null;
  email?: string | null;
  linkedin_url?: string | null;
  is_primary?: boolean;
  notes?: string | null;
}) {
  return guard(async () => {
    if (!input.full_name?.trim()) throw new Error("Name is required");
    return rpcOk(await supabaseAdmin().rpc("upsert_contact", { p: input })) as string;
  }, [`/accounts/${input.account_id}`]);
}

export async function updateManualFields(accountId: string, fields: Record<string, unknown>) {
  return guard(async () => {
    rpcOk(await supabaseAdmin().rpc("update_manual_fields", { p_account_id: accountId, p_fields: fields }));
  }, [`/accounts/${accountId}`, "/"]);
}

// ───────── drafts (SYSTEM table; Arjun asks the generator for a new version) ─────────
export async function regenerate(accountId: string, tone: Tone, channel?: string) {
  return guard(async () => {
    await assertRegenAllowed(accountId);
    const usage = newUsage();
    const r = await regenerateDrafts(accountId, usage, { tone, channel });
    return { ...r, calls: usage.calls };
  }, [`/accounts/${accountId}`]);
}

export async function discardDraft(accountId: string, draftId: string) {
  return guard(async () => {
    const { error } = await supabaseAdmin().from("outreach_drafts").update({ status: "discarded" }).eq("id", draftId);
    if (error) throw new Error(error.message);
  }, [`/accounts/${accountId}`]);
}

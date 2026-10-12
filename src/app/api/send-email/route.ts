// Send ONE outreach email on Arjun's explicit click (never automatic).
// SAFE_MODE (default on) redirects every outreach email to DEMO_CONTACT_EMAIL.
// After a successful send, log_activity records the exact body sent (Arjun's action).
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { revalidatePath } from "next/cache";
import { isAuthed } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function POST(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Read-only demo: unlock to send." }, { status: 401 });
  const b = (await req.json()) as {
    account_id: string;
    contact_id: string | null;
    to: string;
    subject: string;
    body: string;
    draft_id?: string | null;
  };
  if (!b.to || !b.subject?.trim() || !b.body?.trim()) return NextResponse.json({ error: "Recipient, subject and body are required." }, { status: 400 });

  const safe = process.env.SAFE_MODE !== "false";
  const demo = process.env.DEMO_CONTACT_EMAIL;
  if (safe && !demo) return NextResponse.json({ error: "SAFE_MODE is on but DEMO_CONTACT_EMAIL is not set." }, { status: 500 });
  const recipient = safe ? demo! : b.to;
  const subject = safe ? `[SAFE MODE → ${b.to}] ${b.subject}` : b.subject;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: process.env.OUTREACH_FROM_EMAIL || "Pulse <onboarding@resend.dev>",
    to: [recipient],
    replyTo: process.env.ARJUN_REPLY_TO || undefined,
    subject,
    text: b.body,
    html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.55;color:#111;white-space:pre-wrap">${esc(b.body)}</div>`,
  });
  if (error) return NextResponse.json({ error: `Resend: ${error.message}` }, { status: 502 });

  // Arjun's own action → his write path (sets last_contact_date, marks the draft used).
  const { error: logErr } = await supabaseAdmin().rpc("log_activity", {
    p: {
      account_id: b.account_id,
      contact_id: b.contact_id,
      channel: "email",
      direction: "outbound",
      subject: b.subject,
      body_sent: b.body,
      outcome: "no_reply",
      note: safe ? `Sent in SAFE MODE (delivered to ${recipient}); intended for ${b.to}. Resend id ${data?.id}` : `Resend id ${data?.id}`,
      created_via: "send_button",
      draft_id: b.draft_id ?? null,
    },
  });
  revalidatePath(`/accounts/${b.account_id}`);
  revalidatePath("/");
  return NextResponse.json({ ok: true, id: data?.id, deliveredTo: recipient, safe, logged: !logErr, logError: logErr?.message });
}

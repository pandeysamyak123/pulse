// "Send Hot List preview to me" (passcode). The scheduled send lives in /api/cron/hotlist.
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAuthed } from "@/lib/auth";
import { sendHotList } from "@/lib/hotlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Read-only demo: unlock to send." }, { status: 401 });
  try {
    const r = await sendHotList("preview");
    revalidatePath("/emails");
    return NextResponse.json({ ok: true, subject: r.subject, id: r.id });
  } catch (e) {
    revalidatePath("/emails");
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

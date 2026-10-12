// Vercel Cron → Hot List, Mon & Thu 08:00 IST. Runs a fresh scan first if the
// last finished scan is older than 6 hours. Protected by CRON_SECRET.
import { NextResponse } from "next/server";
import { isCron } from "@/lib/auth";
import { cronScan } from "@/lib/cron-scan";
import { sendHotList } from "@/lib/hotlist";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: last } = await supabaseAdmin()
    .from("scan_runs")
    .select("finished_at")
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let scan = null;
  if (!last?.finished_at || Date.now() - Date.parse(last.finished_at) > 6 * 3_600_000) {
    scan = await cronScan("cron-hotlist", 200_000); // leave time for the email
  }
  const sent = await sendHotList("hotlist");
  return NextResponse.json({ scan, subject: sent.subject, id: sent.id });
}

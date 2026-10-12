// Vercel Cron → daily scan (06:00 IST). Protected by CRON_SECRET.
import { NextResponse } from "next/server";
import { isCron } from "@/lib/auth";
import { cronScan } from "@/lib/cron-scan";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await cronScan("cron"));
}

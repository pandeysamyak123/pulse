// Scan API, batched so each invocation stays inside Vercel's function limit.
//   POST {action:"start"}                → { runId, batches: string[][] }
//   POST {action:"batch", runId, ids}    → NDJSON stream of progress events
//   POST {action:"finish", runId}        → { integrity_ok, hash_before, hash_after }
// Auth: passcode session (UI) or Bearer CRON_SECRET.
import { NextResponse } from "next/server";
import { isAuthed, isCron } from "@/lib/auth";
import { supabaseAdmin, must } from "@/lib/supabase";
import { finishRun, scanAccounts, startRun } from "@/lib/pipeline/scan";
import { enrichAccount } from "@/lib/pipeline/enrich";
import { assertScanAllowed, LimitError } from "@/lib/guards";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const BATCH = 3;

export async function POST(req: Request) {
  if (!(isCron(req) || (await isAuthed()))) {
    return NextResponse.json({ error: "Read-only demo: unlock with the passcode to run a scan." }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { action?: string; runId?: string; ids?: string[] };

  if (body.action === "start") {
    if (!isCron(req)) {
      try {
        await assertScanAllowed();
      } catch (e) {
        if (e instanceof LimitError) return NextResponse.json({ error: e.message }, { status: 429 });
        throw e;
      }
    }
    const runId = await startRun(isCron(req) ? "cron" : "manual");
    const ids = (must(await supabaseAdmin().from("accounts").select("id").order("warmth_score", { ascending: false }), "ids") as { id: string }[]).map((r) => r.id);
    const batches: string[][] = [];
    for (let i = 0; i < ids.length; i += BATCH) batches.push(ids.slice(i, i + BATCH));
    return NextResponse.json({ runId, batches });
  }

  if (body.action === "batch" && body.runId && body.ids?.length) {
    const { runId, ids } = body;
    const enc = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
        try {
          const out = await scanAccounts(runId, ids, { enrich: enrichAccount, onProgress: (e) => send(e) });
          send({ stage: "batch_done", errors: out.errors, calls: out.usage.calls });
        } catch (e) {
          send({ stage: "error", error: (e as Error).message });
        }
        controller.close();
      },
    });
    return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
  }

  if (body.action === "finish" && body.runId) {
    return NextResponse.json(await finishRun(body.runId));
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

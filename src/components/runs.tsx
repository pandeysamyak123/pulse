"use client";

import { Activity, AlertTriangle, ChevronDown, Cpu, Loader2, ShieldAlert, ShieldCheck, ShieldX, Swords } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { cn, fmtDateTime } from "@/lib/format";
import type { ScanRun } from "@/lib/types";
import { Button, EmptyState, OwnerTag, Tip } from "./ui";

const FUNNEL = [
  { k: "articles_fetched", label: "Fetched", color: "var(--quiet)" },
  { k: "articles_after_prefilter", label: "Prefiltered", color: "var(--cool)" },
  { k: "articles_stored", label: "AI-read", color: "var(--accent)" },
  { k: "signals_created", label: "Triggers", color: "var(--warm)" },
  { k: "drafts_created", label: "Drafts", color: "var(--hot)" },
] as const;

export function RunsView({ runs }: { runs: ScanRun[] }) {
  const last = runs.find((r) => r.finished_at);
  const okRuns = runs.filter((r) => r.integrity_ok).length;
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Activity className="h-5 w-5 text-accent-text" /> Scan runs
        </h1>
        <OwnerTag owner="pulse" />
      </div>

      <div className="card flex flex-wrap items-center gap-4 p-5">
        <span className={cn("grid h-12 w-12 place-items-center rounded-2xl", last?.integrity_ok ? "bg-[color-mix(in_oklab,var(--ok)_14%,transparent)] text-ok" : "bg-surface-2 text-faint")}>
          <ShieldCheck className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">✍️ Arjun&apos;s data untouched — {okRuns}/{runs.filter((r) => r.finished_at).length} runs verified</p>
          <p className="text-sm text-muted">
            Every scan hashes all of Arjun&apos;s fields, contacts, notes and history before and after. Identical hashes prove automation changed nothing of his.
          </p>
        </div>
        {last && (
          <span className="num rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">
            {last.arjun_hash_after?.slice(0, 16)}…
          </span>
        )}
      </div>

      <ProveIt />

      {runs.length === 0 ? (
        <EmptyState icon={<Activity className="h-6 w-6" />} title="No scans yet." />
      ) : (
        <ul className="space-y-2">
          {runs.map((r, i) => (
            <RunRow key={r.id} r={r} i={i} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RunRow({ r, i }: { r: ScanRun; i: number }) {
  const [open, setOpen] = useState(false);
  const max = Math.max(1, r.articles_fetched);
  const dur = r.finished_at ? Math.round((Date.parse(r.finished_at) - Date.parse(r.started_at)) / 1000) : null;
  const errs = (r.errors ?? []).filter(Boolean);
  const models = Object.entries(r.summary?.models ?? {});
  return (
    <li className="card enter p-4" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-3 text-left" aria-expanded={open}>
        <span className="w-40 shrink-0">
          <span className="block text-sm font-medium">{fmtDateTime(r.started_at)}</span>
          <span className="text-xs text-faint">
            {r.trigger} · {dur != null ? `${dur}s` : "running"} · {r.accounts_scanned} accts
          </span>
        </span>
        <span className="flex min-w-[260px] flex-1 items-end gap-1.5" role="group" aria-label="Funnel">
          {FUNNEL.map((f) => {
            const v = r[f.k] as number;
            return (
              <Tip key={f.k} label={`${f.label}: ${v}`} className="flex-1">
                <span className="flex w-full flex-col gap-1">
                  <span className="num text-xs font-semibold">{v}</span>
                  <span className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                    <span className="block h-full rounded-full" style={{ width: `${Math.max(v ? 4 : 0, (v / max) * 100)}%`, background: f.color }} />
                  </span>
                  <span className="truncate text-[10px] text-faint">{f.label}</span>
                </span>
              </Tip>
            );
          })}
        </span>
        <span className="flex items-center gap-3">
          <Tip label={`${r.gemini_calls} Gemini calls · ${r.tokens.toLocaleString()} tokens`}>
            <span className="num inline-flex items-center gap-1 text-xs text-muted">
              <Cpu className="h-3.5 w-3.5" /> {r.gemini_calls}
            </span>
          </Tip>
          {errs.length > 0 && (
            <span className="num inline-flex items-center gap-1 text-xs text-warm">
              <AlertTriangle className="h-3.5 w-3.5" /> {errs.length}
            </span>
          )}
          {r.integrity_ok == null ? (
            <span className="text-xs text-faint">—</span>
          ) : r.integrity_ok ? (
            <Tip label="Arjun's data hash identical before/after">
              <ShieldCheck className="h-4 w-4 text-ok" />
            </Tip>
          ) : (
            <ShieldAlert className="h-4 w-4 text-bad" />
          )}
          <ChevronDown className={cn("h-4 w-4 text-faint transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open && (
        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-line pt-4 text-xs sm:grid-cols-2">
          <div className="space-y-1.5">
            <span className="label block">Integrity</span>
            <p className="num break-all text-muted">before {r.arjun_hash_before ?? "—"}</p>
            <p className="num break-all text-muted">after&nbsp; {r.arjun_hash_after ?? "—"}</p>
            <p className={r.integrity_ok ? "text-ok" : "text-faint"}>{r.integrity_ok ? "Identical ✓" : r.integrity_ok === false ? "Mismatch" : "Run not finished"}</p>
            {models.length > 0 && (
              <>
                <span className="label mt-3 block">Gemini Flash models</span>
                <p className="num text-muted">{models.map(([m, n]) => `${m} ×${n}`).join(" · ")}</p>
              </>
            )}
          </div>
          <div className="space-y-1.5">
            <span className="label block">Errors ({errs.length})</span>
            {errs.length ? (
              <ul className="space-y-1">
                {errs.slice(0, 12).map((e, j) => (
                  <li key={j} className="rounded-lg bg-surface-2 px-2 py-1 text-muted">
                    <b className="text-text">{e.company === "*" ? "sources" : e.company}</b> · {String(e.error).slice(0, 160)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">None</p>
            )}
          </div>
        </div>
      )}
    </li>
  );
}


/* ───────── Live proof: attack the ownership rule and watch every attempt bounce ───────── */
type Check = { label: string; result: string; detail?: string };
function ProveIt() {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ checks: Check[]; allBlocked: boolean; hashBefore: string; hashAfter: string; unchanged: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setErr(null);
    setRes(null);
    try {
      const r = await fetch("/api/integrity", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "failed");
      setRes(j);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card relative overflow-hidden p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent-text">
          <Swords className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Prove it, live</p>
          <p className="text-sm text-muted">Attack Arjun&apos;s data as the pipeline would. Every attempt should be refused by the database — and roll back.</p>
        </div>
        <Button variant="primary" onClick={run} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />} Run attack
        </Button>
      </div>
      {err && <p className="mt-3 text-sm text-bad">{err}</p>}
      <AnimatePresence>
        {res && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 space-y-1.5">
            {res.checks.map((c, i) => (
              <motion.div
                key={c.label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.12 * i }}
                className="flex items-start gap-2.5 rounded-xl bg-surface-2 px-3 py-2 text-sm"
              >
                {c.result === "BLOCKED" ? <ShieldX className="mt-0.5 h-4 w-4 shrink-0 text-ok" /> : <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-bad" />}
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{c.label}</span>
                  {c.detail && <span className="num block truncate text-[11px] text-faint">{c.detail}</span>}
                </span>
                <span className={cn("num text-xs font-semibold", c.result === "BLOCKED" ? "text-ok" : "text-bad")}>{c.result}</span>
              </motion.div>
            ))}
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.12 * res.checks.length + 0.1 }}
              className={cn(
                "mt-2 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold",
                res.allBlocked && res.unchanged ? "bg-[color-mix(in_oklab,var(--ok)_14%,transparent)] text-ok" : "bg-[color-mix(in_oklab,var(--bad)_14%,transparent)] text-bad",
              )}
            >
              <ShieldCheck className="h-4 w-4" />
              {res.allBlocked && res.unchanged ? `${res.checks.length}/${res.checks.length} blocked · Arjun's data hash unchanged` : "Something got through — investigate"}
              <span className="num ml-auto text-[11px] font-normal opacity-80">
                {res.hashBefore.slice(0, 10)}… = {res.hashAfter.slice(0, 10)}…
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

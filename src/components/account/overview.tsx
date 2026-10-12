"use client";

import { Check, ExternalLink, Loader2, Pencil, Quote, Target, Timer, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { updateManualFields } from "@/app/actions";
import { ago, cn, fmtDate, SIGNAL_LABEL, STAGE_LABEL, TIER_META } from "@/lib/format";
import type { Signal } from "@/lib/types";
import { firstSeenMap } from "@/lib/derive";
import { Button, OwnerTag, SignalIcon, Tip } from "../ui";
import { ScoreExplainer } from "../viz";
import type { WorkspaceProps } from "./workspace";

export function Overview(p: WorkspaceProps & { goTo: (t: string) => void }) {
  const a = p.account;
  const leads = p.signals.filter((s) => s.is_cluster_lead);
  const order = new Map(a.score_breakdown.map((b, i) => [b.signal_id, i]));
  const first = firstSeenMap(p.signals);
  const top = [...leads]
    .sort((x, y) => (order.get(x.id) ?? 99) - (order.get(y.id) ?? 99))
    .slice(0, 4)
    .map((s) => ({ ...s, published_at: first.get(s.cluster_id ?? s.id) ?? s.published_at }));
  const rec = p.contacts.find((c) => c.id === a.recommended_contact_id);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        {/* Brief + why now */}
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">What&apos;s happening</h2>
            <OwnerTag owner="pulse" />
          </div>
          {a.company_brief?.length ? (
            <ul className="space-y-2">
              {a.company_brief.map((b, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[15px]">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: TIER_META[a.warmth_tier].color }} />
                  {b}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No brief yet — it appears after the next scan.</p>
          )}
          {(a.why_now || a.outreach_angle) && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {a.why_now && (
                <div className="rounded-xl bg-surface-2 p-3">
                  <span className="label mb-1 flex items-center gap-1.5">
                    <Timer className="h-3 w-3" /> Why now
                  </span>
                  <p className="text-sm text-muted">{a.why_now}</p>
                </div>
              )}
              {a.outreach_angle && (
                <div className="rounded-xl bg-surface-2 p-3">
                  <span className="label mb-1 flex items-center gap-1.5">
                    <Target className="h-3 w-3" /> Angle
                  </span>
                  <p className="text-sm text-muted">{a.outreach_angle}</p>
                </div>
              )}
            </div>
          )}
          {rec && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="text-muted">Best contact: </span>
                <b>{rec.full_name}</b> <span className="text-faint">· {rec.title}</span>
                {a.recommended_contact_reason && <span className="block truncate text-xs text-faint">{a.recommended_contact_reason}</span>}
              </span>
              <Button size="sm" variant="primary" onClick={() => p.goTo("outreach")}>
                Open drafts
              </Button>
            </div>
          )}
        </section>

        {/* Top signals */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Top signals</h2>
            <span className="text-xs text-faint">{a.signals_last_14d} in 14 days</span>
          </div>
          {top.length ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {top.map((s) => (
                <SignalCard key={s.id} s={s} />
              ))}
            </div>
          ) : (
            <div className="card p-6 text-center text-sm text-muted">No triggers yet. Quiet accounts sink automatically as old signals decay.</div>
          )}
        </section>
      </div>

      <div className="space-y-5">
        <section className="card p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Warmth</h2>
            <OwnerTag owner="pulse" />
          </div>
          <ScoreExplainer breakdown={a.score_breakdown} score={a.warmth_score} tier={a.warmth_tier} inline />
        </section>
        <YoursPanel {...p} />
      </div>
    </div>
  );
}

export function SignalCard({ s }: { s: Signal }) {
  return (
    <article className="card flex flex-col gap-2 p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent-soft text-accent-text">
          <SignalIcon type={s.signal_type} className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{s.chip || SIGNAL_LABEL[s.signal_type]}</span>
          <span className="text-[11px] text-faint">
            {SIGNAL_LABEL[s.signal_type]} · <span className="num">{ago(s.published_at)}</span>
            {s.corroborations > 0 && ` · +${s.corroborations} sources`}
          </span>
        </span>
        <Tip label="Classifier confidence (after corroboration)">
          <span className="num rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">{Math.round(Number(s.confidence) * 100)}%</span>
        </Tip>
      </div>
      {s.evidence_snippet && (
        <blockquote className="flex gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
          <Quote className="h-3 w-3 shrink-0 text-faint" />
          <span className="line-clamp-2">{s.evidence_snippet}</span>
        </blockquote>
      )}
      {s.relevance_reason && <p className="line-clamp-1 text-xs text-faint">{s.relevance_reason}</p>}
      {s.articles?.url && (
        <a href={s.articles.url} target="_blank" rel="noreferrer" className="mt-auto inline-flex items-center gap-1 text-xs text-accent-text hover:underline">
          {s.articles.source_name ?? "Source"} <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </article>
  );
}

/* ───────── ✍️ Arjun's fields (editable) ───────── */
function YoursPanel(p: WorkspaceProps) {
  const a = p.account;
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    stage: a.stage,
    arjun_notes: a.arjun_notes ?? "",
    relationship_read: a.relationship_read ?? "",
    next_step: a.next_step ?? "",
    next_step_due: a.next_step_due ?? "",
    do_not_contact_until: a.do_not_contact_until ?? "",
    search_aliases: a.search_aliases.join(", "),
    exclude_terms: a.exclude_terms.join(", "),
  });
  const today = new Date().toISOString().slice(0, 10);
  const overdue = a.next_step_due && a.next_step_due <= today;

  const save = async () => {
    setBusy(true);
    const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
    const r = await updateManualFields(a.id, {
      stage: f.stage,
      arjun_notes: f.arjun_notes || null,
      relationship_read: f.relationship_read || null,
      next_step: f.next_step || null,
      next_step_due: f.next_step_due || null,
      do_not_contact_until: f.do_not_contact_until || null,
      search_aliases: split(f.search_aliases),
      exclude_terms: split(f.exclude_terms),
    });
    setBusy(false);
    if (r.ok) {
      toast.success("Saved");
      setEdit(false);
      router.refresh();
    } else toast.error(r.error);
  };

  const field = "w-full rounded-lg border border-line-strong bg-surface-2 px-2.5 py-1.5 text-sm outline-none focus:border-accent";

  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Your read</h2>
        <span className="flex items-center gap-1.5">
          <OwnerTag owner="you" />
          {!edit ? (
            <Tip label={p.authed ? "Edit" : "Unlock to edit"}>
              <Button size="sm" variant="ghost" onClick={() => setEdit(true)} disabled={!p.authed} aria-label="Edit your fields">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </Tip>
          ) : null}
        </span>
      </div>
      {!edit ? (
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="label mb-0.5">Headline note</dt>
            <dd>{a.arjun_notes ?? <span className="text-faint">—</span>}</dd>
          </div>
          <div>
            <dt className="label mb-0.5">Relationship</dt>
            <dd className="text-muted">{a.relationship_read ?? "—"}</dd>
          </div>
          <div>
            <dt className="label mb-0.5">Next step</dt>
            <dd className="flex flex-wrap items-center gap-2">
              {a.next_step ?? "—"}
              {a.next_step_due && <span className={cn("num rounded-md px-1.5 py-0.5 text-[11px]", overdue ? "bg-[color-mix(in_oklab,var(--bad)_15%,transparent)] text-bad" : "bg-surface-2 text-muted")}>{overdue ? "due " : ""}{fmtDate(a.next_step_due)}</span>}
            </dd>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <dt className="label mb-0.5">Last contact</dt>
              <dd className="num text-muted">{fmtDate(a.last_contact_date)}</dd>
            </div>
            <div>
              <dt className="label mb-0.5">Paused until</dt>
              <dd className="num text-muted">{fmtDate(a.do_not_contact_until)}</dd>
            </div>
          </div>
          <div>
            <dt className="label mb-0.5">Search terms</dt>
            <dd className="text-xs text-faint">
              {a.search_aliases.join(" · ") || "—"}
              {a.exclude_terms.length > 0 && <span className="block">excluding {a.exclude_terms.join(", ")}</span>}
            </dd>
          </div>
        </dl>
      ) : (
        <div className="space-y-2.5 text-sm">
          <label className="block">
            <span className="label">Stage</span>
            <select className={field} value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value as typeof f.stage })}>
              {Object.entries(STAGE_LABEL).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Headline note</span>
            <textarea rows={3} className={field} value={f.arjun_notes} onChange={(e) => setF({ ...f, arjun_notes: e.target.value })} />
          </label>
          <label className="block">
            <span className="label">Relationship read</span>
            <textarea rows={2} className={field} value={f.relationship_read} onChange={(e) => setF({ ...f, relationship_read: e.target.value })} />
          </label>
          <label className="block">
            <span className="label">Next step</span>
            <input className={field} value={f.next_step} onChange={(e) => setF({ ...f, next_step: e.target.value })} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="label">Due</span>
              <input type="date" className={field} value={f.next_step_due} onChange={(e) => setF({ ...f, next_step_due: e.target.value })} />
            </label>
            <label className="block">
              <span className="label">Pause until</span>
              <input type="date" className={field} value={f.do_not_contact_until} onChange={(e) => setF({ ...f, do_not_contact_until: e.target.value })} />
            </label>
          </div>
          <label className="block">
            <span className="label">Search aliases (comma-separated)</span>
            <input className={field} value={f.search_aliases} onChange={(e) => setF({ ...f, search_aliases: e.target.value })} />
          </label>
          <label className="block">
            <span className="label">Exclude terms</span>
            <input className={field} value={f.exclude_terms} onChange={(e) => setF({ ...f, exclude_terms: e.target.value })} />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="ghost" onClick={() => setEdit(false)}>
              <X className="h-3.5 w-3.5" /> Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={save} disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

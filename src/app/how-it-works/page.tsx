import type { Metadata } from "next";
import { Bot, Database, Lock, PenLine, Scale, ShieldCheck, Workflow } from "lucide-react";
import { Mermaid } from "@/components/mermaid";
import { COMPONENTS_MAP } from "@/lib/components-map";
import { Linkedin } from "@/components/ui";

export const metadata: Metadata = { title: "How it works" };

const LAYERS = [
  {
    icon: Workflow,
    title: "One write path for automation",
    body: "The pipeline touches accounts only through apply_signal_update(), which writes system columns and nothing else.",
  },
  {
    icon: Lock,
    title: "Database guard triggers",
    body: "Any write to your fields, contacts, notes or history that doesn't come from you raises OWNERSHIP_VIOLATION — even a raw admin update.",
  },
  {
    icon: PenLine,
    title: "Your write path",
    body: "Your edits go through update_manual_fields, log_activity, add_note and upsert_contact — passcode-protected.",
  },
  {
    icon: ShieldCheck,
    title: "Proof on every run",
    body: "A hash of all your data is taken before and after each scan. Identical hashes = untouched. npm run test:integrity proves the guards fire.",
  },
];

export default function HowItWorks() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">How Pulse works</h1>
        <p className="text-sm text-muted">Live news → AI reads it → a transparent score → drafts you approve. Your data is never overwritten.</p>
      </header>

      <section className="card p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-3 text-xs">
          <span className="font-semibold">Components map</span>
          <Legend color="#7c5cff" label="AI (Gemini Flash)" />
          <Legend color="#2cc8ea" label="Deterministic" />
          <Legend color="#9097a7" label="System-owned data" />
          <Legend color="#f5b83d" label="Arjun-owned data" />
          <Legend color="#6b7183" label="External service" dashed />
        </div>
        <Mermaid chart={COMPONENTS_MAP} />
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Database className="h-4 w-4 text-ok" /> The rule: automation never overwrites your data
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {LAYERS.map((l, i) => (
            <div key={l.title} className="card p-4">
              <span className="num text-xs text-faint">Layer {i + 1}</span>
              <l.icon className="my-2 h-5 w-5 text-accent-text" />
              <p className="text-sm font-semibold">{l.title}</p>
              <p className="mt-1 text-sm text-muted">{l.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="card p-4 text-sm">
            <span className="mb-2 inline-flex items-center gap-1 rounded-md bg-surface-3 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">✍️ Yours</span>
            <p className="text-muted">Company details, stage, search terms, last-contact date, headline note, relationship read, next step &amp; due date, pause date, contacts, reach-out history, notes log.</p>
          </div>
          <div className="card p-4 text-sm">
            <span className="mb-2 inline-flex items-center gap-1 rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-text">🤖 Found by Pulse</span>
            <p className="text-muted">Warmth score, tier &amp; trend, score breakdown, brief, signal summary, why-now, angle, recommended contact, articles, signals, drafts, AI digest, scan runs.</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Scale className="h-4 w-4 text-warm" /> Scoring — deterministic and explainable
          </h2>
          <pre className="num overflow-x-auto rounded-xl bg-surface-2 p-3 text-xs leading-relaxed">
{`signal  = base_weight × confidence × 0.5^(age_days ÷ half_life) × stage_multiplier
warmth  = min(100, sum of the top-3 event scores)
tiers   = hot ≥ 60 · warm ≥ 35 · cool ≥ 15 · quiet`}
          </pre>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted sm:grid-cols-4">
            {[
              ["Leadership hire", "30 · 21d"],
              ["Headcount expansion", "28 · 14d"],
              ["Funding round", "25 · 30d"],
              ["Digitalisation", "22 · 21d"],
              ["Operational pain", "20 · 10d"],
              ["New market", "18 · 14d"],
              ["M&A / restructuring", "15 · 21d"],
            ].map(([k, v]) => (
              <span key={k} className="flex justify-between gap-2">
                <span>{k}</span>
                <span className="num text-faint">{v}</span>
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-faint">
            Duplicate coverage of one event counts once; each corroborating source adds +0.1 confidence. Departures count as leadership change at ≤ 0.6 confidence. Customers ×1.3 on expansion (upsell), prospects ×1.2 on leadership hires (new buyer). Decay makes quiet accounts sink on their own. Outreach readiness (paused / contacted recently) is shown alongside and never changes the score.
          </p>
        </div>
        <div className="space-y-3">
          <div className="card p-5 text-sm">
            <h2 className="mb-2 flex items-center gap-2 font-semibold">
              <Linkedin className="h-4 w-4 text-cool" /> Why LinkedIn is hand-off only
            </h2>
            <p className="text-muted">
              LinkedIn&apos;s terms forbid automated scraping and messaging, and automation risks banning Arjun&apos;s account. Pulse catches executive moves through news, drafts the note within LinkedIn&apos;s limits, copies it and opens the profile — Arjun sends it himself and marks it sent.
            </p>
          </div>
          <div className="card p-5 text-sm">
            <h2 className="mb-2 flex items-center gap-2 font-semibold">
              <Bot className="h-4 w-4 text-accent-text" /> Guardrails on AI output
            </h2>
            <p className="text-muted">
              Structured JSON validated with zod · evidence must be verbatim · drafts are checked for channel limits, banned phrases, a named trigger and any figure not in the source facts — failures regenerate once and stay flagged.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted">
      <span className="h-3 w-3 rounded" style={{ border: `1.5px ${dashed ? "dashed" : "solid"} ${color}`, background: `color-mix(in oklab, ${color} 22%, transparent)` }} />
      {label}
    </span>
  );
}

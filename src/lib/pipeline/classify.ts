// Step 3 — Classify prefiltered items with ONE Gemini Flash call per account.
import { z } from "zod";
import { generateJson, type GeminiUsage } from "../gemini";
import type { AccountRow, RawItem } from "./types";

export const SIGNAL_TYPES = [
  "leadership_hire",
  "headcount_expansion",
  "funding_round",
  "workforce_digitalisation",
  "operational_challenge",
  "expansion_geo",
  "m_and_a",
] as const;
export type SignalType = (typeof SIGNAL_TYPES)[number];

const ItemSchema = z.object({
  i: z.number().int(),
  is_about_this_company: z.boolean(),
  is_trigger: z.boolean(),
  signal_type: z.enum([...SIGNAL_TYPES, "none"]),
  chip: z.string(),
  ai_one_liner: z.string(),
  summary: z.string(),
  evidence_snippet: z.string(),
  confidence: z.number().min(0).max(1),
  relevance_reason: z.string(),
  people_mentioned: z.array(z.string()),
  event_date: z.string(),
  event_key: z.string(),
});
const ResponseSchema = z.object({ items: z.array(ItemSchema) });
export type Classified = z.infer<typeof ItemSchema>;

const SYSTEM = `You are a B2B sales-intelligence analyst for a workforce-management (WFM) SaaS sold to Indian mid-market and enterprise companies (shift scheduling, attendance, leave/overtime, labour-code compliance, multi-site workforce analytics, contractor/gig workforce, WhatsApp employee app).

You read news items about ONE target company and classify each item.

Hard rules:
- Use ONLY the text given for each item. Never invent facts, numbers, names or dates.
- evidence_snippet MUST be copied verbatim from the item's title or snippet (max 25 words).
- is_about_this_company = false if the item is mainly about a different company with a similar name, a product review, a generic listicle, or only mentions the company in passing.
- is_trigger = true ONLY if the event plausibly creates a workforce-management need in the next 1–8 weeks: a new HR/operations leader (CHRO, CPO, Head of HR, COO, VP Ops), headcount growth or hiring drives, new stores/hubs/hotels/hospitals/plants/sites, fundraising that will fund expansion, workforce digitalisation/HR-tech programmes, operational pain (attrition, strikes, compliance, labour codes, staffing shortages), geographic expansion, M&A or restructuring that changes the workforce.
- NOT triggers: stock price moves, analyst targets, block/bulk deals by investors, quarterly results without workforce/site news, awards, CSR events, marketing campaigns, generic product launches, opinion pieces.
- signal_type = "none" when is_trigger is false.
- chip: 2–4 words for a UI pill, concrete (e.g. "New Head of HR", "15 new stores", "Agra hotel signed", "IPO filing"). Empty string if not a trigger.
- ai_one_liner: ≤ 12 words, what happened, plain English.
- summary: ≤ 20 words, the trigger and why it matters; same as ai_one_liner if not a trigger.
- relevance_reason: ≤ 20 words, why this matters for a WFM product (or why not).
- confidence: 0–1 that this is a real, company-specific trigger (0.9+ only for explicit, unambiguous events).
- event_date: YYYY-MM-DD if stated or implied by the item's published date, else "".
- people_mentioned: full names explicitly in the text, else [].
- event_key: short kebab-case id of the underlying real-world event, e.g. "gateway-agra-232-keys" or "q2-15-new-stores". Items that describe the SAME event (same hire, same store batch, same deal) MUST share the same key; different hotels/hires/deals MUST get different keys. Reuse a key from KNOWN EVENTS if the item is about that event. "" if not a trigger.

Signal types:
- leadership_hire: new CHRO / CPO / Head of HR / COO / VP or Head of Operations (also CEO if it signals an operating overhaul).
- headcount_expansion: hiring drives, new stores / dark stores / hubs / hotels / hospitals / clinics / plants / warehouses, capacity growth that adds frontline staff.
- funding_round: equity raise, IPO filing, large debt raise for expansion.
- workforce_digitalisation: HRMS/WFM/automation programmes, digital attendance, workforce-tech partnerships.
- operational_challenge: attrition, strikes, protests, staffing shortages, labour-code or compliance issues, service breakdowns caused by staffing.
- expansion_geo: entering a NEW city, state or country / new market (not just another site in an existing one).
- m_and_a: acquisitions, mergers, demergers, restructuring that changes the workforce.`;

function wordsCap(s: string, n: number) {
  const w = s.trim().split(/\s+/);
  return w.length <= n ? s.trim() : w.slice(0, n).join(" ") + "…";
}

const norm = (s: string) => s.toLowerCase().replace(/[“”"'’‘]/g, "").replace(/\s+/g, " ").trim();

/** Enforce the "copied verbatim" rule: if the model paraphrased, fall back to the headline. */
function verbatimEvidence(evidence: string, item: RawItem) {
  const src = norm(`${item.title} ${item.snippet}`);
  const ev = evidence.trim();
  if (ev && src.includes(norm(ev))) return wordsCap(ev, 25);
  return wordsCap(item.title, 25);
}

export async function classifyAccount(
  a: AccountRow,
  items: RawItem[],
  usage: GeminiUsage,
  knownEvents: { event_key: string; chip: string | null; signal_type: string }[] = [],
): Promise<(Classified & { item: RawItem })[] | null> {
  if (!items.length) return [];
  const list = items
    .map(
      (it, i) =>
        `[${i}] published=${it.published_at?.slice(0, 10) ?? "unknown"} source=${it.source_name ?? "?"}\nTITLE: ${it.title}${
          it.snippet && norm(it.snippet) !== norm(it.title) ? `\nSNIPPET: ${it.snippet.slice(0, 400)}` : ""
        }`,
    )
    .join("\n\n");

  const prompt = `Target company: ${a.company_name}
Also known as: ${a.search_aliases.join(", ") || "—"}
NOT this company (ignore): ${a.exclude_terms.join(", ") || "—"}
Industry: ${a.industry ?? "?"}

KNOWN EVENTS already recorded for this company (reuse their event_key if an item covers the same event):
${knownEvents.length ? knownEvents.map((e) => `- ${e.event_key} (${e.signal_type}: ${e.chip ?? ""})`).join("\n") : "- none"}

Classify every item below. Return one entry per item, using its index as "i".

${list}`;

  const res = await generateJson({
    schema: ResponseSchema,
    system: SYSTEM,
    prompt,
    usage,
    thinking: "LOW",
    label: `classify ${a.company_name}`,
  });
  if (!res) return null;

  const out: (Classified & { item: RawItem })[] = [];
  for (const c of res.items) {
    const item = items[c.i];
    if (!item) continue;
    const trigger = c.is_trigger && c.is_about_this_company && c.signal_type !== "none";
    out.push({
      ...c,
      is_trigger: trigger,
      signal_type: trigger ? c.signal_type : "none",
      chip: trigger ? wordsCap(c.chip, 4) : "",
      ai_one_liner: wordsCap(c.ai_one_liner, 14),
      summary: wordsCap(c.summary, 22),
      relevance_reason: wordsCap(c.relevance_reason, 22),
      evidence_snippet: verbatimEvidence(c.evidence_snippet, item),
      confidence: Math.max(0, Math.min(1, c.confidence)),
      event_key: trigger ? c.event_key.toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 60) : "",
      item,
    });
  }
  return out;
}

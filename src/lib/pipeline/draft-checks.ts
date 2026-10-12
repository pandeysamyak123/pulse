// Deterministic quality gate for outreach drafts. A failing draft set triggers
// exactly one regeneration with the failures fed back to Gemini.

export const LIMITS = {
  subjectWords: 8,
  emailWords: 120,
  linkedinConnectChars: 280, // LinkedIn's connection-note limit
  linkedinDmChars: 600,
  followupWords: 90,
};

export const BANNED_PHRASES = [
  "i hope this finds you well",
  "hope this email finds you",
  "hope you are doing well",
  "hope you're doing well",
  "i came across your profile",
  "just checking in",
  "touching base",
  "circling back",
  "synergy",
  "synergies",
  "game-changer",
  "game changer",
  "revolutionize",
  "revolutionise",
  "cutting-edge",
  "best-in-class",
  "world-class",
  "leverage our",
  "i was impressed",
  "truly impressive",
  "congratulations on your amazing",
  "quick call to pick your brain",
  "impressive",
  "congratulations",
  "congrats",
  "kudos",
  "now that your",
  "we have helped",
  "has helped similar",
  "our customers",
  "our clients",
];

const STOP = new Set(["the", "and", "for", "with", "new", "its", "from", "into", "that", "this", "has", "have", "india", "company"]);

/** Content words of the trigger (chip + summary) that a draft should echo. */
export function triggerTerms(chip: string | null, summary: string | null): string[] {
  const words = `${chip ?? ""} ${summary ?? ""}`
    .toLowerCase()
    .replace(/[^a-z0-9₹,. -]+/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/[.,]+$/, ""))
    .filter((w) => (w.length > 3 || /\d/.test(w)) && !STOP.has(w));
  return Array.from(new Set(words));
}

/** Draft must echo at least one of the top signals (a list of term-sets). */
export function mentionsAnyTrigger(text: string, termSets: string[][]) {
  return !termSets.length || termSets.some((t) => mentionsTrigger(text, t));
}

/**
 * Anti-hallucination: every figure in a draft must exist in the source facts.
 * Ignores call lengths ("20-minute") and small counts ≤ 3.
 */
export function unsupportedNumbers(text: string, sourceFacts: string): string[] {
  const src = sourceFacts.toLowerCase().replace(/,/g, "");
  const found = text.toLowerCase().replace(/,/g, "").match(/\d+(\.\d+)?(?!\s*-?\s*(minute|min\b|mins))/g) ?? [];
  return Array.from(new Set(found)).filter((n) => Number(n) > 3 && !src.includes(n));
}

export function mentionsTrigger(text: string, terms: string[]) {
  if (!terms.length) return true;
  const t = text.toLowerCase();
  // Two content words, or one number (e.g. "232", "15"), is enough to tie the message to the event.
  const hits = terms.filter((w) => t.includes(w));
  return hits.length >= 2 || hits.some((w) => /\d/.test(w));
}

const wc = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export type DraftSet = {
  email: { subject: string; body: string };
  linkedin_connect: string;
  linkedin_dm: string;
  followup: string;
};

export function checkDrafts(d: DraftSet, termSets: string[][], coldOpener: boolean, sourceFacts: string): string[] {
  const issues: string[] = [];
  if (wc(d.email.subject) > LIMITS.subjectWords) issues.push(`email subject is ${wc(d.email.subject)} words (max ${LIMITS.subjectWords})`);
  if (wc(d.email.body) > LIMITS.emailWords) issues.push(`email body is ${wc(d.email.body)} words (max ${LIMITS.emailWords})`);
  if (d.linkedin_connect.length > LIMITS.linkedinConnectChars)
    issues.push(`linkedin_connect is ${d.linkedin_connect.length} chars (max ${LIMITS.linkedinConnectChars})`);
  if (d.linkedin_dm.length > LIMITS.linkedinDmChars) issues.push(`linkedin_dm is ${d.linkedin_dm.length} chars (max ${LIMITS.linkedinDmChars})`);
  if (d.followup && wc(d.followup) > LIMITS.followupWords) issues.push(`followup is ${wc(d.followup)} words (max ${LIMITS.followupWords})`);

  const all = { email: `${d.email.subject} ${d.email.body}`, linkedin_connect: d.linkedin_connect, linkedin_dm: d.linkedin_dm, followup: d.followup };
  for (const [k, v] of Object.entries(all)) {
    const low = v.toLowerCase();
    for (const b of BANNED_PHRASES) if (low.includes(b)) issues.push(`${k} contains banned phrase "${b}"`);
  }
  if (coldOpener) {
    if (!mentionsAnyTrigger(all.email, termSets)) issues.push("email does not mention a specific trigger");
    if (!mentionsAnyTrigger(all.linkedin_dm, termSets)) issues.push("linkedin_dm does not mention a specific trigger");
  }
  for (const [k, v] of Object.entries(all)) {
    const bad = unsupportedNumbers(v, sourceFacts);
    if (bad.length) issues.push(`${k} uses figures not found in the source facts: ${bad.join(", ")} — remove them or use only given figures`);
  }
  return issues;
}

/** Hard-trim as a last resort so a draft can never exceed a channel limit. */
export function enforceLimits(d: DraftSet): DraftSet {
  const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…");
  return { ...d, linkedin_connect: clip(d.linkedin_connect, LIMITS.linkedinConnectChars), linkedin_dm: clip(d.linkedin_dm, LIMITS.linkedinDmChars) };
}

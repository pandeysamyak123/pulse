// Re-run the deterministic draft checks on stored drafts (no Gemini calls) and
// refresh quality_flags, so drafts written under older rules are visibly flagged.
import { config } from "dotenv";
config({ path: ".env.local" });
import { supabaseAdmin, must } from "../src/lib/supabase";
import { checkDrafts, triggerTerms, type DraftSet } from "../src/lib/pipeline/draft-checks";

(async () => {
  const db = supabaseAdmin();
  const drafts = must(await db.from("outreach_drafts").select("*").eq("status", "draft"), "drafts") as {
    id: string; account_id: string; channel: string; subject: string | null; body: string;
  }[];
  const byAcc = new Map<string, typeof drafts>();
  drafts.forEach((d) => byAcc.set(d.account_id, [...(byAcc.get(d.account_id) ?? []), d]));
  for (const [accId, ds] of byAcc) {
    const sigs = must(await db.from("signals").select("chip, summary, evidence_snippet").eq("account_id", accId).eq("is_cluster_lead", true).order("published_at", { ascending: false }).limit(3), "sigs") as { chip: string; summary: string; evidence_snippet: string }[];
    const arts = must(await db.from("articles").select("title, ai_one_liner").eq("account_id", accId), "arts") as { title: string; ai_one_liner: string }[];
    const acc = must(await db.from("accounts").select("company_name, arjun_notes, relationship_read, next_step").eq("id", accId).single(), "acc") as Record<string, string>;
    const notes = must(await db.from("notes").select("body").eq("account_id", accId), "notes") as { body: string }[];
    const acts = must(await db.from("activities").select("note, body_sent, subject").eq("account_id", accId), "acts") as Record<string, string>[];
    const prof = must(await db.from("product_profile").select("description").single(), "prof") as { description: string };
    const facts = [JSON.stringify(acc), ...sigs.map((s) => `${s.chip} ${s.summary} ${s.evidence_snippet}`), ...arts.map((a) => `${a.title} ${a.ai_one_liner}`), ...notes.map((n) => n.body), ...acts.map((a) => JSON.stringify(a)), prof.description].join("\n");
    const get = (ch: string) => ds.find((d) => d.channel === ch);
    const set: DraftSet = {
      email: { subject: get("email")?.subject ?? "", body: get("email")?.body ?? "" },
      linkedin_connect: get("linkedin_connect")?.body ?? "",
      linkedin_dm: get("linkedin_dm")?.body ?? "",
      followup: get("linkedin_followup")?.body ?? "",
    };
    const flags = checkDrafts(set, sigs.map((s) => triggerTerms(s.chip, s.summary)), false, facts);
    must(await db.from("outreach_drafts").update({ quality_flags: flags }).in("id", ds.map((d) => d.id)), "update flags");
    console.log(`${acc.company_name.padEnd(22)} ${flags.length ? "✗ " + flags.join(" | ") : "✓ passes"}`);
  }
})();

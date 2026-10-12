// npm run eval — runs the production classifier on hand-labelled real headlines
// and prints precision/recall for triggers, wrong-company accuracy and type accuracy.
// Classifier only (prefilter bypassed) so every item is judged by Gemini.
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync, writeFileSync } from "fs";
import { classifyAccount } from "../src/lib/pipeline/classify";
import { newUsage } from "../src/lib/gemini";
import { supabaseAdmin, must } from "../src/lib/supabase";
import type { AccountRow, RawItem } from "../src/lib/pipeline/types";

type Label = { company: string; title: string; about: boolean; trigger: boolean; type: string | null; review?: string };

async function main() {
  const { items } = JSON.parse(readFileSync("eval/labelled_headlines.json", "utf8")) as { items: Label[] };
  const accounts = must(await supabaseAdmin().from("accounts").select("*"), "accounts") as AccountRow[];
  const usage = newUsage();
  const rows: { label: Label; predAbout: boolean; predTrigger: boolean; predType: string }[] = [];

  const byCo = new Map<string, Label[]>();
  items.forEach((l) => byCo.set(l.company, [...(byCo.get(l.company) ?? []), l]));
  for (const [co, labels] of byCo) {
    const acc = accounts.find((a) => a.company_name === co);
    if (!acc) throw new Error(`No account ${co}`);
    const raw: RawItem[] = labels.map((l) => ({ title: l.title, url: `eval:${l.title}`, source_name: "eval", published_at: null, snippet: "", fetched_via: "google_news", query: "eval" }));
    const out = await classifyAccount(acc, raw, usage);
    if (!out) throw new Error(`classification failed for ${co}`);
    for (const l of labels) {
      const c = out.find((o) => o.item.title === l.title);
      rows.push({ label: l, predAbout: c?.is_about_this_company ?? false, predTrigger: c?.is_trigger ?? false, predType: c?.signal_type ?? "none" });
    }
    console.log(`  classified ${co} (${labels.length})`);
  }

  const tp = rows.filter((r) => r.label.trigger && r.predTrigger).length;
  const fp = rows.filter((r) => !r.label.trigger && r.predTrigger).length;
  const fn = rows.filter((r) => r.label.trigger && !r.predTrigger).length;
  const tn = rows.filter((r) => !r.label.trigger && !r.predTrigger).length;
  const precision = tp / Math.max(1, tp + fp);
  const recall = tp / Math.max(1, tp + fn);
  const wrong = rows.filter((r) => !r.label.about);
  const wrongOk = wrong.filter((r) => !r.predAbout && !r.predTrigger).length;
  const typeOk = rows.filter((r) => r.label.trigger && r.predTrigger && r.predType === r.label.type).length;

  console.log(`\nItems ${rows.length} · Gemini calls ${usage.calls}`);
  console.log(`Trigger precision ${(precision * 100).toFixed(0)}% · recall ${(recall * 100).toFixed(0)}%  (TP ${tp} · FP ${fp} · FN ${fn} · TN ${tn})`);
  console.log(`Wrong-company rejected ${wrongOk}/${wrong.length}`);
  console.log(`Signal type correct ${typeOk}/${tp} true positives`);
  const misses = rows.filter((r) => r.label.trigger !== r.predTrigger || r.label.about !== r.predAbout);
  if (misses.length) {
    console.log("\nDisagreements:");
    misses.forEach((m) =>
      console.log(`  ${m.label.trigger ? "FN" : m.predTrigger ? "FP" : "about"} · ${m.label.company} · ${m.label.title.slice(0, 90)}${m.label.review ? `  [borderline: ${m.label.review}]` : ""}`),
    );
  }
  writeFileSync(
    "eval/results.json",
    JSON.stringify({ ran_at: new Date().toISOString(), precision, recall, tp, fp, fn, tn, wrong_company: `${wrongOk}/${wrong.length}`, type_correct: `${typeOk}/${tp}`, rows }, null, 2),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

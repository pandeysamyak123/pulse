// npm run seed — resets Pulse demo data and loads 10 accounts with contacts,
// activities and notes. Every Arjun-owned row is written through Arjun's RPCs
// (create_account / upsert_contact / log_activity / add_note), exactly as the UI does.
import { config } from "dotenv";
config({ path: ".env.local" });

import { supabaseAdmin, must } from "../src/lib/supabase";
import { ACCOUNTS, PRODUCT_PROFILE } from "./seed-data";

const db = supabaseAdmin();
const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();
const dateIn = (n: number) => new Date(Date.now() + n * DAY).toISOString().slice(0, 10);

function demoEmail(slug: string) {
  const base = process.env.DEMO_CONTACT_EMAIL;
  if (!base) throw new Error("DEMO_CONTACT_EMAIL is required for seeding");
  const [user, domain] = base.split("@");
  return `${user}+${slug}@${domain}`;
}

function linkedinPlaceholder(name: string, company: string) {
  // Placeholder Arjun can edit: a LinkedIn people search for the fictional contact's role.
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${name} ${company}`)}`;
}

async function main() {
  console.log("Resetting demo data…");
  must(await db.rpc("reset_demo_data"), "reset");

  must(await db.from("product_profile").upsert({ id: 1, ...PRODUCT_PROFILE }), "product_profile");

  for (const a of ACCOUNTS) {
    const accountId = must(
      await db.rpc("create_account", {
        p: {
          company_name: a.company_name,
          domain: a.domain,
          industry: a.industry,
          hq_city: a.hq_city,
          employee_band: a.employee_band,
          stage: a.stage,
          search_aliases: a.search_aliases,
          exclude_terms: a.exclude_terms,
          arjun_notes: a.arjun_notes,
          relationship_read: a.relationship_read,
          next_step: a.next_step ?? null,
          next_step_due: a.next_step_due_in_days != null ? dateIn(a.next_step_due_in_days) : null,
          do_not_contact_until: a.do_not_contact_until ?? null,
        },
      }),
      `create ${a.company_name}`,
    ) as string;

    const contactIds: Record<string, string> = {};
    for (const c of a.contacts) {
      contactIds[c.key] = must(
        await db.rpc("upsert_contact", {
          p: {
            account_id: accountId,
            full_name: c.full_name,
            title: c.title,
            email: demoEmail(c.key),
            linkedin_url: linkedinPlaceholder(c.full_name, a.company_name),
            is_primary: !!c.is_primary,
            notes: c.notes ?? null,
          },
        }),
        `contact ${c.full_name}`,
      ) as string;
    }

    for (const act of [...a.activities].sort((x, y) => y.days_ago - x.days_ago)) {
      must(
        await db.rpc("log_activity", {
          p: {
            account_id: accountId,
            contact_id: act.contact ? contactIds[act.contact] : null,
            channel: act.channel,
            direction: act.direction ?? "outbound",
            subject: act.subject ?? null,
            body_sent: act.body_sent ?? null,
            outcome: act.outcome ?? null,
            note: act.note ?? null,
            occurred_at: daysAgo(act.days_ago),
            created_via: "manual",
          },
        }),
        `activity ${a.company_name}`,
      );
    }

    for (const n of a.notes) {
      must(
        await db.rpc("add_note", {
          p_account_id: accountId,
          p_body: n.body,
          p_pinned: !!n.pinned,
          p_created_at: daysAgo(n.days_ago),
        }),
        `note ${a.company_name}`,
      );
    }
    console.log(`  ✓ ${a.company_name.padEnd(24)} ${a.stage.padEnd(9)} ${a.contacts.length} contacts · ${a.activities.length} activities · ${a.notes.length} notes`);
  }

  const hash = must(await db.rpc("arjun_data_hash"), "hash");
  console.log(`\nSeeded ${ACCOUNTS.length} accounts. arjun_data_hash = ${hash}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

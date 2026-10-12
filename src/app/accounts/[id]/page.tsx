import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAccount } from "@/lib/queries";
import { readiness } from "@/lib/readiness";
import { isAuthed } from "@/lib/auth";
import { AccountWorkspace } from "@/components/account/workspace";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const data = await getAccount((await params).id);
  return { title: data?.account.company_name ?? "Account" };
}

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; log?: string }>;
}) {
  const [{ id }, sp, authed] = await Promise.all([params, searchParams, isAuthed()]);
  const data = await getAccount(id);
  if (!data) notFound();
  return (
    <AccountWorkspace
      {...data}
      account={{ ...data.account, warmth_score: Number(data.account.warmth_score) }}
      readiness={readiness(data.account, data.activities)}
      initialTab={sp.tab ?? "overview"}
      initialLog={sp.log ?? null}
      authed={authed}
      safeMode={process.env.SAFE_MODE !== "false"}
      demoInbox={process.env.DEMO_CONTACT_EMAIL ?? ""}
    />
  );
}

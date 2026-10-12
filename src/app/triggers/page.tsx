import type { Metadata } from "next";
import { getTriggers } from "@/lib/queries";
import { TriggersFeed } from "@/components/triggers";

export const metadata: Metadata = { title: "Triggers" };
export const dynamic = "force-dynamic";

export default async function TriggersPage() {
  const { signals, accounts } = await getTriggers();
  return <TriggersFeed signals={signals} accounts={accounts} />;
}

import type { Metadata } from "next";
import { getRuns } from "@/lib/queries";
import { RunsView } from "@/components/runs";

export const metadata: Metadata = { title: "Scan runs" };
export const dynamic = "force-dynamic";

export default async function RunsPage() {
  return <RunsView runs={await getRuns()} />;
}

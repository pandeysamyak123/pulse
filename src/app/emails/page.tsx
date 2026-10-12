import type { Metadata } from "next";
import { getEmails } from "@/lib/queries";
import { EmailsView } from "@/components/emails";

export const metadata: Metadata = { title: "Hot List emails" };
export const dynamic = "force-dynamic";

export default async function EmailsPage() {
  return <EmailsView emails={await getEmails()} />;
}

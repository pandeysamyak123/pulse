"use client";

import { CheckCircle2, Mail, XCircle } from "lucide-react";
import { useState } from "react";
import { cn, fmtDateTime } from "@/lib/format";
import type { EmailRun } from "@/lib/types";
import { EmptyState, OwnerTag } from "./ui";

export function EmailsView({ emails }: { emails: EmailRun[] }) {
  const [sel, setSel] = useState<string | null>(emails[0]?.id ?? null);
  const cur = emails.find((e) => e.id === sel);
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Mail className="h-5 w-5 text-accent-text" /> Hot List emails
        </h1>
        <span className="flex items-center gap-2 text-xs text-muted">
          Mon &amp; Thu · 08:00 IST <OwnerTag owner="pulse" />
        </span>
      </div>
      {emails.length === 0 ? (
        <EmptyState icon={<Mail className="h-6 w-6" />} title="No Hot List sent yet. Use the send button in the top bar to send a preview to yourself." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
          <ul className="space-y-1.5">
            {emails.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => setSel(e.id)}
                  aria-pressed={sel === e.id}
                  className={cn("card w-full p-3 text-left transition-colors", sel === e.id ? "border-accent" : "hover:border-line-strong")}
                >
                  <span className="flex items-center gap-2 text-xs text-faint">
                    {e.status === "sent" ? <CheckCircle2 className="h-3.5 w-3.5 text-ok" /> : <XCircle className="h-3.5 w-3.5 text-bad" />}
                    {fmtDateTime(e.sent_at)} · {e.kind}
                  </span>
                  <span className="mt-1 block truncate text-sm font-medium">{e.subject ?? "(no subject)"}</span>
                  <span className="block truncate text-xs text-faint">to {e.recipient}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="card overflow-hidden">
            {cur?.html ? (
              <iframe title="Hot List email" srcDoc={cur.html} sandbox="" className="h-[75vh] w-full bg-white" />
            ) : (
              <p className="p-6 text-sm text-muted">{cur?.error ?? "No content stored."}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

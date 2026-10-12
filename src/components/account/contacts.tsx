"use client";

import { Loader2, Mail, Pencil, Plus, Star, UserRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { upsertContact } from "@/app/actions";
import { cn } from "@/lib/format";
import type { Account, Contact } from "@/lib/types";
import { Button, Linkedin, OwnerTag, Tip } from "../ui";

type Form = { id?: string; full_name: string; title: string; email: string; linkedin_url: string; is_primary: boolean; notes: string };
const blank: Form = { full_name: "", title: "", email: "", linkedin_url: "", is_primary: false, notes: "" };

export function ContactsTab({ account, contacts, authed }: { account: Account; contacts: Contact[]; authed: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!form) return;
    setBusy(true);
    const r = await upsertContact({
      id: form.id,
      account_id: account.id,
      full_name: form.full_name,
      title: form.title || null,
      email: form.email || null,
      linkedin_url: form.linkedin_url || null,
      is_primary: form.is_primary,
      notes: form.notes || null,
    });
    setBusy(false);
    if (r.ok) {
      toast.success(form.id ? "Contact updated" : "Contact added");
      setForm(null);
      router.refresh();
    } else toast.error(r.error);
  };

  const input = "h-10 w-full rounded-xl border border-line-strong bg-surface-2 px-3 text-sm outline-none focus:border-accent";

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold">
          {contacts.length} contacts <OwnerTag owner="you" />
        </span>
        <Tip label={authed ? "Add contact" : "Unlock to add"}>
          <Button variant="primary" size="sm" onClick={() => setForm({ ...blank })} disabled={!authed}>
            <Plus className="h-3.5 w-3.5" /> Add contact
          </Button>
        </Tip>
      </div>

      {form && (
        <div className="card space-y-3 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{form.id ? "Edit contact" : "New contact"}</span>
            <button onClick={() => setForm(null)} aria-label="Close" className="text-faint hover:text-text">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label>
              <span className="label">Name *</span>
              <input className={input} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </label>
            <label>
              <span className="label">Title</span>
              <input className={input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <label>
              <span className="label">Email</span>
              <input type="email" className={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label>
              <span className="label">LinkedIn URL</span>
              <input className={input} value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} />
            </label>
            <label className="sm:col-span-2">
              <span className="label">Notes</span>
              <input className={input} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={form.is_primary} onChange={(e) => setForm({ ...form, is_primary: e.target.checked })} className="accent-[var(--accent)]" />
              Primary contact
            </label>
            <Button variant="primary" size="sm" onClick={save} disabled={busy || !form.full_name.trim()}>
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {contacts.map((c) => (
          <div key={c.id} className={cn("card flex items-start gap-3 p-4", account.recommended_contact_id === c.id && "ring-1 ring-[color-mix(in_oklab,var(--warm)_50%,transparent)]")}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-3 text-muted">
              <UserRound className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 font-medium">
                <span className="truncate">{c.full_name}</span>
                {c.is_primary && <span className="rounded bg-surface-3 px-1 text-[10px] uppercase text-muted">primary</span>}
                {account.recommended_contact_id === c.id && (
                  <Tip label={`Pulse recommends: ${account.recommended_contact_reason ?? ""}`}>
                    <Star className="h-3.5 w-3.5 fill-warm text-warm" />
                  </Tip>
                )}
              </p>
              <p className="truncate text-sm text-muted">{c.title}</p>
              {c.notes && <p className="mt-1 text-xs text-faint">{c.notes}</p>}
              <div className="mt-2 flex gap-3 text-xs">
                {c.email && (
                  <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 text-muted hover:text-text">
                    <Mail className="h-3.5 w-3.5" /> <span className="truncate">{c.email}</span>
                  </a>
                )}
                {c.linkedin_url && (
                  <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted hover:text-text">
                    <Linkedin className="h-3.5 w-3.5" /> Profile
                  </a>
                )}
              </div>
            </div>
            {authed && (
              <Tip label="Edit">
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Edit ${c.full_name}`}
                  onClick={() =>
                    setForm({
                      id: c.id,
                      full_name: c.full_name,
                      title: c.title ?? "",
                      email: c.email ?? "",
                      linkedin_url: c.linkedin_url ?? "",
                      is_primary: c.is_primary,
                      notes: c.notes ?? "",
                    })
                  }
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </Tip>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

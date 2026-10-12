"use client";

import { Command } from "cmdk";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity as ActivityIcon,
  Building2,
  CheckCircle2,
  Flame,
  Lock,
  LogOut,
  Mail,
  Moon,
  Radar,
  Search,
  Send,
  ShieldCheck,
  ShieldAlert,
  Sun,
  Unlock,
  Workflow,
  Zap,
  Loader2,
  X,
  Phone,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { login, logout } from "@/app/actions";
import { ago, cn, fmtDateTime, TIER_META } from "@/lib/format";
import type { ScanRun, Tier } from "@/lib/types";
import { Button, Kbd, Logo, Tip } from "./ui";

type ShellAccount = { id: string; company_name: string; domain: string | null; warmth_tier: Tier; warmth_score: number; stage: string };

/* ───────── App context: auth + palette + scan ───────── */
const AppCtx = createContext<{
  authed: boolean;
  openLogin: () => void;
  openPalette: () => void;
  runScan: () => void;
  scanning: boolean;
}>({ authed: false, openLogin: () => {}, openPalette: () => {}, runScan: () => {}, scanning: false });
export const useApp = () => useContext(AppCtx);

const NAV = [
  { href: "/", label: "Today", icon: Radar, key: "1" },
  { href: "/triggers", label: "Triggers", icon: Zap, key: "2" },
  { href: "/accounts", label: "Accounts", icon: Building2, key: "3" },
  { href: "/runs", label: "Runs", icon: ActivityIcon, key: "4" },
  { href: "/emails", label: "Hot List emails", icon: Mail, key: "5" },
  { href: "/how-it-works", label: "How it works", icon: Workflow, key: "6" },
];

export function AppShell({
  children,
  authed,
  accounts,
  lastRun,
  safeMode,
}: {
  children: ReactNode;
  authed: boolean;
  accounts: ShellAccount[];
  lastRun: ScanRun | null;
  safeMode: boolean;
}) {
  const [palette, setPalette] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const scan = useScan();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const runScan = useCallback(() => {
    if (!authed) {
      toast("Read-only demo", { description: "Unlock with the passcode to run a live scan." });
      setLoginOpen(true);
      return;
    }
    scan.start();
  }, [authed, scan]);

  return (
    <AppCtx.Provider value={{ authed, openLogin: () => setLoginOpen(true), openPalette: () => setPalette(true), runScan, scanning: scan.running }}>
      <div className="flex min-h-dvh">
        <Rail />
        <div className="flex min-w-0 flex-1 flex-col md:pl-16">
          <TopBar lastRun={lastRun} safeMode={safeMode} />
          <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-24 pt-4 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
      <MobileNav />
      <CommandPalette open={palette} onClose={() => setPalette(false)} accounts={accounts} />
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
      <ScanPanel scan={scan} />
    </AppCtx.Provider>
  );
}

/* ───────── Left rail (icons only, expands on hover) ───────── */
function Rail() {
  const path = usePathname();
  return (
    <nav
      aria-label="Main"
      className="group/rail fixed inset-y-0 left-0 z-40 hidden w-16 flex-col border-r border-line bg-bg/95 py-4 backdrop-blur transition-[width] duration-200 hover:w-56 md:flex"
    >
      <Link href="/" className="mb-6 flex items-center gap-3 px-[18px]" aria-label="Pulse home">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent shadow-[0_0_18px_-2px_var(--accent)]">
          <PulseMark />
        </span>
        <span className="whitespace-nowrap text-sm font-semibold tracking-tight opacity-0 transition-opacity group-hover/rail:opacity-100">
          Pulse
        </span>
      </Link>
      <ul className="flex flex-1 flex-col gap-1 px-2.5">
        {NAV.map((n) => {
          const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
          return (
            <li key={n.href}>
              <Link
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-10 items-center gap-3 rounded-xl px-[11px] text-sm transition-colors",
                  active ? "bg-surface-2 text-text" : "text-muted hover:bg-surface-2 hover:text-text",
                )}
              >
                {active && <motion.span layoutId="rail-active" className="absolute left-0 top-2 h-6 w-[3px] rounded-r bg-accent" />}
                <n.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                <span className="whitespace-nowrap opacity-0 transition-opacity group-hover/rail:opacity-100">{n.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function MobileNav() {
  const path = usePathname();
  return (
    <nav aria-label="Main mobile" className="glass fixed inset-x-3 bottom-3 z-40 flex justify-around rounded-2xl py-1.5 md:hidden">
      {NAV.slice(0, 5).map((n) => {
        const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href} aria-label={n.label} className={cn("grid h-10 w-12 place-items-center rounded-xl", active ? "bg-surface-3 text-text" : "text-muted")}>
            <n.icon className="h-5 w-5" strokeWidth={1.75} />
          </Link>
        );
      })}
    </nav>
  );
}

export function PulseMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("h-4 w-4", className)} fill="none" stroke="white" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12h4l3-7 4 14 3-7h6" />
    </svg>
  );
}

/* ───────── Top bar ───────── */
function TopBar({ lastRun, safeMode }: { lastRun: ScanRun | null; safeMode: boolean }) {
  const { authed, openLogin, openPalette, runScan, scanning } = useApp();
  const router = useRouter();
  return (
    <>
      {!authed && (
        <div className="flex items-center justify-center gap-2 border-b border-line bg-accent-soft px-4 py-1.5 text-xs text-accent-text">
          <Lock className="h-3 w-3" /> Read-only demo — sending and editing are disabled.
          <button onClick={openLogin} className="font-semibold underline underline-offset-2">
            Unlock
          </button>
        </div>
      )}
      {authed && safeMode && (
        <div className="flex items-center justify-center gap-2 border-b border-line bg-surface-2 px-4 py-1.5 text-xs text-muted">
          <ShieldCheck className="h-3 w-3 text-ok" /> SAFE MODE — all outreach email is redirected to your demo inbox.
        </div>
      )}
      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-2 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="mr-1 flex items-center gap-2 md:hidden" aria-label="Pulse home">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent">
              <PulseMark />
            </span>
          </Link>
          <button
            onClick={openPalette}
            className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm text-faint transition-colors hover:border-line-strong sm:max-w-sm"
            aria-label="Open command palette"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="truncate">Jump to account or action…</span>
            <span className="ml-auto hidden items-center gap-1 sm:flex">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
          <div className="ml-auto flex items-center gap-1.5">
            <IntegrityShield run={lastRun} />
            <Tip label={lastRun ? `Last scan ${fmtDateTime(lastRun.finished_at ?? lastRun.started_at)}` : "No scans yet"} side="bottom">
              <Button variant="primary" size="sm" onClick={runScan} disabled={scanning} aria-label="Run scan now">
                {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radar className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{scanning ? "Scanning…" : "Run scan"}</span>
              </Button>
            </Tip>
            <HotlistPreviewButton />
            <ThemeToggle />
            {authed ? (
              <Tip label="Lock (switch to read-only demo)" side="bottom">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Lock"
                  onClick={async () => {
                    await logout();
                    router.refresh();
                  }}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </Tip>
            ) : (
              <Tip label="Unlock with passcode" side="bottom">
                <Button variant="ghost" size="sm" aria-label="Unlock" onClick={openLogin}>
                  <Unlock className="h-4 w-4" />
                </Button>
              </Tip>
            )}
          </div>
        </div>
      </header>
    </>
  );
}

function HotlistPreviewButton() {
  const { authed, openLogin } = useApp();
  const [busy, setBusy] = useState(false);
  return (
    <Tip label="Send Hot List preview to me" side="bottom">
      <Button
        variant="outline"
        size="sm"
        aria-label="Send Hot List preview to me"
        disabled={busy}
        onClick={async () => {
          if (!authed) return openLogin();
          setBusy(true);
          const t = toast.loading("Building Hot List…");
          try {
            const res = await fetch("/api/hotlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preview: true }) });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error ?? "Failed");
            toast.success("Hot List sent", { id: t, description: j.subject });
          } catch (e) {
            toast.error("Hot List failed", { id: t, description: (e as Error).message });
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
      </Button>
    </Tip>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("pulse-theme", next);
    } catch {}
  };
  return (
    <Tip label={theme === "dark" ? "Light mode" : "Dark mode"} side="bottom">
      <Button variant="ghost" size="sm" onClick={toggle} aria-label="Toggle theme">
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
    </Tip>
  );
}

/* ───────── Integrity shield ───────── */
function IntegrityShield({ run }: { run: ScanRun | null }) {
  const ok = run?.integrity_ok;
  const Icon = ok === false ? ShieldAlert : ShieldCheck;
  return (
    <Tip
      side="bottom"
      label={
        run ? (
          <span className="block w-60 space-y-1">
            <span className="block font-semibold">{ok ? "✍️ Your data untouched ✓" : "Integrity check failed"}</span>
            <span className="block text-muted">Hash of all your notes, contacts, history and fields — identical before and after the last scan.</span>
            <span className="num block text-[11px] text-faint">
              {run.arjun_hash_before?.slice(0, 10)}… → {run.arjun_hash_after?.slice(0, 10)}…
            </span>
            <span className="block text-[11px] text-faint">Checked {fmtDateTime(run.finished_at)}</span>
          </span>
        ) : (
          "No scan yet"
        )
      }
    >
      <Link
        href="/runs"
        aria-label={ok ? "Your data untouched" : "Integrity status"}
        className={cn(
          "grid h-8 w-8 place-items-center rounded-xl transition-shadow",
          ok ? "text-ok hover:shadow-[0_0_16px_-2px_var(--ok)]" : ok === false ? "text-bad" : "text-faint",
        )}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
      </Link>
    </Tip>
  );
}

/* ───────── Command palette ───────── */
function CommandPalette({ open, onClose, accounts }: { open: boolean; onClose: () => void; accounts: ShellAccount[] }) {
  const router = useRouter();
  const { runScan } = useApp();
  const go = (href: string) => {
    onClose();
    router.push(href);
  };
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--overlay)] px-4 pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 12, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="glass w-full max-w-xl overflow-hidden rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Command label="Command palette" loop>
              <div className="flex items-center gap-2 border-b border-line px-4">
                <Search className="h-4 w-4 text-faint" />
                <Command.Input autoFocus placeholder="Search accounts, actions…" className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-faint" />
                <Kbd>esc</Kbd>
              </div>
              <Command.List className="max-h-[50vh] overflow-y-auto p-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-faint">
                <Command.Empty className="px-3 py-6 text-center text-sm text-muted">No matches.</Command.Empty>
                <Command.Group heading="Actions">
                  <PItem onSelect={() => (onClose(), runScan())} icon={<Radar className="h-4 w-4" />}>Run scan now</PItem>
                  <PItem onSelect={() => go("/?tier=hot")} icon={<Flame className="h-4 w-4 text-hot" />}>Show hot accounts</PItem>
                  <PItem onSelect={() => go("/?filter=followup")} icon={<CheckCircle2 className="h-4 w-4" />}>Show follow-ups due</PItem>
                  <PItem onSelect={() => go("/triggers")} icon={<Zap className="h-4 w-4" />}>All triggers (14 days)</PItem>
                  <PItem onSelect={() => go("/runs")} icon={<ActivityIcon className="h-4 w-4" />}>Scan runs & integrity</PItem>
                </Command.Group>
                <Command.Group heading="Accounts">
                  {accounts.map((a) => (
                    <PItem key={a.id} value={`open ${a.company_name}`} onSelect={() => go(`/accounts/${a.id}`)} icon={<Logo name={a.company_name} domain={a.domain} size={22} />}>
                      <span className="flex-1">{a.company_name}</span>
                      <span className={cn("num text-xs", TIER_META[a.warmth_tier].cls)}>{Number(a.warmth_score).toFixed(0)}</span>
                    </PItem>
                  ))}
                </Command.Group>
                <Command.Group heading="Draft outreach">
                  {accounts.map((a) => (
                    <PItem key={a.id} value={`draft for ${a.company_name}`} onSelect={() => go(`/accounts/${a.id}?tab=outreach`)} icon={<Send className="h-4 w-4" />}>
                      Draft for {a.company_name}
                    </PItem>
                  ))}
                </Command.Group>
                <Command.Group heading="Log activity">
                  {accounts.map((a) => (
                    <PItem key={a.id} value={`log call ${a.company_name}`} onSelect={() => go(`/accounts/${a.id}?tab=history&log=call`)} icon={<Phone className="h-4 w-4" />}>
                      Log call · {a.company_name}
                    </PItem>
                  ))}
                </Command.Group>
              </Command.List>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PItem({ children, icon, onSelect, value }: { children: ReactNode; icon?: ReactNode; onSelect: () => void; value?: string }) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted data-[selected=true]:bg-surface-3 data-[selected=true]:text-text"
    >
      <span className="grid w-5 place-items-center text-faint">{icon}</span>
      {children}
    </Command.Item>
  );
}

/* ───────── Login ───────── */
function LoginDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center bg-[var(--overlay)] px-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.form
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 6, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const r = await login(code);
              setBusy(false);
              if (r.ok) {
                toast.success("Unlocked");
                setCode("");
                onClose();
                router.refresh();
              } else toast.error(r.error);
            }}
            className="glass w-full max-w-sm rounded-2xl p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2 font-semibold">
                <Lock className="h-4 w-4 text-accent-text" /> Unlock Pulse
              </span>
              <button type="button" onClick={onClose} aria-label="Close" className="text-faint hover:text-text">
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="label mb-1.5 block" htmlFor="passcode">
              Passcode
            </label>
            <input
              id="passcode"
              type="password"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="h-11 w-full rounded-xl border border-line-strong bg-surface-2 px-3 text-sm outline-none focus:border-accent"
            />
            <Button type="submit" variant="primary" className="mt-4 w-full" disabled={busy || !code}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock"}
            </Button>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ───────── Live scan experience ───────── */
type ScanState = {
  running: boolean;
  open: boolean;
  stage: number; // 0..5
  counts: { accounts: number; fetched: number; filtered: number; signals: number; drafts: number; total: number };
  current: string;
  start: () => void;
  close: () => void;
};

const STAGES = ["Fetching", "Filtering", "AI reading", "Scoring", "Drafting"];
const STAGE_INDEX: Record<string, number> = { fetching: 0, filtering: 1, reading: 2, scoring: 3, drafting: 4 };

function useScan(): ScanState {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState(0);
  const [current, setCurrent] = useState("");
  const [counts, setCounts] = useState({ accounts: 0, fetched: 0, filtered: 0, signals: 0, drafts: 0, total: 0 });
  const busy = useRef(false);

  const start = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRunning(true);
    setOpen(true);
    setStage(0);
    setCurrent("Starting…");
    setCounts({ accounts: 0, fetched: 0, filtered: 0, signals: 0, drafts: 0, total: 0 });
    const turnedHot: string[] = [];
    let newSignals = 0;
    const errors: string[] = [];
    try {
      const s = await fetch("/api/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start" }) });
      const { runId, batches, error } = await s.json();
      if (!runId) throw new Error(error ?? "Could not start scan");
      setCounts((c) => ({ ...c, total: batches.flat().length }));
      for (const ids of batches as string[][]) {
        const res = await fetch("/api/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "batch", runId, ids }) });
        const reader = res.body!.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const e = JSON.parse(line);
            if (e.stage in STAGE_INDEX) {
              setStage((st) => Math.max(st, STAGE_INDEX[e.stage]));
              setCurrent(`${e.company}`);
            } else if (e.stage === "done") {
              const r = e.result;
              newSignals += r.new_signals;
              if (r.tier === "hot" && r.prev_tier !== "hot") turnedHot.push(r.company);
              setCounts((c) => ({
                ...c,
                accounts: c.accounts + 1,
                fetched: c.fetched + r.fetched,
                filtered: c.filtered + r.prefiltered,
                signals: c.signals + r.new_signals,
                drafts: c.drafts + r.drafts,
              }));
            } else if (e.stage === "batch_done") {
              errors.push(...(e.errors ?? []).filter((x: { company: string }) => x.company !== "*").map((x: { company: string; error: string }) => x.company));
            } else if (e.stage === "error") errors.push(e.error);
          }
        }
      }
      const fin = await fetch("/api/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "finish", runId }) }).then((r) => r.json());
      setStage(5);
      setCurrent(fin.integrity_ok ? "Your data untouched ✓" : "Integrity check failed");
      toast.success(`${newSignals} new trigger${newSignals === 1 ? "" : "s"} · ${turnedHot.length} account${turnedHot.length === 1 ? "" : "s"} turned hot`, {
        description: [turnedHot.join(", "), errors.length ? `${errors.length} account(s) skipped — see Runs` : ""].filter(Boolean).join(" · ") || undefined,
      });
      router.refresh();
    } catch (e) {
      toast.error("Scan failed", { description: (e as Error).message });
    } finally {
      busy.current = false;
      setRunning(false);
    }
  }, [router]);

  return { running, open, stage, counts, current, start, close: () => setOpen(false) };
}

function ScanPanel({ scan }: { scan: ScanState }) {
  const values = [scan.counts.fetched, scan.counts.filtered, scan.counts.filtered, scan.counts.signals, scan.counts.drafts];
  const sub = ["articles", "kept", "read", "triggers", "drafts"];
  return (
    <AnimatePresence>
      {scan.open && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          className="glass fixed bottom-20 right-4 z-50 w-[min(420px,calc(100vw-2rem))] rounded-2xl p-4 shadow-2xl md:bottom-4"
          role="status"
          aria-live="polite"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-semibold">
              {scan.running ? <Loader2 className="h-4 w-4 animate-spin text-accent-text" /> : <CheckCircle2 className="h-4 w-4 text-ok" />}
              {scan.running ? "Live scan" : "Scan complete"}
            </span>
            <span className="num text-xs text-muted">
              {scan.counts.accounts}/{scan.counts.total || "…"} accounts
            </span>
            {!scan.running && (
              <button onClick={scan.close} aria-label="Close" className="text-faint hover:text-text">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {STAGES.map((s, i) => {
              const active = scan.running && scan.stage === i;
              const done = scan.stage > i;
              return (
                <div key={s} className="min-w-0">
                  <div className="mb-1.5 h-1 overflow-hidden rounded-full bg-surface-3">
                    <div className={cn("h-full rounded-full transition-all", active ? "flow-bar w-full" : done ? "w-full bg-accent" : "w-0")} />
                  </div>
                  <div className={cn("truncate text-[10px] font-medium uppercase tracking-wide", done || active ? "text-text" : "text-faint")}>{s}</div>
                  <div className="num text-base font-semibold">{values[i]}</div>
                  <div className="text-[10px] text-faint">{sub[i]}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 truncate text-xs text-muted">{scan.current}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function LastScan({ at }: { at: string | null }) {
  return <span className="num">{ago(at)}</span>;
}

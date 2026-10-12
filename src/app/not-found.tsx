import Link from "next/link";
import { Radar } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto mt-24 flex max-w-md flex-col items-center gap-4 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-accent-text">
        <Radar className="h-7 w-7" />
      </span>
      <h1 className="text-lg font-semibold">No signal here</h1>
      <p className="text-sm text-muted">That page or account doesn&apos;t exist.</p>
      <Link href="/" className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white">
        Back to Today
      </Link>
    </div>
  );
}

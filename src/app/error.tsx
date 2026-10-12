"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto mt-24 flex max-w-md flex-col items-center gap-4 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-warm">
        <TriangleAlert className="h-7 w-7" />
      </span>
      <h1 className="text-lg font-semibold">Something didn&apos;t load</h1>
      <p className="text-sm text-muted">{error.message || "An unexpected error occurred."} Your data is safe — nothing was changed.</p>
      <Button variant="primary" onClick={reset}>
        <RotateCcw className="h-4 w-4" /> Try again
      </Button>
    </div>
  );
}

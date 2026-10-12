"use client";

import { useEffect, useId, useState } from "react";

/** Renders a Mermaid diagram client-side, themed from the page's CSS tokens. */
export function Mermaid({ chart }: { chart: string }) {
  const id = useId().replace(/:/g, "");
  const [svg, setSvg] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const mermaid = (await import("mermaid")).default;
      const css = getComputedStyle(document.documentElement);
      const v = (n: string) => css.getPropertyValue(n).trim();
      const light = document.documentElement.dataset.theme === "light";
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui",
        flowchart: { curve: "basis", padding: 14, nodeSpacing: 28, rankSpacing: 46, htmlLabels: true },
        themeVariables: {
          darkMode: !light,
          background: v("--bg"),
          primaryColor: v("--surface-2"),
          primaryTextColor: v("--text"),
          primaryBorderColor: v("--line-strong"),
          lineColor: v("--faint"),
          secondaryColor: v("--surface"),
          tertiaryColor: v("--surface"),
          clusterBkg: v("--surface"),
          clusterBorder: v("--line-strong"),
          edgeLabelBackground: v("--bg"),
          fontSize: "13px",
        },
      });
      try {
        const { svg } = await mermaid.render(`m${id}`, chart);
        if (alive) setSvg(svg);
      } catch (e) {
        if (alive) setErr((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [chart, id]);

  if (err) return <pre className="overflow-x-auto rounded-xl bg-surface-2 p-4 text-xs text-bad">{err}</pre>;
  if (!svg) return <div className="skeleton h-[520px] w-full" aria-label="Loading diagram" />;
  return <div className="mmd overflow-x-auto [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />;
}

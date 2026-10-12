// Company logo proxy: fetches the favicon server-side and always answers 200 —
// the real icon, or a generated initials badge — so the browser never logs a 404.
// Cached at the edge for a week.
export const runtime = "nodejs";

const initialsSvg = (name: string) => {
  const ini = name
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("")
    .replace(/[^A-Z0-9]/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1d212b"/><text x="32" y="40" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#9097a7">${ini || "?"}</text></svg>`;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const domain = (url.searchParams.get("domain") ?? "").toLowerCase();
  const name = url.searchParams.get("name") ?? domain;
  const cache = { "Cache-Control": "public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400" };

  if (/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    try {
      const res = await fetch(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        // Google's generic globe is tiny (≤ ~1 KB at 16px): treat it as "no logo".
        if (buf.length > 1200) return new Response(buf, { headers: { "Content-Type": res.headers.get("content-type") ?? "image/png", ...cache } });
      }
    } catch {
      /* fall through to initials */
    }
  }
  return new Response(initialsSvg(name), { headers: { "Content-Type": "image/svg+xml", ...cache } });
}

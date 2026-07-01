/* Finds correct Commons file names for any artwork whose stored commonsFile
   does not resolve. For each miss, it searches the File namespace and prints
   real candidate filenames (each guaranteed to exist on Commons).
   Run:  npx tsx scripts/find_missing.ts   */
import { artworks } from "../lib/data/artworks";

const API = "https://commons.wikimedia.org/w/api.php";
const UA = "AntarangAudit/0.1 (https://github.com/gamersinghxx-creator/3dIndianmusem; educational)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clean = (f: string) => f.replace(/^File:/, "");

async function apiGet(params: URLSearchParams, attempt = 0): Promise<any> {
  const res = await fetch(`${API}?${params}`, { headers: { "User-Agent": UA } });
  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 5) throw new Error(`API ${res.status}`);
    const ra = Number(res.headers.get("retry-after"));
    await sleep(ra ? ra * 1000 : 1000 * 2 ** attempt);
    return apiGet(params, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function exists(file: string): Promise<boolean> {
  const p = new URLSearchParams({
    action: "query", format: "json", redirects: "1", prop: "imageinfo",
    iiprop: "url", titles: `File:${clean(file)}`,
  });
  const page: any = Object.values((await apiGet(p))?.query?.pages ?? {})[0];
  return !!page && page.missing === undefined;
}

async function search(q: string): Promise<string[]> {
  const p = new URLSearchParams({
    action: "query", format: "json", list: "search",
    srnamespace: "6", srlimit: "6", srsearch: q,
  });
  const hits = (await apiGet(p))?.query?.search ?? [];
  return hits.map((h: any) => h.title as string);
}

(async () => {
  for (const w of artworks) {
    if (await exists(w.commonsFile)) continue;
    console.log(`\n✗ ${w.id}  "${w.title}"`);
    console.log(`   stored: ${w.commonsFile}`);
    const q = w.title.replace(/\(.*?\)/g, "").replace(/[^\w\s-]/g, " ").trim();
    const cands = await search(q);
    if (!cands.length) {
      console.log("   (no candidates — try a manual search on commons.wikimedia.org)");
    } else {
      console.log("   candidates:");
      cands.forEach((c) => console.log(`     • ${c.replace(/^File:/, "")}`));
    }
    await sleep(400);
  }
  console.log("\nDone. Paste the ✗ blocks above back to Claude to lock in correct file names.");
})();

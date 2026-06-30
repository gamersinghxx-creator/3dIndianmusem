/* One-off E2E audit: referential integrity + live Commons image resolution.
   Batched + rate-limit-aware, so it returns a definitive ✓/✗ per file. */
import { periods } from "../lib/data/periods";
import { artists } from "../lib/data/artists";
import { artworks } from "../lib/data/artworks";

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const UA = "AntarangAudit/0.1 (https://github.com/gamersinghxx-creator/3dIndianmusem; educational)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clean = (f: string) => f.replace(/^File:/, "");

async function apiGet(params: URLSearchParams, attempt = 0): Promise<any> {
  const res = await fetch(`${COMMONS_API}?${params}`, { headers: { "User-Agent": UA } });
  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 5) throw new Error(`Commons API ${res.status} after retries`);
    const ra = Number(res.headers.get("retry-after"));
    await sleep(ra ? ra * 1000 : 1000 * 2 ** attempt);
    return apiGet(params, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function resolveAll(files: string[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const uniq = [...new Set(files)];
  for (let i = 0; i < uniq.length; i += 40) {
    const chunk = uniq.slice(i, i + 40);
    const params = new URLSearchParams({
      action: "query", format: "json", redirects: "1",
      prop: "imageinfo", iiprop: "url",
      titles: chunk.map((f) => `File:${clean(f)}`).join("|"),
    });
    const q = (await apiGet(params))?.query ?? {};
    const normalized = new Map<string, string>((q.normalized ?? []).map((n: any) => [n.from, n.to]));
    const redirects = new Map<string, string>((q.redirects ?? []).map((r: any) => [r.from, r.to]));
    const byTitle = new Map<string, any>(Object.values(q.pages ?? {}).map((p: any) => [p.title, p]));
    const resolveTitle = (req: string) => redirects.get(normalized.get(req) ?? req) ?? normalized.get(req) ?? req;
    for (const f of chunk) {
      const page = byTitle.get(resolveTitle(`File:${clean(f)}`));
      out.set(f, page && page.missing === undefined ? page.imageinfo?.[0]?.url ?? null : null);
    }
    await sleep(500);
  }
  return out;
}

(async () => {
  const periodIds = new Set(periods.map((p) => p.id));
  const artistIds = new Set(artists.map((a) => a.id));
  const problems: string[] = [];
  artists.forEach((a) => { if (!periodIds.has(a.periodId)) problems.push(`artist ${a.id} → missing period ${a.periodId}`); });
  artworks.forEach((w) => {
    if (!artistIds.has(w.artistId)) problems.push(`artwork ${w.id} → missing artist ${w.artistId}`);
    if (!periodIds.has(w.periodId)) problems.push(`artwork ${w.id} → missing period ${w.periodId}`);
  });
  console.log("=== REFERENTIAL INTEGRITY ===");
  console.log(problems.length ? problems.map((p) => "  ✗ " + p).join("\n") : "  ✓ all references valid");

  const withWorks = artists.filter((a) => artworks.some((w) => w.artistId === a.id));
  console.log(`\n=== COVERAGE ===\n  periods ${periods.length} | artists ${artists.length} | artworks ${artworks.length} | walkable museums ${withWorks.length}`);

  console.log("\n=== LIVE COMMONS IMAGE RESOLUTION (batched) ===");
  const artMap = await resolveAll(artworks.map((w) => w.commonsFile));
  let bad = 0;
  for (const w of artworks) {
    if (!artMap.get(w.commonsFile)) { bad++; console.log(`  ✗ MISSING [${w.axis}] ${w.title}  ←  "${w.commonsFile}"`); }
  }
  console.log(`  artworks: ${artworks.length - bad}/${artworks.length} images resolve`);

  const portFiles = artists.filter((a) => a.portraitFile).map((a) => a.portraitFile as string);
  const portMap = await resolveAll(portFiles);
  let badP = 0;
  for (const a of artists) {
    if (a.portraitFile && !portMap.get(a.portraitFile)) { badP++; console.log(`  ✗ MISSING portrait ${a.name}  ←  "${a.portraitFile}"`); }
  }
  console.log(`  portraits: ${portFiles.length - badP}/${portFiles.length} resolve`);
  console.log(bad + badP === 0 ? "\n✓ ALL IMAGES RESOLVE" : `\n⚠ ${bad + badP} file name(s) need correction (listed above)`);
})();

/**
 * Seed + enrich script.
 *
 * Reads the bundled, hand-verified catalog (lib/data) and:
 *   1. resolves the canonical image URL, dimensions, licence and credit for every
 *      artwork + artist portrait directly from the Wikimedia Commons API,
 *   2. upserts everything into Neon Postgres via Drizzle.
 *
 * Requests are BATCHED (up to 40 titles per call) and retried with backoff so we
 * never trip Wikimedia's rate limiter. Uses ONLY the Commons API — no invented
 * data. Run with:  npm run db:seed   (needs DATABASE_URL in .env.local)
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../lib/db/schema";
import { periods } from "../lib/data/periods";
import { artists } from "../lib/data/artists";
import { artworks } from "../lib/data/artworks";

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const UA =
  "AntarangMuseum/0.1 (https://github.com/gamersinghxx-creator/3dIndianmusem; educational; Wikimedia data)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clean = (f: string) => f.replace(/^File:/, "");
const strip = (s?: string) => (s ? s.replace(/<[^>]+>/g, "").trim() : undefined);

export interface ImageInfo {
  url?: string;
  thumbUrl?: string;
  width?: number;
  height?: number;
  license?: string;
  credit?: string;
}

async function apiGet(params: URLSearchParams, attempt = 0): Promise<any> {
  const res = await fetch(`${COMMONS_API}?${params}`, { headers: { "User-Agent": UA } });
  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 5) throw new Error(`Commons API ${res.status} after retries`);
    const retryAfter = Number(res.headers.get("retry-after"));
    const wait = retryAfter ? retryAfter * 1000 : 1000 * 2 ** attempt;
    await sleep(wait);
    return apiGet(params, attempt + 1);
  }
  if (!res.ok) throw new Error(`Commons API HTTP ${res.status}`);
  return res.json();
}

/** Resolve many Commons files at once → Map keyed by the original file string. */
async function resolveAll(files: string[], thumbWidth = 1400): Promise<Map<string, ImageInfo>> {
  const out = new Map<string, ImageInfo>();
  const uniq = [...new Set(files)];
  for (let i = 0; i < uniq.length; i += 40) {
    const chunk = uniq.slice(i, i + 40);
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      redirects: "1",
      prop: "imageinfo",
      iiprop: "url|size|extmetadata",
      iiurlwidth: String(thumbWidth),
      titles: chunk.map((f) => `File:${clean(f)}`).join("|"),
    });
    const data = await apiGet(params);
    const q = data?.query ?? {};
    const normalized = new Map<string, string>((q.normalized ?? []).map((n: any) => [n.from, n.to]));
    const redirects = new Map<string, string>((q.redirects ?? []).map((r: any) => [r.from, r.to]));
    const byTitle = new Map<string, any>(Object.values(q.pages ?? {}).map((p: any) => [p.title, p]));
    const resolveTitle = (req: string) => {
      let t = normalized.get(req) ?? req;
      t = redirects.get(t) ?? t;
      return t;
    };
    for (const f of chunk) {
      const page = byTitle.get(resolveTitle(`File:${clean(f)}`));
      if (!page || page.missing !== undefined) continue;
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const meta = info.extmetadata ?? {};
      out.set(f, {
        url: info.url,
        thumbUrl: info.thumburl,
        width: info.width,
        height: info.height,
        license: strip(meta.LicenseShortName?.value),
        credit: strip(meta.Artist?.value) || strip(meta.Credit?.value),
      });
    }
    await sleep(500); // be polite between batches
  }
  return out;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("✗ DATABASE_URL is not set. Add it to .env.local first.");
    process.exit(1);
  }
  const db = drizzle(neon(url), { schema });

  console.log("→ Resolving all images from Wikimedia Commons (batched)…");
  const files = [
    ...artworks.map((w) => w.commonsFile),
    ...artists.filter((a) => a.portraitFile).map((a) => a.portraitFile as string),
  ];
  const imgs = await resolveAll(files);
  console.log(`  ✓ resolved ${imgs.size}/${new Set(files).size} files`);

  console.log("→ Seeding periods…");
  for (const p of periods) {
    await db.insert(schema.periods).values(p).onConflictDoUpdate({ target: schema.periods.id, set: p });
  }
  console.log(`  ✓ ${periods.length} periods`);

  console.log("→ Seeding artists…");
  for (const a of artists) {
    const info = a.portraitFile ? imgs.get(a.portraitFile) : undefined;
    const row = {
      ...a,
      portraitFile: a.portraitFile ?? null,
      portraitUrl: info?.thumbUrl ?? info?.url ?? null,
    };
    await db.insert(schema.artists).values(row).onConflictDoUpdate({ target: schema.artists.id, set: row });
  }
  console.log(`  ✓ ${artists.length} artists`);

  console.log("→ Seeding artworks…");
  let resolved = 0;
  for (const w of artworks) {
    const info = imgs.get(w.commonsFile);
    if (info?.url) resolved++;
    else console.warn(`  · no Commons match for "${w.commonsFile}" (${w.title}) — UI will use Special:FilePath fallback`);
    const row = {
      ...w,
      imageUrl: info?.url ?? null,
      thumbUrl: info?.thumbUrl ?? null,
      imageWidth: info?.width ?? null,
      imageHeight: info?.height ?? null,
      licenseShort: info?.license ?? null,
      credit: info?.credit ?? null,
    };
    await db.insert(schema.artworks).values(row).onConflictDoUpdate({ target: schema.artworks.id, set: row });
  }
  console.log(`  ✓ ${artworks.length} artworks (${resolved} images resolved from Commons)`);
  console.log("✓ Seed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

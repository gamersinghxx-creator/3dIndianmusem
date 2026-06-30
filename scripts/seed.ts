/**
 * Seed + enrich script.
 *
 * Reads the bundled, hand-verified catalog (lib/data) and:
 *   1. resolves the canonical full-resolution image URL, dimensions, licence and
 *      credit for every artwork directly from the Wikimedia Commons API,
 *   2. resolves freely-licensed artist portraits where a file is given,
 *   3. upserts everything into Neon Postgres via Drizzle.
 *
 * This is the project's only data ingestion path, and it uses ONLY the
 * Wikimedia Commons API — no invented data. Run with:  npm run db:seed
 *
 * Requires DATABASE_URL in .env.local. Safe to re-run; it upserts by id.
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

interface ImageInfo {
  url?: string;
  thumbUrl?: string;
  width?: number;
  height?: number;
  license?: string;
  credit?: string;
}

/** Query the Commons API for an image's canonical URL + metadata. */
async function fetchCommons(file: string, thumbWidth = 2000): Promise<ImageInfo | null> {
  const title = `File:${file.replace(/^File:/, "")}`;
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "imageinfo",
    iiprop: "url|size|extmetadata",
    iiurlwidth: String(thumbWidth),
    titles: title,
    origin: "*",
  });
  try {
    const res = await fetch(`${COMMONS_API}?${params.toString()}`, {
      headers: { "User-Agent": "AntarangMuseum/0.1 (educational; Wikimedia data)" },
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const pages = data?.query?.pages ?? {};
    const page: any = Object.values(pages)[0];
    if (!page || page.missing !== undefined) return null;
    const info = page.imageinfo?.[0];
    if (!info) return null;
    const meta = info.extmetadata ?? {};
    const strip = (s?: string) => (s ? s.replace(/<[^>]+>/g, "").trim() : undefined);
    return {
      url: info.url,
      thumbUrl: info.thumburl,
      width: info.width,
      height: info.height,
      license: strip(meta.LicenseShortName?.value),
      credit: strip(meta.Artist?.value) || strip(meta.Credit?.value),
    };
  } catch (err) {
    console.warn(`  ! Commons fetch failed for ${file}:`, (err as Error).message);
    return null;
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("✗ DATABASE_URL is not set. Add it to .env.local first.");
    process.exit(1);
  }
  const db = drizzle(neon(url), { schema });

  console.log("→ Seeding periods…");
  for (const p of periods) {
    await db.insert(schema.periods).values(p).onConflictDoUpdate({
      target: schema.periods.id,
      set: p,
    });
  }
  console.log(`  ✓ ${periods.length} periods`);

  console.log("→ Seeding artists (resolving portraits)…");
  for (const a of artists) {
    let portraitUrl: string | null = null;
    if (a.portraitFile) {
      const info = await fetchCommons(a.portraitFile, 600);
      portraitUrl = info?.thumbUrl ?? info?.url ?? null;
    }
    const row = { ...a, portraitFile: a.portraitFile ?? null, portraitUrl };
    await db.insert(schema.artists).values(row).onConflictDoUpdate({
      target: schema.artists.id,
      set: row,
    });
  }
  console.log(`  ✓ ${artists.length} artists`);

  console.log("→ Seeding artworks (resolving images from Wikimedia Commons)…");
  let resolved = 0;
  for (const w of artworks) {
    const info = await fetchCommons(w.commonsFile);
    if (info?.url) resolved++;
    const row = {
      ...w,
      imageUrl: info?.url ?? null,
      thumbUrl: info?.thumbUrl ?? null,
      imageWidth: info?.width ?? null,
      imageHeight: info?.height ?? null,
      licenseShort: info?.license ?? null,
      credit: info?.credit ?? null,
    };
    await db.insert(schema.artworks).values(row).onConflictDoUpdate({
      target: schema.artworks.id,
      set: row,
    });
    console.log(`  ${info?.url ? "✓" : "·"} ${w.title}`);
  }
  console.log(`  ✓ ${artworks.length} artworks (${resolved} images resolved from Commons)`);
  console.log("✓ Seed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

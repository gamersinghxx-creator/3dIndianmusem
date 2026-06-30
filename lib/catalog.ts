import "server-only";
import { db, dbEnabled, schema } from "./db/client";
import {
  periods as staticPeriods,
  artists as staticArtists,
  artworks as staticArtworks,
} from "./data";
import type { Period, Artist, Artwork } from "./data/types";

// Unified, server-side data access. When Neon is configured the catalog is read
// from Postgres (the production source of truth, populated by scripts/seed.ts).
// Otherwise it falls back to the bundled static catalog so the museum always
// runs. The shapes are identical, so the rest of the app is agnostic.

export interface Catalog {
  periods: Period[];
  artists: Artist[];
  artworks: Artwork[];
  /** Image URLs resolved from Commons at seed time, keyed by artwork id. */
  images: Record<string, { imageUrl?: string; thumbUrl?: string; credit?: string; license?: string }>;
  /** Artist portrait URLs resolved from Commons, keyed by artist id. */
  portraits: Record<string, string | undefined>;
  source: "neon" | "static";
}

export async function getCatalog(): Promise<Catalog> {
  if (dbEnabled && db) {
    try {
      const [p, a, w] = await Promise.all([
        db.select().from(schema.periods),
        db.select().from(schema.artists),
        db.select().from(schema.artworks),
      ]);
      if (p.length && w.length) {
        const images: Catalog["images"] = {};
        for (const row of w) {
          images[row.id] = {
            imageUrl: row.imageUrl ?? undefined,
            thumbUrl: row.thumbUrl ?? undefined,
            credit: row.credit ?? undefined,
            license: row.licenseShort ?? undefined,
          };
        }
        const portraits: Catalog["portraits"] = {};
        for (const row of a) portraits[row.id] = row.portraitUrl ?? undefined;
        return {
          periods: p as unknown as Period[],
          artists: a as unknown as Artist[],
          artworks: w as unknown as Artwork[],
          images,
          portraits,
          source: "neon",
        };
      }
    } catch (err) {
      console.warn("[catalog] Neon read failed, falling back to static:", (err as Error).message);
    }
  }
  return {
    periods: staticPeriods,
    artists: staticArtists,
    artworks: staticArtworks,
    images: {},
    portraits: {},
    source: "static",
  };
}

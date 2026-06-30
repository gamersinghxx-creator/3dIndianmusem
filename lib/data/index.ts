import { periods } from "./periods";
import { artists } from "./artists";
import { artworks } from "./artworks";
import type { Artist, Artwork, Period } from "./types";

export { periods, artists, artworks };
export * from "./types";

export const getPeriod = (id: string): Period | undefined =>
  periods.find((p) => p.id === id);

export const getArtist = (id: string): Artist | undefined =>
  artists.find((a) => a.id === id);

export const getArtistBySlug = (slug: string): Artist | undefined =>
  artists.find((a) => a.slug === slug);

export const artworksByArtist = (artistId: string): Artwork[] =>
  artworks.filter((w) => w.artistId === artistId);

export const getArtwork = (id: string): Artwork | undefined =>
  artworks.find((w) => w.id === id);

/** Artists that have at least one public-domain artwork (i.e. a walkable hall). */
export const artistsWithWorks = (): Artist[] =>
  artists.filter((a) => artworks.some((w) => w.artistId === a.id));

/** Related works: same period or same artist, excluding the given work. */
export const relatedArtworks = (work: Artwork, limit = 4): Artwork[] => {
  const pool = artworks.filter(
    (w) =>
      w.id !== work.id &&
      (w.artistId === work.artistId || w.periodId === work.periodId)
  );
  // Prefer same-artist first.
  pool.sort((a, b) => Number(b.artistId === work.artistId) - Number(a.artistId === work.artistId));
  return pool.slice(0, limit);
};

export const YEAR_MIN = -3300;
export const YEAR_MAX = 2000;

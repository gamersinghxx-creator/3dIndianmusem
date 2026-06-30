import { commonsImage } from "./data/types";
import type { Artwork } from "./data/types";

export interface ImageMeta {
  imageUrl?: string;
  thumbUrl?: string;
  credit?: string;
  license?: string;
}

/**
 * Best available image URL for an artwork at a target width.
 * Prefers the URL resolved from the Commons API at seed time (stored in Neon);
 * otherwise builds a stable Special:FilePath URL from the Commons file name.
 */
export function artImage(
  work: Pick<Artwork, "commonsFile">,
  meta: ImageMeta | undefined,
  width = 1200
): string {
  if (meta?.thumbUrl) return meta.thumbUrl;
  if (meta?.imageUrl) return meta.imageUrl;
  return commonsImage(work.commonsFile, width);
}

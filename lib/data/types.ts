// Core domain types for the museum. These mirror the Neon/Drizzle schema
// (see lib/db/schema.ts) but are the source of truth for the static catalog
// that ships with the app and is also used to seed the database.

export type Axis = "world" | "india";

export type Medium =
  | "painting"
  | "sculpture"
  | "bronze"
  | "architecture"
  | "mural"
  | "miniature"
  | "manuscript"
  | "textile"
  | "printmaking"
  | "drawing";

/** A broad slice of time: a civilization, empire, dynasty, or art movement. */
export interface Period {
  id: string;
  axis: Axis;
  name: string;
  /** Short kind label, e.g. "Civilization", "Empire", "Movement", "School". */
  kind: string;
  /** Start / end years. Negative = BCE. Used to place nodes on the time-river. */
  startYear: number;
  endYear: number;
  region: string;
  blurb: string;
  wikipedia: string;
}

export interface Artist {
  id: string;
  slug: string;
  axis: Axis;
  name: string;
  /** Display life span, e.g. "1853–1890" or "active c. 5th century". */
  life: string;
  /** Approximate floruit year, used to place the artist on the timeline. */
  year: number;
  periodId: string;
  nationality: string;
  bio: string;
  wikipedia: string;
  /** Commons file name for a freely-licensed portrait / self-portrait, if any. */
  portraitFile?: string;
}

export interface Artwork {
  id: string;
  artistId: string;
  periodId: string;
  axis: Axis;
  title: string;
  /** Display year/date, e.g. "1889" or "c. 1010 CE". */
  date: string;
  /** Numeric year for timeline placement (negative = BCE). */
  year: number;
  medium: Medium;
  mediumDetail: string;
  dimensions?: string;
  museum: string;
  location: string;
  story: string;
  significance: string;
  funFacts: string[];
  /** Wikimedia Commons file name (without the "File:" prefix). */
  commonsFile: string;
  wikipedia: string;
  /** Whether the work is verified public domain (true for all shipped works). */
  publicDomain: boolean;
}

/** Build a stable, hot-linkable Wikimedia Commons image URL via Special:FilePath. */
export function commonsImage(file: string, width = 1600): string {
  const encoded = encodeURIComponent(file.replace(/^File:/, "").replace(/ /g, "_"));
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=${width}`;
}

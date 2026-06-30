"use client";
import { useMemo } from "react";
import { motion } from "framer-motion";
import type { Artist, Artwork, Period } from "@/lib/data/types";
import type { ImageMeta } from "@/lib/img";
import { useMuseum } from "@/lib/store";
import TimeRiver from "./TimeRiver";
import SearchResults from "./SearchResults";
import InspectModal from "@/components/inspect/InspectModal";

// Plain (JSON-serialisable) shape passed from the server page.
interface CatalogProp {
  periods: Period[];
  artists: Artist[];
  artworks: Artwork[];
  images: Record<string, ImageMeta>;
  portraits: Record<string, string | undefined>;
  source: "neon" | "static";
}

const MEDIA = [
  "all",
  "painting",
  "sculpture",
  "bronze",
  "architecture",
  "mural",
  "miniature",
  "printmaking",
];

export default function TimelineExperience({ catalog }: { catalog: CatalogProp }) {
  const { axis, setAxis, medium, setMedium, query, setQuery } = useMuseum();

  const artistsWithWorks = useMemo(
    () => new Set(catalog.artworks.map((w) => w.artistId)),
    [catalog.artworks]
  );

  const q = query.trim().toLowerCase();
  const matchAxis = (a: string) => axis === "all" || a === axis;

  const periods = useMemo(
    () => catalog.periods.filter((p) => matchAxis(p.axis)),
    [catalog.periods, axis]
  );
  const artists = useMemo(
    () =>
      catalog.artists.filter(
        (a) =>
          matchAxis(a.axis) &&
          (!q || a.name.toLowerCase().includes(q) || a.nationality.toLowerCase().includes(q))
      ),
    [catalog.artists, axis, q]
  );
  const artworks = useMemo(
    () =>
      catalog.artworks.filter(
        (w) =>
          matchAxis(w.axis) &&
          (medium === "all" || w.medium === medium) &&
          (!q ||
            w.title.toLowerCase().includes(q) ||
            w.museum.toLowerCase().includes(q))
      ),
    [catalog.artworks, axis, medium, q]
  );

  return (
    <main className="relative flex h-screen w-screen flex-col overflow-hidden">
      {/* Header */}
      <header className="z-20 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-white/10 bg-ink/80 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mr-auto">
          <motion.h1
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="font-serif text-xl tracking-wide text-ivory"
          >
            Antarang
            <span className="ml-2 hidden text-xs font-sans uppercase tracking-[0.3em] text-gold/70 sm:inline">
              A Museum of World &amp; Indian Art
            </span>
          </motion.h1>
        </div>

        {/* Axis toggle */}
        <div className="flex overflow-hidden rounded-full border border-white/15 text-xs">
          {(["all", "world", "india"] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAxis(a)}
              className={`px-3 py-1.5 capitalize transition ${
                axis === a
                  ? a === "india"
                    ? "bg-india text-ink"
                    : a === "world"
                      ? "bg-world text-ink"
                      : "bg-gold text-ink"
                  : "text-white/60 hover:text-white"
              }`}
            >
              {a === "all" ? "Both" : a}
            </button>
          ))}
        </div>

        {/* Medium filter */}
        <select
          value={medium}
          onChange={(e) => setMedium(e.target.value)}
          className="rounded-full border border-white/15 bg-transparent px-3 py-1.5 text-xs text-white/80 outline-none focus:border-gold [&>option]:bg-ink"
        >
          {MEDIA.map((m) => (
            <option key={m} value={m} className="capitalize">
              {m === "all" ? "All media" : m}
            </option>
          ))}
        </select>

        {/* Search */}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search artists, works, museums…"
          className="w-44 rounded-full border border-white/15 bg-transparent px-4 py-1.5 text-xs text-ivory placeholder:text-white/30 outline-none focus:border-gold sm:w-56"
        />
      </header>

      {/* Timeline */}
      <div className="relative flex-1">
        <TimeRiver
          periods={periods}
          artists={artists}
          artworks={artworks}
          images={catalog.images}
          portraits={catalog.portraits}
          artistsWithWorks={artistsWithWorks}
        />
      </div>

      {/* search results overlay */}
      <SearchResults
        artists={catalog.artists}
        artworks={catalog.artworks}
        periods={catalog.periods}
        images={catalog.images}
        portraits={catalog.portraits}
        artistsWithWorks={artistsWithWorks}
      />

      {/* data provenance */}
      <div className="pointer-events-none absolute bottom-12 right-4 z-10 text-[10px] text-white/25">
        data: {catalog.source === "neon" ? "Neon + Wikimedia" : "Wikimedia Commons"}
      </div>

      <InspectModal images={catalog.images} allArtworks={catalog.artworks} />
    </main>
  );
}

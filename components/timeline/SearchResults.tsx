"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { Artist, Artwork, Period } from "@/lib/data/types";
import type { ImageMeta } from "@/lib/img";
import { artImage } from "@/lib/img";
import { useMuseum } from "@/lib/store";

interface Props {
  artists: Artist[];
  artworks: Artwork[];
  periods: Period[];
  images: Record<string, ImageMeta>;
  portraits: Record<string, string | undefined>;
  artistsWithWorks: Set<string>;
}

export default function SearchResults({
  artists,
  artworks,
  periods,
  images,
  portraits,
  artistsWithWorks,
}: Props) {
  const router = useRouter();
  const { query, setQuery, inspect, setInfo } = useMuseum();
  const q = query.trim().toLowerCase();

  const { artistHits, workHits, periodHits } = useMemo(() => {
    if (!q) return { artistHits: [], workHits: [], periodHits: [] };
    return {
      artistHits: artists
        .filter(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            a.nationality.toLowerCase().includes(q) ||
            a.bio.toLowerCase().includes(q)
        )
        .slice(0, 8),
      workHits: artworks
        .filter(
          (w) =>
            w.title.toLowerCase().includes(q) ||
            w.museum.toLowerCase().includes(q) ||
            w.mediumDetail.toLowerCase().includes(q)
        )
        .slice(0, 10),
      periodHits: periods.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 5),
    };
  }, [q, artists, artworks, periods]);

  const total = artistHits.length + workHits.length + periodHits.length;

  return (
    <AnimatePresence>
      {q && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="absolute right-4 top-[64px] z-30 max-h-[75vh] w-[min(92vw,420px)] overflow-y-auto rounded-xl border border-white/10 bg-ink/95 p-4 shadow-2xl backdrop-blur-xl"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs uppercase tracking-widest text-white/40">
              {total} result{total === 1 ? "" : "s"} for “{query}”
            </p>
            <button
              onClick={() => setQuery("")}
              className="text-xs text-white/40 hover:text-gold"
            >
              clear ✕
            </button>
          </div>

          {total === 0 && (
            <p className="py-6 text-center text-sm text-white/40">
              Nothing matched. Try “Chola”, “Van Gogh”, “bronze”, or “Mughal”.
            </p>
          )}

          {periodHits.length > 0 && (
            <Group label="Periods">
              {periodHits.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setQuery(""); setInfo({ title: p.name, subtitle: p.kind, body: p.blurb, tag: p.kind }); }}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-white/5"
                >
                  <span
                    className={`h-2 w-2 rounded-full ${p.axis === "india" ? "bg-india" : "bg-world"}`}
                  />
                  <span className="text-sm text-ivory">{p.name}</span>
                  <span className="ml-auto text-[11px] text-white/35">{p.kind}</span>
                </button>
              ))}
            </Group>
          )}

          {artistHits.length > 0 && (
            <Group label="Artists">
              {artistHits.map((a) => {
                const hasMuseum = artistsWithWorks.has(a.id);
                const portrait = portraits[a.id];
                return (
                  <button
                    key={a.id}
                    onClick={() => {
                      setQuery("");
                      hasMuseum ? router.push(`/museum/${a.slug}`) : setInfo({ title: a.name, subtitle: `${a.life} · ${a.nationality}`, body: a.bio, tag: "Artist" });
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-white/5"
                  >
                    {portrait ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={portrait} alt={a.name} className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <span
                        className={`grid h-9 w-9 place-items-center rounded-full text-xs font-semibold ${
                          a.axis === "india" ? "bg-india/25 text-india" : "bg-world/25 text-world"
                        }`}
                      >
                        {a.name.split(" ").slice(-1)[0][0]}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-ivory">{a.name}</span>
                      <span className="block truncate text-[11px] text-white/40">{a.life} · {a.nationality}</span>
                    </span>
                    {hasMuseum && (
                      <span className="ml-auto whitespace-nowrap rounded-full bg-gold/15 px-2 py-0.5 text-[10px] text-gold">
                        Enter →
                      </span>
                    )}
                  </button>
                );
              })}
            </Group>
          )}

          {workHits.length > 0 && (
            <Group label="Artworks">
              {workHits.map((w) => (
                <button
                  key={w.id}
                  onClick={() => {
                    setQuery("");
                    inspect(w);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-white/5"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={artImage(w, images[w.id], 120)}
                    alt={w.title}
                    loading="lazy"
                    className="h-9 w-12 rounded object-cover"
                    onError={(e) => ((e.currentTarget.style.visibility = "hidden"))}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-ivory">{w.title}</span>
                    <span className="block truncate text-[11px] text-white/40">{w.date} · {w.museum}</span>
                  </span>
                </button>
              ))}
            </Group>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="mb-1 px-2 text-[10px] uppercase tracking-widest text-gold/60">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

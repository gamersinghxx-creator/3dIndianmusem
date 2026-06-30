"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type { Artist, Artwork, Period } from "@/lib/data/types";
import type { ImageMeta } from "@/lib/img";
import { useMuseum } from "@/lib/store";
import InspectModal from "@/components/inspect/InspectModal";

const Gallery3D = dynamic(() => import("./Gallery3D"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-ink text-white/50">
      <div className="animate-pulse text-sm tracking-widest">Preparing the gallery…</div>
    </div>
  ),
});

interface Props {
  artist: Artist;
  period: Period | null;
  works: Artwork[];
  images: Record<string, ImageMeta>;
  allArtworks: Artwork[];
}

export default function MuseumClient({ artist, period, works, images, allArtworks }: Props) {
  const [locked, setLocked] = useState(false);
  const [focused, setFocused] = useState<Artwork | null>(null);
  const inspect = useMuseum((s) => s.inspect);
  const inspecting = useMuseum((s) => s.inspecting);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-ink">
      {locked && <div className="crosshair" />}

      <Gallery3D
        artist={artist}
        works={works}
        images={images}
        onInspect={(w) => inspect(w)}
        onFocus={setFocused}
        onLockChange={setLocked}
      />

      {/* top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-5">
        <Link
          href="/"
          className="pointer-events-auto rounded-full border border-white/15 bg-black/50 px-4 py-2 text-xs text-ivory backdrop-blur transition hover:border-gold"
        >
          ← Timeline
        </Link>
        <div className="text-right">
          <h1 className="font-serif text-2xl text-ivory drop-shadow">{artist.name}</h1>
          <p className="text-xs text-gold/80">
            {artist.life}
            {period ? ` · ${period.name}` : ""}
          </p>
        </div>
      </div>

      {/* focused nameplate */}
      <AnimatePresence>
        {locked && focused && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="pointer-events-none absolute bottom-8 left-1/2 z-20 -translate-x-1/2 rounded-lg border border-white/10 bg-black/70 px-5 py-2.5 text-center backdrop-blur"
          >
            <p className="font-serif text-base text-ivory">{focused.title}</p>
            <p className="text-[11px] text-gold/80">
              {focused.date} · {focused.mediumDetail}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-widest text-white/40">
              click to inspect
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* enter overlay */}
      <AnimatePresence>
        {!locked && !inspecting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 grid place-items-center bg-ink/70 backdrop-blur-sm"
          >
            <div className="max-w-md px-6 text-center">
              <p className="mb-1 text-xs uppercase tracking-[0.3em] text-gold/70">
                {works.length} works · verified Wikimedia data
              </p>
              <h2 className="font-serif text-3xl text-ivory">{artist.name}</h2>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-white/70">
                {artist.bio}
              </p>
              <p className="mt-5 text-xs text-white/50">
                Move with <Key>W</Key> <Key>A</Key> <Key>S</Key> <Key>D</Key> · look with the mouse ·
                click a painting to inspect · <Key>Esc</Key> to release the cursor
              </p>
              <p
                className="mt-6 inline-block animate-pulse rounded-full border border-gold/50 px-6 py-2.5 text-sm text-gold"
              >
                Click anywhere to enter the gallery
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <InspectModal images={images} allArtworks={allArtworks} />
    </main>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mx-0.5 rounded border border-white/20 bg-white/5 px-1.5 py-0.5 text-[10px] text-ivory">
      {children}
    </kbd>
  );
}

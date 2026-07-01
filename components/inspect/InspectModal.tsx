"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Artwork } from "@/lib/data/types";
import type { ImageMeta } from "@/lib/img";
import { artImage } from "@/lib/img";
import { useMuseum } from "@/lib/store";

interface Props {
  images: Record<string, ImageMeta>;
  allArtworks: Artwork[];
}

function fmtYear(y: number) {
  return y < 0 ? `${Math.abs(y)} BCE` : `${y} CE`;
}

export default function InspectModal({ images, allArtworks }: Props) {
  const work = useMuseum((s) => s.inspecting);
  const inspect = useMuseum((s) => s.inspect);

  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    setScale(1);
    setPos({ x: 0, y: 0 });
    setLoaded(false);
  }, [work?.id]);

  // Browse the same artist's works (or, failing that, the same period) with arrows.
  const siblings = work ? allArtworks.filter((w) => w.artistId === work.artistId) : [];
  const pool =
    siblings.length > 1
      ? [...siblings].sort((a, b) => a.year - b.year)
      : work
        ? allArtworks.filter((w) => w.periodId === work.periodId).sort((a, b) => a.year - b.year)
        : [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!work) return;
      if (e.key === "Escape") return inspect(null);
      if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && pool.length > 1) {
        const idx = pool.findIndex((w) => w.id === work.id);
        if (idx === -1) return;
        const next =
          e.key === "ArrowRight" ? (idx + 1) % pool.length : (idx - 1 + pool.length) % pool.length;
        inspect(pool[next]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inspect, work, pool]);

  if (!work) return null;

  const meta = images[work.id];
  const hiRes = artImage(work, meta, 2400);
  const related = allArtworks
    .filter((w) => w.id !== work.id && (w.artistId === work.artistId || w.periodId === work.periodId))
    .sort((a, b) => Number(b.artistId === work.artistId) - Number(a.artistId === work.artistId))
    .slice(0, 4);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.max(1, Math.min(6, s * (e.deltaY < 0 ? 1.15 : 1 / 1.15))));
  };
  const onDown = (e: React.PointerEvent) => {
    if (scale <= 1) return;
    drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setPos({
      x: drag.current.px + (e.clientX - drag.current.x),
      y: drag.current.py + (e.clientY - drag.current.y),
    });
  };
  const onUp = () => (drag.current = null);

  const step = (dir: number) => {
    const i = pool.findIndex((w) => w.id === work.id);
    if (i === -1) return;
    inspect(pool[(i + dir + pool.length) % pool.length]);
  };

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex bg-black/85 backdrop-blur-md"
        onClick={() => inspect(null)}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 26 }}
          className="m-auto flex h-[92vh] w-[94vw] max-w-7xl flex-col overflow-hidden rounded-xl border border-white/10 bg-gallery shadow-2xl md:flex-row"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Image viewer */}
          <div
            className="relative flex-1 overflow-hidden bg-black"
            onWheel={onWheel}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            style={{ cursor: scale > 1 ? "grab" : "zoom-in" }}
          >
            {!loaded && (
              <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/[0.04] to-white/[0.01]">
                <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
                <div className="grid h-full place-items-center text-xs tracking-widest text-white/30">
                  loading high resolution…
                </div>
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={hiRes}
              alt={work.title}
              draggable={false}
              className="absolute left-1/2 top-1/2 max-h-full max-w-full select-none"
              style={{
                transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
                transition: drag.current ? "none" : "transform 0.15s ease-out",
                opacity: loaded ? 1 : 0,
              }}
              onLoad={() => setLoaded(true)}
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                const fallback = artImage(work, undefined, 1600);
                if (img.src !== fallback) img.src = fallback;
                else setLoaded(true);
              }}
            />

            {pool.length > 1 && (
              <>
                <button
                  onClick={() => step(-1)}
                  className="absolute left-3 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/50 text-xl text-ivory backdrop-blur transition hover:border-gold"
                  aria-label="Previous work"
                >
                  ‹
                </button>
                <button
                  onClick={() => step(1)}
                  className="absolute right-3 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/50 text-xl text-ivory backdrop-blur transition hover:border-gold"
                  aria-label="Next work"
                >
                  ›
                </button>
              </>
            )}

            <div className="absolute bottom-3 left-3 flex gap-2">
              <button
                onClick={() => setScale((s) => Math.min(6, s * 1.3))}
                className="grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-black/60 text-ivory hover:border-gold"
              >
                +
              </button>
              <button
                onClick={() => {
                  setScale(1);
                  setPos({ x: 0, y: 0 });
                }}
                className="grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-black/60 text-ivory hover:border-gold"
                aria-label="Reset zoom"
              >
                ⤢
              </button>
              <button
                onClick={() => setScale((s) => Math.max(1, s / 1.3))}
                className="grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-black/60 text-ivory hover:border-gold"
              >
                −
              </button>
            </div>
            {meta?.license && (
              <div className="absolute bottom-3 right-3 max-w-[60%] truncate text-right text-[10px] text-white/40">
                {meta.credit ? `${meta.credit} · ` : ""}
                {meta.license} · Wikimedia Commons
              </div>
            )}
          </div>

          {/* Details panel */}
          <div className="flex w-full flex-col overflow-y-auto border-t border-white/10 bg-gallery p-7 md:w-[400px] md:border-l md:border-t-0">
            <button
              onClick={() => inspect(null)}
              className="mb-4 self-end text-xs uppercase tracking-widest text-white/40 hover:text-gold"
            >
              Close ✕
            </button>

            <span
              className={`mb-2 inline-block w-fit rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest ${
                work.axis === "india" ? "bg-india/20 text-india" : "bg-world/20 text-world"
              }`}
            >
              {work.axis === "india" ? "Indian Art" : "World Art"} · {work.medium}
            </span>

            <h2 className="font-serif text-2xl leading-tight text-ivory">{work.title}</h2>
            <p className="mt-1 text-sm text-gold/90">{work.date}</p>

            <dl className="mt-5 space-y-2 text-sm">
              <Row k="Medium" v={work.mediumDetail} />
              {work.dimensions && <Row k="Dimensions" v={work.dimensions} />}
              <Row k="Collection" v={work.museum} />
              <Row k="Location" v={work.location} />
              <Row k="Timeline" v={fmtYear(work.year)} />
            </dl>

            {work.story && <Section title="The story">{work.story}</Section>}
            {work.significance && <Section title="Why it matters">{work.significance}</Section>}

            {work.funFacts?.length > 0 && (
              <div className="mt-5">
                <h3 className="mb-2 text-xs uppercase tracking-widest text-gold/70">Did you know</h3>
                <ul className="space-y-1.5 text-sm text-white/75">
                  {work.funFacts.map((f, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-gold">◆</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {related.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-2 text-xs uppercase tracking-widest text-gold/70">Related works</h3>
                <div className="grid grid-cols-2 gap-2">
                  {related.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => inspect(r)}
                      className="group overflow-hidden rounded-md border border-white/10 text-left transition hover:border-gold/60"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={artImage(r, images[r.id], 300)}
                        alt={r.title}
                        loading="lazy"
                        className="h-20 w-full object-cover"
                      />
                      <span className="block truncate px-2 py-1 text-[11px] text-white/70 group-hover:text-ivory">
                        {r.title}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {pool.length > 1 && (
              <p className="mt-3 text-[10px] text-white/30">Use ← → to browse works</p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-white/5 pb-1.5">
      <dt className="text-white/40">{k}</dt>
      <dd className="text-right text-white/85">{v}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h3 className="mb-1.5 text-xs uppercase tracking-widest text-gold/70">{title}</h3>
      <p className="text-sm leading-relaxed text-white/80">{children}</p>
    </div>
  );
}

"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type { Artist, Artwork, Period } from "@/lib/data/types";
import type { ImageMeta } from "@/lib/img";
import { artImage } from "@/lib/img";
import { useMuseum } from "@/lib/store";
import InspectModal from "@/components/inspect/InspectModal";
import InfoModal from "@/components/inspect/InfoModal";

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

const norm = (f: string) => f.replace(/^File:/, "").replace(/\.[a-z]+$/i, "").replace(/[ _]+/g, " ").trim().toLowerCase();

export default function MuseumClient({ artist, period, works, images, allArtworks }: Props) {
  const [locked, setLocked] = useState(false);
  const [focused, setFocused] = useState<Artwork | null>(null);
  const [showList, setShowList] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [tour, setTour] = useState(false);
  const [sound, setSound] = useState(false);
  const [dynWorks, setDynWorks] = useState<Artwork[]>([]);
  const [dynImages, setDynImages] = useState<Record<string, ImageMeta>>({});
  const [loading, setLoading] = useState(true);
  const inspect = useMuseum((s) => s.inspect);
  const inspecting = useMuseum((s) => s.inspecting);

  useEffect(() => {
    const touch = window.matchMedia("(pointer: coarse)").matches;
    setIsTouch(touch);
    if (touch) setShowList(true);
  }, []);

  // ── live gallery: pull the artist's works from Wikimedia Commons ──────────
  useEffect(() => {
    let alive = true;
    setLoading(true);
    const curatedFiles = new Set(works.map((w) => norm(w.commonsFile)));
    fetch(`/api/artist-works/${artist.slug}`)
      .then((r) => (r.ok ? r.json() : { works: [] }))
      .then((data: { works: any[] }) => {
        if (!alive) return;
        const dw: Artwork[] = [];
        const di: Record<string, ImageMeta> = {};
        (data.works || []).forEach((d, i) => {
          if (!d.file || curatedFiles.has(norm(d.file))) return;
          const id = `dyn-${artist.id}-${i}`;
          dw.push({
            id, artistId: artist.id, periodId: artist.periodId, axis: artist.axis,
            title: d.title || "Untitled", date: (d.date || "").slice(0, 40), year: artist.year,
            medium: "painting", mediumDetail: "",
            dimensions: d.width && d.height ? `${d.width} × ${d.height} px` : undefined,
            museum: "Wikimedia Commons", location: "",
            story: "", significance: "", funFacts: [],
            commonsFile: d.file, wikipedia: artist.wikipedia, publicDomain: true,
          });
          di[id] = { imageUrl: d.imageUrl, thumbUrl: d.thumbUrl, credit: d.credit, license: d.license };
        });
        setDynWorks(dw);
        setDynImages(di);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [artist.slug, artist.id, artist.periodId, artist.axis, artist.year, artist.wikipedia, works]);

  const merged = useMemo(() => [...works, ...dynWorks], [works, dynWorks]);
  const mergedImages = useMemo(() => ({ ...images, ...dynImages }), [images, dynImages]);
  const galleryWorks = useMemo(() => merged.slice(0, 14), [merged]);
  // inspect pool: replace this artist's catalog entries with the merged set so ←/→ browse everything
  const inspectPool = useMemo(
    () => [...allArtworks.filter((w) => w.artistId !== artist.id), ...merged],
    [allArtworks, merged, artist.id]
  );

  // ── gentle ambient room tone ──────────────────────────────────────────────
  const audioRef = useRef<{ ctx: AudioContext; gain: GainNode } | null>(null);
  useEffect(() => () => { try { audioRef.current?.ctx.close(); } catch {} }, []);
  const toggleSound = () => {
    try {
      if (sound) { const a = audioRef.current; if (a) a.gain.gain.setTargetAtTime(0, a.ctx.currentTime, 0.4); setSound(false); return; }
      let a = audioRef.current;
      if (!a) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        const gain = ctx.createGain(); gain.gain.value = 0; gain.connect(ctx.destination);
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 380; lp.connect(gain);
        [55, 110, 110.3, 164.8].forEach((f) => { const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f; o.connect(lp); o.start(); });
        a = { ctx, gain }; audioRef.current = a;
      }
      a.ctx.resume(); a.gain.gain.setTargetAtTime(0.05, a.ctx.currentTime, 1.0); setSound(true);
    } catch {}
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-ink">
      {locked && <div className="crosshair" />}

      {!isTouch && (
        <Gallery3D artist={artist} period={period} works={galleryWorks} images={mergedImages} tour={tour}
          onInspect={(w) => inspect(w)} onFocus={setFocused} onLockChange={setLocked} onTourEnd={() => setTour(false)} />
      )}
      {isTouch && <div className="absolute inset-0 grid place-items-center bg-gradient-to-b from-gallery to-ink" />}

      {/* loading gate — waits for the live Wikimedia fetch before you enter */}
      <AnimatePresence>
        {loading && (
          <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 grid place-items-center bg-ink/85 backdrop-blur-sm">
            <div className="text-center">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-gold" />
              <p className="text-sm tracking-widest text-white/70">Curating the gallery…</p>
              <p className="mt-1 text-[11px] text-white/40">fetching {artist.name}&apos;s works from Wikimedia</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-5">
        <div className="pointer-events-auto flex gap-2">
          <Link href="/" className="rounded-full border border-white/15 bg-black/50 px-4 py-2 text-xs text-ivory backdrop-blur transition hover:border-gold">← Timeline</Link>
          <button onClick={() => setShowList((v) => !v)} className={`rounded-full border px-4 py-2 text-xs backdrop-blur transition ${showList ? "border-gold bg-gold/15 text-gold" : "border-white/15 bg-black/50 text-ivory hover:border-gold"}`}>☰ Works ({merged.length}{loading ? "…" : ""})</button>
          {!isTouch && (
            <button onClick={() => { setTour((v) => !v); setShowList(false); }} className={`rounded-full border px-4 py-2 text-xs backdrop-blur transition ${tour ? "border-gold bg-gold/15 text-gold" : "border-white/15 bg-black/50 text-ivory hover:border-gold"}`}>{tour ? "■ Exit tour" : "▶ Guided tour"}</button>
          )}
        </div>
        <div className="text-right">
          <h1 className="font-serif text-2xl text-ivory drop-shadow">{artist.name}</h1>
          <p className="text-xs text-gold/80">{artist.life}{period ? ` · ${period.name}` : ""}</p>
        </div>
      </div>

      {/* focused nameplate */}
      <AnimatePresence>
        {(locked || tour) && focused && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="pointer-events-none absolute bottom-8 left-1/2 z-20 -translate-x-1/2 rounded-lg border border-white/10 bg-black/70 px-5 py-2.5 text-center backdrop-blur">
            <p className="font-serif text-base text-ivory">{focused.title}</p>
            <p className="text-[11px] text-gold/80">{focused.date}{focused.mediumDetail ? ` · ${focused.mediumDetail}` : ""}</p>
            {!tour && <p className="mt-1 text-[10px] uppercase tracking-widest text-white/40">click to inspect</p>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* tour caption */}
      <AnimatePresence>
        {tour && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute top-20 left-1/2 z-20 -translate-x-1/2 rounded-full border border-gold/30 bg-black/50 px-4 py-1.5 text-[11px] tracking-widest text-gold backdrop-blur">GUIDED TOUR · sit back and watch</motion.div>
        )}
      </AnimatePresence>

      {/* enter overlay */}
      <AnimatePresence>
        {!locked && !inspecting && !tour && !loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-30 grid place-items-center bg-ink/70 backdrop-blur-sm" style={{ pointerEvents: isTouch ? "auto" : "none" }}>
            <div className="max-w-md px-6 text-center">
              <p className="mb-1 text-xs uppercase tracking-[0.3em] text-gold/70">{loading ? "loading works…" : `${merged.length} works`} · live from Wikimedia</p>
              <h2 className="font-serif text-3xl text-ivory">{artist.name}</h2>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-white/70">{artist.bio}</p>
              {isTouch ? (
                <>
                  <p className="mt-5 text-xs text-white/50">The walkable 3D gallery is best on a desktop with a mouse. On this device, browse every work in full detail instead.</p>
                  <button onClick={() => setShowList(true)} className="mt-6 inline-block rounded-full border border-gold/50 px-6 py-2.5 text-sm text-gold">☰ Browse the {merged.length} works</button>
                </>
              ) : (
                <>
                  <p className="mt-5 text-xs text-white/50">Move with <Key>W</Key> <Key>A</Key> <Key>S</Key> <Key>D</Key> · look with the mouse · click a painting to inspect · <Key>Esc</Key> to release the cursor</p>
                  <div className="mt-6 flex items-center justify-center gap-3">
                    <p className="pointer-events-auto inline-block animate-pulse rounded-full border border-gold/50 px-6 py-2.5 text-sm text-gold">Click to enter &amp; walk</p>
                    <button onClick={() => setTour(true)} className="pointer-events-auto rounded-full bg-gold px-6 py-2.5 text-sm font-medium text-ink transition hover:bg-goldsoft">▶ Guided tour</button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* works list */}
      <AnimatePresence>
        {showList && (
          <motion.aside initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="absolute left-5 top-20 z-30 max-h-[74vh] w-[320px] overflow-y-auto rounded-xl border border-white/10 bg-ink/95 p-3 shadow-2xl backdrop-blur-xl">
            <p className="mb-2 px-1 text-[10px] uppercase tracking-widest text-gold/60">{merged.length} works {loading ? "· loading…" : "· live from Wikimedia Commons"}</p>
            <div className="grid grid-cols-2 gap-2">
              {merged.map((w) => (
                <button key={w.id} onClick={() => inspect(w)} className="group overflow-hidden rounded-lg border border-white/10 text-left transition hover:border-gold/60">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={artImage(w, mergedImages[w.id], 200)} alt={w.title} loading="lazy" className="h-20 w-full object-cover transition group-hover:scale-105" onError={(e) => (e.currentTarget.style.opacity = "0.15")} />
                  <span className="block truncate px-2 py-1 text-[10px] text-white/70 group-hover:text-ivory">{w.title}</span>
                </button>
              ))}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* bottom-right controls */}
      <div className="absolute bottom-5 right-5 z-30 flex gap-2">
        <button onClick={toggleSound} className={`grid h-10 w-10 place-items-center rounded-full border backdrop-blur transition ${sound ? "border-gold bg-gold/15 text-gold" : "border-white/15 bg-black/60 text-ivory hover:border-gold"}`} aria-label="Ambient sound">{sound ? "♪" : "🔇"}</button>
        {!isTouch && <button onClick={() => setShowHelp((v) => !v)} className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/60 text-ivory backdrop-blur transition hover:border-gold" aria-label="Controls help">?</button>}
      </div>
      <AnimatePresence>
        {showHelp && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="absolute bottom-20 right-5 z-30 w-64 rounded-xl border border-white/10 bg-ink/95 p-4 text-sm text-white/75 shadow-2xl backdrop-blur-xl">
            <p className="mb-2 text-xs uppercase tracking-widest text-gold/70">Controls</p>
            <ul className="space-y-1.5">
              <li><Key>W</Key><Key>A</Key><Key>S</Key><Key>D</Key> — move</li>
              <li>Mouse — look around</li>
              <li>Click a painting — inspect</li>
              <li><Key>Esc</Key> — release cursor</li>
              <li>▶ Guided tour — auto walkthrough</li>
              <li>♪ — ambient room tone</li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      <InspectModal images={mergedImages} allArtworks={inspectPool} />
      <InfoModal />
    </main>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return <kbd className="mx-0.5 rounded border border-white/20 bg-white/5 px-1.5 py-0.5 text-[10px] text-ivory">{children}</kbd>;
}

"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { Artist, Artwork, Period } from "@/lib/data/types";
import type { ImageMeta } from "@/lib/img";
import { artImage } from "@/lib/img";
import { useMuseum } from "@/lib/store";
import CosmicBackground from "./CosmicBackground";

interface Props {
  periods: Period[];
  artists: Artist[];
  artworks: Artwork[];
  images: Record<string, ImageMeta>;
  portraits: Record<string, string | undefined>;
  artistsWithWorks: Set<string>;
}

const fmtYear = (y: number) => (y < 0 ? `${Math.abs(y)} BCE` : `${y} CE`);
// Each era gets its own horizontal "cell" sized to hold its artists with room.
const ERA_GAP = 120;
const MIN_CELL = 260;
const PER_ARTIST = 104;
const MAX_CELL = 860;
const D = 50; // medallion diameter

function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed: number) { let t = seed >>> 0; return () => { t += 0x6d2b79f5; let x = Math.imul(t ^ (t >>> 15), 1 | t); x ^= x + Math.imul(x ^ (x >>> 7), 61 | x); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }

export default function TimeRiver({ periods, artists, artworks, images, portraits, artistsWithWorks }: Props) {
  const router = useRouter();
  const inspect = useMuseum((s) => s.inspect);
  const setInfo = useMuseum((s) => s.setInfo);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1200, h: 600 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState(80);
  const [hoverArtist, setHoverArtist] = useState<Artist | null>(null);
  const [tour, setTour] = useState(true);

  // ── lookups ───────────────────────────────────────────────────────────────
  const periodName = useMemo(() => Object.fromEntries(periods.map((p) => [p.id, p.name])), [periods]);
  const workCount = useMemo(() => { const m: Record<string, number> = {}; artworks.forEach((w) => (m[w.artistId] = (m[w.artistId] || 0) + 1)); return m; }, [artworks]);
  const worksByArtist = useMemo(() => { const m: Record<string, Artwork[]> = {}; artworks.forEach((w) => (m[w.artistId] ||= []).push(w)); return m; }, [artworks]);
  const artistsByPeriod = useMemo(() => { const m: Record<string, Artist[]> = {}; artists.forEach((a) => (m[a.periodId] ||= []).push(a)); return m; }, [artists]);
  const artistDisc = useMemo(() => {
    const m: Record<string, string | undefined> = {};
    artists.forEach((a) => { const w = worksByArtist[a.id]?.[0]; m[a.id] = portraits[a.id] || (w ? artImage(w, images[w.id], 200) : undefined); });
    return m;
  }, [artists, worksByArtist, images, portraits]);
  const periodHue = useMemo(() => {
    const sorted = [...periods].sort((a, b) => a.startYear - b.startYear);
    const m: Record<string, number> = {};
    sorted.forEach((p, i) => (m[p.id] = Math.round(8 + i * (330 / Math.max(1, sorted.length - 1)))));
    return m;
  }, [periods]);

  // ── era cells (chronological order; width scales with #artists) ────────────
  const eras = useMemo(() => {
    const sorted = [...periods].sort((a, b) => a.startYear - b.startYear);
    let cursor = 0;
    const list = sorted.map((p) => {
      const n = artistsByPeriod[p.id]?.length ?? 0;
      const w = Math.min(MAX_CELL, Math.max(MIN_CELL, n * PER_ARTIST + 150));
      const cell = { p, x0: cursor, w, cx: cursor + w / 2 };
      cursor += w + ERA_GAP;
      return cell;
    });
    return { list, total: Math.max(1, cursor), count: sorted.length || 1 };
  }, [periods, artistsByPeriod]);

  // ── geometry / zoom thresholds (declared before use) ───────────────────────
  const cy0 = size.h / 2;
  const avgCell = eras.total / eras.count;
  const minZoom = useMemo(() => Math.max(0.05, size.w / (avgCell * 6.5)), [size.w, avgCell]);
  const defaultZoom = useMemo(() => Math.min(4, Math.max(minZoom * 1.6, size.w / (avgCell * 3))), [size.w, avgCell, minZoom]);
  const showMedallions = zoom > minZoom * 1.5;
  const X = (base: number) => base * zoom + offset;

  // ── artist constellation positions inside each cell (no overlap) ───────────
  const layout = useMemo(() => {
    const res: { a: Artist; bx: number; by: number; hue: number }[] = [];
    for (const era of eras.list) {
      const side = era.p.axis === "world" ? -1 : 1;
      const as = artistsByPeriod[era.p.id] ?? [];
      const n = as.length;
      as.forEach((a, i) => {
        const r = rng(hash(a.id));
        const frac = n === 1 ? 0.5 : (i + 0.5) / n;
        const bx = era.x0 + (0.12 + 0.76 * frac) * era.w;
        const row = i % 2;
        const by = cy0 + side * (124 + row * 88 + Math.floor(r() * 2) * 26);
        res.push({ a, bx, by, hue: periodHue[era.p.id] ?? 40 });
      });
    }
    return res;
  }, [eras, artistsByPeriod, periodHue, cy0]);

  const constellations = useMemo(() => {
    const g: Record<string, { x: number; y: number }[]> = {};
    layout.forEach((n) => (g[n.a.periodId] ||= []).push({ x: n.bx * zoom + offset, y: n.by }));
    return Object.entries(g).map(([pid, pts]) => ({ pid, pts, hue: periodHue[pid] ?? 40 }));
  }, [layout, zoom, offset, periodHue]);

  // ── viewport / interaction ──────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  useEffect(() => { setZoom(defaultZoom); setOffset(80); /* eslint-disable-next-line */ }, [Math.round(defaultZoom * 1000)]);

  const panRef = useRef(offset);
  useEffect(() => { panRef.current = offset; }, [offset]);
  const getPan = useCallback(() => panRef.current, []);

  const clampOffset = useCallback((o: number) => Math.max(Math.min(80, size.w - eras.total * zoom - 100), Math.min(160, o)), [size.w, eras.total, zoom]);
  const zoomAround = useCallback((sx: number, f: number) => {
    setTour(false);
    setZoom((z) => { const nz = Math.max(minZoom, Math.min(8, z * f)); setOffset((o) => sx - ((sx - o) / z) * nz); return nz; });
  }, [minZoom]);
  const onWheel = useCallback((e: React.WheelEvent) => {
    const rect = containerRef.current?.getBoundingClientRect(); if (!rect) return;
    if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > Math.abs(e.deltaX)) zoomAround(e.clientX - rect.left, e.deltaY < 0 ? 1.12 : 1 / 1.12);
    else { setTour(false); setOffset((o) => clampOffset(o - e.deltaX)); }
  }, [zoomAround, clampOffset]);
  const drag = useRef<{ x: number; o: number } | null>(null);
  const onDown = (e: React.PointerEvent) => { drag.current = { x: e.clientX, o: offset }; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); };
  const onMove = (e: React.PointerEvent) => { if (!drag.current) return; if (Math.abs(e.clientX - drag.current.x) > 3) setTour(false); setOffset(clampOffset(drag.current.o + (e.clientX - drag.current.x))); };
  const onUp = () => (drag.current = null);

  return (
    <div
      ref={containerRef}
      onWheel={onWheel} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
      className="relative h-full w-full cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing"
    >
      <CosmicBackground getPan={getPan} />

      {/* era nebulae (ambient, behind) */}
      {eras.list.map((era) => {
        const cx = X(era.cx);
        const wpx = Math.min(900, Math.max(280, era.w * zoom * 0.95));
        if (cx + wpx / 2 < -40 || cx - wpx / 2 > size.w + 40) return null;
        const side = era.p.axis === "world" ? -1 : 1;
        const h = periodHue[era.p.id] ?? 40;
        return (
          <div key={`neb-${era.p.id}`} className="pointer-events-none absolute" style={{ left: cx, top: cy0 + side * 172, transform: "translate(-50%,-50%)" }}>
            <div style={{ width: wpx, height: wpx * 0.6, borderRadius: "50%", background: `radial-gradient(closest-side, hsla(${h},70%,55%,0.22), hsla(${h},70%,45%,0.07) 55%, transparent 72%)`, filter: "blur(48px)", mixBlendMode: "screen" }} />
          </div>
        );
      })}

      {/* center beam */}
      <div className="pointer-events-none absolute left-0 right-0" style={{ top: cy0 }}>
        <div className="h-px w-full" style={{ background: "linear-gradient(90deg,transparent,rgba(200,164,92,0.5),transparent)" }} />
      </div>

      {/* era start-year waypoints */}
      {eras.list.map((era) => {
        const px = X(era.x0);
        if (px < -30 || px > size.w + 30) return null;
        return <div key={`tk-${era.p.id}`} className="pointer-events-none absolute -translate-x-1/2 text-[10px] text-white/25" style={{ left: px, top: cy0 - 8 }}>{fmtYear(era.p.startYear)}</div>;
      })}

      {/* constellation lines */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        {constellations.map(({ pid, pts, hue }) => {
          if (!pts.some((p) => p.x > -60 && p.x < size.w + 60)) return null;
          const op = showMedallions ? 0.28 : 0.14;
          return (
            <g key={pid}>
              {pts.length > 1 && <polyline points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={`hsla(${hue},75%,72%,${op})`} strokeWidth={1} />}
              {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={1.5} fill={`hsla(${hue},80%,82%,0.6)`} />)}
            </g>
          );
        })}
      </svg>

      {/* era labels (one per cell — cells are separated so they never collide) */}
      {eras.list.map((era) => {
        const cx = X(era.cx);
        if (cx < -180 || cx > size.w + 180) return null;
        const side = era.p.axis === "world" ? -1 : 1;
        const h = periodHue[era.p.id] ?? 40;
        return (
          <button key={`lab-${era.p.id}`} onClick={() => setInfo({ title: era.p.name, subtitle: `${fmtYear(era.p.startYear)} – ${fmtYear(era.p.endYear)} · ${era.p.region}`, body: era.p.blurb, tag: era.p.kind })} className="absolute z-[6] whitespace-nowrap text-center transition hover:scale-105" style={{ left: cx, top: cy0 + side * 44, transform: `translate(-50%, ${side < 0 ? "-100%" : "0"})` }}>
            <div className="font-serif text-[14px] tracking-wide" style={{ color: `hsl(${h},58%,84%)`, textShadow: "0 1px 12px rgba(0,0,0,0.95)" }}>{era.p.name}</div>
            <div className="text-[9px] tracking-[0.15em] text-white/40">{fmtYear(era.p.startYear)} – {fmtYear(era.p.endYear)}</div>
          </button>
        );
      })}

      {/* artist nodes */}
      {layout.map(({ a, bx, by, hue }) => {
        const cx = bx * zoom + offset;
        if (cx < -80 || cx > size.w + 80) return null;
        const hasMuseum = artistsWithWorks.has(a.id);
        const enter = () => (hasMuseum ? router.push(`/museum/${a.slug}`) : setInfo({ title: a.name, subtitle: `${a.life} · ${a.nationality}`, body: a.bio, image: artistDisc[a.id], tag: "Artist" }));
        if (!showMedallions) {
          return (
            <button key={a.id} onClick={enter} onMouseEnter={() => setHoverArtist(a)} className="absolute z-[7] -translate-x-1/2 -translate-y-1/2" style={{ left: cx, top: by }}>
              <span className="block rounded-full" style={{ width: hasMuseum ? 7 : 5, height: hasMuseum ? 7 : 5, background: hasMuseum ? "#e7cf9b" : `hsla(${hue},80%,80%,0.85)`, boxShadow: hasMuseum ? "0 0 10px 2px rgba(231,207,155,0.7)" : `0 0 8px hsla(${hue},80%,70%,0.6)` }} />
            </button>
          );
        }
        const disc = artistDisc[a.id];
        return (
          <button key={a.id} onClick={enter} onMouseEnter={() => setHoverArtist(a)} className="group absolute z-[8] -translate-x-1/2 -translate-y-1/2" style={{ left: cx, top: by }} title={a.name}>
            <span className="block overflow-hidden rounded-full transition-transform duration-200 group-hover:scale-[1.18]" style={{ width: D, height: D, border: `2px solid ${hasMuseum ? "#c8a45c" : `hsla(${hue},50%,70%,0.6)`}`, boxShadow: hasMuseum ? "0 0 14px rgba(200,164,92,0.4)" : "0 4px 12px rgba(0,0,0,0.6)", background: "#14171d" }}>
              {disc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={disc} alt={a.name} loading="lazy" className="h-full w-full object-cover" onError={(e) => (e.currentTarget.style.opacity = "0")} />
              ) : (
                <span className="grid h-full w-full place-items-center font-serif text-base" style={{ color: `hsl(${hue},55%,80%)` }}>{a.name.split(" ").slice(-1)[0][0]}</span>
              )}
            </span>
            <span className="mt-1 block w-24 -translate-x-1/2 translate-x-[25px] text-center text-[10px] leading-tight text-white/60 opacity-0 transition group-hover:opacity-100">{a.name}</span>
          </button>
        );
      })}

      {/* artist hover card */}
      {hoverArtist && (() => {
        const node = layout.find((l) => l.a.id === hoverArtist.id);
        const cx = node ? node.bx * zoom + offset : -999;
        if (cx < -200 || cx > size.w + 200) return null;
        const above = hoverArtist.axis === "world";
        const hasMuseum = artistsWithWorks.has(hoverArtist.id);
        const disc = artistDisc[hoverArtist.id];
        const works = worksByArtist[hoverArtist.id] ?? [];
        const cardLeft = Math.max(12, Math.min(size.w - 284, cx - 132));
        return (
          <div onMouseLeave={() => setHoverArtist(null)} className="absolute z-[15] w-[268px] animate-fadeUp rounded-xl border border-white/10 bg-ink/95 p-4 shadow-2xl backdrop-blur-xl" style={{ left: cardLeft, top: above ? Math.max(8, cy0 - 320) : cy0 + 70 }}>
            <div className="flex items-center gap-3">
              {disc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={disc} alt={hoverArtist.name} className="h-12 w-12 rounded-full object-cover ring-1 ring-gold/40" />
              ) : (
                <span className={`grid h-12 w-12 place-items-center rounded-full text-sm font-semibold ${above ? "bg-world/25 text-world" : "bg-india/25 text-india"}`}>{hoverArtist.name.split(" ").slice(-1)[0][0]}</span>
              )}
              <div className="min-w-0"><p className="truncate font-serif text-base text-ivory">{hoverArtist.name}</p><p className="text-[11px] text-gold/80">{hoverArtist.life}</p></div>
            </div>
            <p className="mt-2 text-[11px] text-white/45">{periodName[hoverArtist.periodId]} · {hoverArtist.nationality}{workCount[hoverArtist.id] ? ` · ${workCount[hoverArtist.id]} works` : ""}</p>
            <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-white/70">{hoverArtist.bio}</p>
            {works.length > 0 && (
              <div className="mt-3 flex gap-1.5 overflow-x-auto">
                {works.slice(0, 4).map((w) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={w.id} src={artImage(w, images[w.id], 160)} alt={w.title} onClick={() => inspect(w)} className="h-12 w-12 flex-none cursor-pointer rounded object-cover ring-1 ring-white/10 transition hover:ring-gold" onError={(e) => (e.currentTarget.style.display = "none")} />
                ))}
              </div>
            )}
            <div className="mt-3 flex gap-2">
              {hasMuseum ? (
                <button onClick={() => router.push(`/museum/${hoverArtist.slug}`)} className="flex-1 rounded-full bg-gold px-3 py-1.5 text-[12px] font-medium text-ink transition hover:bg-goldsoft">Enter museum →</button>
              ) : (
                <span className="flex-1 rounded-full border border-white/10 px-3 py-1.5 text-center text-[11px] text-white/40">Biography</span>
              )}
              <button onClick={() => setInfo({ title: hoverArtist.name, subtitle: `${hoverArtist.life} · ${hoverArtist.nationality}`, body: hoverArtist.bio, image: artistDisc[hoverArtist.id], tag: "Artist" })} className="rounded-full border border-white/15 px-3 py-1.5 text-[12px] text-white/70 transition hover:border-gold hover:text-gold">Read ↗</button>
            </div>
          </div>
        );
      })()}

      {/* axis captions */}
      <div className="pointer-events-none absolute left-4 top-4 z-10 font-serif text-xs uppercase tracking-[0.3em] text-world/70">World Art</div>
      <div className="pointer-events-none absolute bottom-4 left-4 z-10 font-serif text-xs uppercase tracking-[0.3em] text-india/80">Indian Art</div>

      {/* onboarding tour hint */}
      <AnimatePresence>
        {tour && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }} className="pointer-events-auto absolute bottom-16 left-1/2 z-30 w-[min(92vw,440px)] -translate-x-1/2 rounded-2xl border border-gold/30 bg-ink/90 p-4 text-center shadow-2xl backdrop-blur-xl">
            <p className="font-serif text-base text-ivory">Travel through the history of art ✦</p>
            <p className="mx-auto mt-2 max-w-sm text-[12px] leading-relaxed text-white/70">
              Each glowing cloud is an era. <strong className="text-gold">Scroll / pinch</strong> to zoom into one and reveal its artists as a constellation; <strong className="text-gold">drag</strong> to travel across time. <strong className="text-gold">Hover</strong> an artist for details and <strong className="text-gold">click a gold-ringed medallion</strong> to walk their 3D museum.
            </p>
            <button onClick={() => setTour(false)} className="mt-3 rounded-full border border-gold/50 px-5 py-1.5 text-xs text-gold transition hover:bg-gold hover:text-ink">Start exploring</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* zoom controls */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
        <button onClick={() => zoomAround(size.w / 2, 1 / 1.4)} className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/50 text-lg text-ivory backdrop-blur hover:border-gold" aria-label="Zoom out">−</button>
        <button onClick={() => zoomAround(size.w / 2, 1.4)} className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/50 text-lg text-ivory backdrop-blur hover:border-gold" aria-label="Zoom in">+</button>
      </div>
      <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 hidden -translate-x-1/2 text-center text-[11px] text-white/30 sm:block">
        scroll to zoom · drag to pan · hover an artist · gold rings open a walkable museum
      </div>
    </div>
  );
}

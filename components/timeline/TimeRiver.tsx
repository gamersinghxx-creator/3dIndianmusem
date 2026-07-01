"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
const ACTIVE_K = 30;   // active-era width = ACTIVE_K * sqrt(duration)
const GAP_PX = 140;    // collapsed width of an empty span
const MERGE_GAP = 25;  // years within which spans read as continuous
const D = 48;          // medallion diameter

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

  // ── lookups ────────────────────────────────────────────────────────────
  const periodName = useMemo(() => Object.fromEntries(periods.map((p) => [p.id, p.name])), [periods]);
  const workCount = useMemo(() => { const m: Record<string, number> = {}; artworks.forEach((w) => (m[w.artistId] = (m[w.artistId] || 0) + 1)); return m; }, [artworks]);
  const worksByArtist = useMemo(() => { const m: Record<string, Artwork[]> = {}; artworks.forEach((w) => (m[w.artistId] ||= []).push(w)); return m; }, [artworks]);
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

  // ── shared gap-skipping scale (both tracks use the same time axis) ────────
  const scale = useMemo(() => {
    const ivs = periods.map((p) => [Math.min(p.startYear, p.endYear), Math.max(p.startYear, p.endYear)] as [number, number]).sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const iv of ivs) { const last = merged[merged.length - 1]; if (last && iv[0] <= last[1] + MERGE_GAP) last[1] = Math.max(last[1], iv[1]); else merged.push([iv[0], iv[1]]); }
    const segs: { type: "active" | "gap"; a: number; b: number; p0: number; w: number }[] = [];
    let pos = 0, prev: number | null = null;
    for (const [s, e] of merged) {
      if (prev !== null) { segs.push({ type: "gap", a: prev, b: s, p0: pos, w: GAP_PX }); pos += GAP_PX; }
      const w = ACTIVE_K * Math.sqrt(Math.max(1, e - s)); segs.push({ type: "active", a: s, b: e, p0: pos, w }); pos += w; prev = e;
    }
    return { segs, total: pos || 1, minY: merged[0]?.[0] ?? 0, maxY: prev ?? 1 };
  }, [periods]);
  const posBase = useCallback((year: number) => {
    const { segs, minY, maxY } = scale; const y = Math.max(minY, Math.min(maxY, year));
    for (const s of segs) if (y >= s.a && y <= s.b) return s.b === s.a ? s.p0 : s.p0 + ((y - s.a) / (s.b - s.a)) * s.w;
    return 0;
  }, [scale]);
  const x = (year: number) => posBase(year) * zoom + offset;

  const cy0 = size.h / 2;
  // Fit the whole (compressed) span to ~1.5 screens by default — light panning.
  const minZoom = useMemo(() => Math.max(0.05, (size.w * 0.92) / scale.total), [size.w, scale.total]);
  const defaultZoom = useMemo(() => Math.min(5, Math.max(minZoom, (size.w * 1.5) / scale.total)), [size.w, scale.total, minZoom]);
  const showMedallions = zoom > minZoom * 1.25;

  // ── collision-free medallion lanes (per track) ──────────────────────────
  const layout = useMemo(() => {
    const SP = showMedallions ? D + 16 : 22;
    const LANE_H = showMedallions ? 68 : 28;
    const BASE = showMedallions ? 96 : 60;
    const res: { a: Artist; bx: number; by: number; hue: number }[] = [];
    for (const sideSign of [-1, 1]) {
      const side = sideSign === -1 ? "world" : "india";
      const laneLast: number[] = [];
      artists.filter((a) => a.axis === side).map((a) => ({ a, bx: posBase(a.year) })).sort((p, q) => p.bx - q.bx)
        .forEach(({ a, bx }) => {
          const sx = bx * zoom + offset;
          let lane = laneLast.findIndex((l) => l < sx - SP);
          if (lane === -1) { lane = laneLast.length; laneLast.push(sx); } else laneLast[lane] = sx;
          res.push({ a, bx, by: cy0 + sideSign * (BASE + lane * LANE_H), hue: periodHue[a.periodId] ?? 40 });
        });
    }
    return res;
  }, [artists, posBase, zoom, offset, cy0, periodHue, showMedallions]);

  const constellations = useMemo(() => {
    const g: Record<string, { x: number; y: number }[]> = {};
    [...layout].sort((p, q) => p.a.year - q.a.year).forEach((n) => (g[n.a.periodId] ||= []).push({ x: n.bx * zoom + offset, y: n.by }));
    return Object.entries(g).map(([pid, pts]) => ({ pid, pts, hue: periodHue[pid] ?? 40 }));
  }, [layout, zoom, offset, periodHue]);

  // era labels lane-packed into rows just off the beam
  const eraLabels = useMemo(() => {
    const out: { p: Period; cx: number; cy: number }[] = [];
    for (const sideSign of [-1, 1]) {
      const side = sideSign === -1 ? "world" : "india";
      const laneRight: number[] = [];
      periods.filter((p) => p.axis === side)
        .map((p) => ({ p, cx: (posBase(p.startYear) + posBase(p.endYear)) / 2 * zoom + offset, w: Math.max(96, p.name.length * 7.4 + 20) }))
        .sort((a, b) => a.cx - b.cx)
        .forEach(({ p, cx, w }) => {
          const left = cx - w / 2;
          let lane = laneRight.findIndex((r) => r < left - 12);
          if (lane === -1) { lane = laneRight.length; laneRight.push(cx + w / 2); } else laneRight[lane] = cx + w / 2;
          out.push({ p, cx, cy: cy0 + sideSign * (30 + lane * 20) });
        });
    }
    return out;
  }, [periods, posBase, zoom, offset, cy0]);

  const gaps = useMemo(() => scale.segs.filter((s) => s.type === "gap").map((s) => ({ x: (s.p0 + s.w / 2) * zoom + offset, len: Math.round(s.b - s.a) })), [scale, zoom, offset]);

  // ── viewport / interaction ───────────────────────────────────────────────
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
  const clampOffset = useCallback((o: number) => Math.max(Math.min(80, size.w - scale.total * zoom - 90), Math.min(150, o)), [size.w, scale.total, zoom]);
  const zoomAround = useCallback((sx: number, f: number) => {
    setZoom((z) => { const nz = Math.max(minZoom, Math.min(7, z * f)); setOffset((o) => sx - ((sx - o) / z) * nz); return nz; });
  }, [minZoom]);
  const onWheel = useCallback((e: React.WheelEvent) => {
    const rect = containerRef.current?.getBoundingClientRect(); if (!rect) return;
    if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > Math.abs(e.deltaX)) zoomAround(e.clientX - rect.left, e.deltaY < 0 ? 1.12 : 1 / 1.12);
    else setOffset((o) => clampOffset(o - e.deltaX));
  }, [zoomAround, clampOffset]);
  const drag = useRef<{ x: number; o: number } | null>(null);
  const onDown = (e: React.PointerEvent) => { drag.current = { x: e.clientX, o: offset }; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); };
  const onMove = (e: React.PointerEvent) => drag.current && setOffset(clampOffset(drag.current.o + (e.clientX - drag.current.x)));
  const onUp = () => (drag.current = null);

  return (
    <div ref={containerRef} onWheel={onWheel} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
      className="relative h-full w-full cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing">
      <CosmicBackground getPan={getPan} />

      {/* era nebulae */}
      {periods.map((p) => {
        const left = x(p.startYear), right = x(p.endYear);
        const cx = (left + right) / 2, wpx = Math.min(760, Math.max(240, right - left + 200));
        if (cx + wpx / 2 < -40 || cx - wpx / 2 > size.w + 40) return null;
        const side = p.axis === "world" ? -1 : 1, h = periodHue[p.id] ?? 40;
        return (
          <div key={`neb-${p.id}`} className="pointer-events-none absolute" style={{ left: cx, top: cy0 + side * 150, transform: "translate(-50%,-50%)" }}>
            <div style={{ width: wpx, height: wpx * 0.62, borderRadius: "50%", background: `radial-gradient(closest-side, hsla(${h},70%,55%,0.26), hsla(${h},70%,45%,0.09) 55%, transparent 72%)`, filter: "blur(42px)", mixBlendMode: "screen" }} />
          </div>
        );
      })}

      {/* center beam */}
      <div className="pointer-events-none absolute left-0 right-0" style={{ top: cy0 }}><div className="h-px w-full" style={{ background: "linear-gradient(90deg,transparent,rgba(200,164,92,0.5),transparent)" }} /></div>

      {/* gap markers */}
      {gaps.map((g, i) => (g.x < -40 || g.x > size.w + 40 ? null : (
        <div key={i} className="pointer-events-none absolute -translate-x-1/2 text-[10px] italic text-white/25" style={{ left: g.x, top: cy0 - 7 }}>⋯ {g.len} yrs ⋯</div>
      )))}

      {/* constellation lines */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        {constellations.map(({ pid, pts, hue }) => (!pts.some((p) => p.x > -60 && p.x < size.w + 60) ? null : (
          <g key={pid}>
            {pts.length > 1 && <polyline points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={`hsla(${hue},75%,72%,${showMedallions ? 0.26 : 0.14})`} strokeWidth={1} />}
            {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={1.5} fill={`hsla(${hue},80%,82%,0.6)`} />)}
          </g>
        )))}
      </svg>

      {/* era labels */}
      {eraLabels.map(({ p, cx, cy }) => (cx < -160 || cx > size.w + 160 ? null : (() => {
        const h = periodHue[p.id] ?? 40;
        return (
          <button key={`lab-${p.id}`} onClick={() => setInfo({ title: p.name, subtitle: `${fmtYear(p.startYear)} – ${fmtYear(p.endYear)} · ${p.region}`, body: p.blurb, tag: p.kind })}
            className="absolute z-[6] -translate-x-1/2 whitespace-nowrap text-center transition hover:scale-105" style={{ left: cx, top: cy, transform: `translate(-50%, ${cy < cy0 ? "-100%" : "0"})` }}>
            <div className="font-serif text-[13px] tracking-wide" style={{ color: `hsl(${h},58%,84%)`, textShadow: "0 1px 12px rgba(0,0,0,0.95)" }}>{p.name}</div>
            <div className="text-[9px] tracking-[0.15em] text-white/40">{fmtYear(p.startYear)}–{fmtYear(p.endYear)}</div>
          </button>
        );
      })()))}

      {/* artist nodes */}
      {layout.map(({ a, bx, by, hue }) => {
        const cx = bx * zoom + offset; if (cx < -80 || cx > size.w + 80) return null;
        const hasMuseum = artistsWithWorks.has(a.id);
        const enter = () => hasMuseum ? router.push(`/museum/${a.slug}`) : setInfo({ title: a.name, subtitle: `${a.life} · ${a.nationality}`, body: a.bio, image: artistDisc[a.id], tag: "Artist" });
        if (!showMedallions) return (
          <button key={a.id} onClick={enter} onMouseEnter={() => setHoverArtist(a)} className="absolute z-[7] -translate-x-1/2 -translate-y-1/2" style={{ left: cx, top: by }}>
            <span className="block rounded-full" style={{ width: hasMuseum ? 7 : 5, height: hasMuseum ? 7 : 5, background: hasMuseum ? "#e7cf9b" : `hsla(${hue},80%,80%,0.85)`, boxShadow: hasMuseum ? "0 0 10px 2px rgba(231,207,155,0.7)" : `0 0 8px hsla(${hue},80%,70%,0.6)` }} />
          </button>
        );
        const disc = artistDisc[a.id];
        return (
          <button key={a.id} onClick={enter} onMouseEnter={() => setHoverArtist(a)} className="group absolute z-[8] -translate-x-1/2 -translate-y-1/2" style={{ left: cx, top: by }} title={a.name}>
            <span className="block overflow-hidden rounded-full transition-transform duration-200 group-hover:scale-[1.18]" style={{ width: D, height: D, border: `2px solid ${hasMuseum ? "#c8a45c" : `hsla(${hue},50%,70%,0.6)`}`, boxShadow: hasMuseum ? "0 0 14px rgba(200,164,92,0.4)" : "0 4px 12px rgba(0,0,0,0.6)", background: "#14171d" }}>
              {disc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={disc} alt={a.name} loading="lazy" className="h-full w-full object-cover" onError={(e) => (e.currentTarget.style.opacity = "0")} />
              ) : (<span className="grid h-full w-full place-items-center font-serif text-sm" style={{ color: `hsl(${hue},55%,80%)` }}>{a.name.split(" ").slice(-1)[0][0]}</span>)}
            </span>
          </button>
        );
      })}

      {/* hover card */}
      {hoverArtist && (() => {
        const node = layout.find((l) => l.a.id === hoverArtist.id);
        const cx = node ? node.bx * zoom + offset : -999; if (cx < -200 || cx > size.w + 200) return null;
        const above = hoverArtist.axis === "world", hasMuseum = artistsWithWorks.has(hoverArtist.id), disc = artistDisc[hoverArtist.id];
        const works = worksByArtist[hoverArtist.id] ?? [], cardLeft = Math.max(12, Math.min(size.w - 284, cx - 132));
        return (
          <div onMouseLeave={() => setHoverArtist(null)} className="absolute z-[15] w-[268px] animate-fadeUp rounded-xl border border-white/10 bg-ink/95 p-4 shadow-2xl backdrop-blur-xl" style={{ left: cardLeft, top: above ? Math.max(8, cy0 - 320) : cy0 + 70 }}>
            <div className="flex items-center gap-3">
              {disc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={disc} alt={hoverArtist.name} className="h-12 w-12 rounded-full object-cover ring-1 ring-gold/40" />
              ) : (<span className={`grid h-12 w-12 place-items-center rounded-full text-sm font-semibold ${above ? "bg-world/25 text-world" : "bg-india/25 text-india"}`}>{hoverArtist.name.split(" ").slice(-1)[0][0]}</span>)}
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
              ) : (<span className="flex-1 rounded-full border border-white/10 px-3 py-1.5 text-center text-[11px] text-white/40">Biography</span>)}
              <button onClick={() => setInfo({ title: hoverArtist.name, subtitle: `${hoverArtist.life} · ${hoverArtist.nationality}`, body: hoverArtist.bio, image: disc, tag: "Artist" })} className="rounded-full border border-white/15 px-3 py-1.5 text-[12px] text-white/70 transition hover:border-gold hover:text-gold">Read</button>
            </div>
          </div>
        );
      })()}

      {/* axis captions */}
      <div className="pointer-events-none absolute left-4 top-4 z-10 font-serif text-xs uppercase tracking-[0.3em] text-world/70">World Art</div>
      <div className="pointer-events-none absolute bottom-4 left-4 z-10 font-serif text-xs uppercase tracking-[0.3em] text-india/80">Indian Art</div>

      {/* zoom controls */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
        <button onClick={() => zoomAround(size.w / 2, 1 / 1.4)} className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/50 text-lg text-ivory backdrop-blur hover:border-gold" aria-label="Zoom out">−</button>
        <button onClick={() => zoomAround(size.w / 2, 1.4)} className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/50 text-lg text-ivory backdrop-blur hover:border-gold" aria-label="Zoom in">+</button>
      </div>
      <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 hidden -translate-x-1/2 text-center text-[11px] text-white/30 sm:block">drag to pan · scroll · ⌘/Ctrl-scroll to zoom · hover an artist · gold rings open a walkable museum</div>
    </div>
  );
}

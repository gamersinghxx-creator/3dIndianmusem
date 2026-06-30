"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Artist, Artwork, Period } from "@/lib/data/types";
import type { ImageMeta } from "@/lib/img";
import { artImage } from "@/lib/img";
import { useMuseum } from "@/lib/store";

const YEAR_MIN = -3300;
const YEAR_MAX = 2000;
const SPAN = YEAR_MAX - YEAR_MIN;

interface Props {
  periods: Period[];
  artists: Artist[];
  artworks: Artwork[];
  images: Record<string, ImageMeta>;
  portraits: Record<string, string | undefined>;
  artistsWithWorks: Set<string>;
}

const fmtYear = (y: number) => (y < 0 ? `${Math.abs(y)} BCE` : `${y} CE`);

// deterministic hash + PRNG (so server/client positions match — no hydration drift)
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export default function TimeRiver({
  periods,
  artists,
  artworks,
  images,
  portraits,
  artistsWithWorks,
}: Props) {
  const router = useRouter();
  const inspect = useMuseum((s) => s.inspect);

  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1200, h: 600 });
  const fitZoom = useMemo(() => (size.w * 1.55) / SPAN, [size.w]);
  const [zoom, setZoom] = useState(0.22);
  const [offset, setOffset] = useState(40);
  const [hoverArtist, setHoverArtist] = useState<Artist | null>(null);

  // ── derived lookups ───────────────────────────────────────────────────────
  const periodName = useMemo(() => Object.fromEntries(periods.map((p) => [p.id, p.name])), [periods]);
  const workCount = useMemo(() => {
    const m: Record<string, number> = {};
    artworks.forEach((w) => (m[w.artistId] = (m[w.artistId] || 0) + 1));
    return m;
  }, [artworks]);
  const worksByArtist = useMemo(() => {
    const m: Record<string, Artwork[]> = {};
    artworks.forEach((w) => (m[w.artistId] ||= []).push(w));
    return m;
  }, [artworks]);
  const artistDisc = useMemo(() => {
    // a circular image for each artist: portrait → first artwork → none
    const m: Record<string, string | undefined> = {};
    artists.forEach((a) => {
      const w = worksByArtist[a.id]?.[0];
      m[a.id] = portraits[a.id] || (w ? artImage(w, images[w.id], 200) : undefined);
    });
    return m;
  }, [artists, worksByArtist, images, portraits]);

  // hue per period, spread across the spectrum like a nebula field
  const periodHue = useMemo(() => {
    const sorted = [...periods].sort((a, b) => a.startYear - b.startYear);
    const m: Record<string, number> = {};
    sorted.forEach((p, i) => (m[p.id] = Math.round(8 + i * (330 / Math.max(1, sorted.length - 1)))));
    return m;
  }, [periods]);

  // ── viewport / interaction ────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    setZoom(fitZoom);
    setOffset(40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitZoom > 0 ? Math.round(fitZoom * 1000) : 0]);

  const zoomAround = useCallback(
    (screenX: number, factor: number) => {
      setZoom((z) => {
        const nz = Math.max(fitZoom * 0.9, Math.min(8, z * factor));
        setOffset((o) => {
          const yearUnder = (screenX - o) / z + YEAR_MIN;
          const no = screenX - (yearUnder - YEAR_MIN) * nz;
          const min = Math.min(40, size.w - SPAN * nz - 140);
          return Math.max(min, Math.min(140, no));
        });
        return nz;
      });
    },
    [fitZoom, size.w]
  );
  const clampOffset = useCallback(
    (o: number) => Math.max(Math.min(40, size.w - SPAN * zoom - 140), Math.min(140, o)),
    [size.w, zoom]
  );
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > Math.abs(e.deltaX))
        zoomAround(e.clientX - rect.left, e.deltaY < 0 ? 1.12 : 1 / 1.12);
      else setOffset((o) => clampOffset(o - e.deltaX));
    },
    [zoomAround, clampOffset]
  );
  const drag = useRef<{ x: number; o: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, o: offset };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => drag.current && setOffset(clampOffset(drag.current.o + (e.clientX - drag.current.x)));
  const onUp = () => (drag.current = null);

  const x = (year: number) => (year - YEAR_MIN) * zoom + offset;
  const cy0 = size.h / 2;

  // ── progressive disclosure thresholds ─────────────────────────────────────
  const showMedallions = zoom > fitZoom * 1.7;
  const showNames = zoom > fitZoom * 2.6;

  // ── artist layout (constellation positions) ───────────────────────────────
  const layout = useMemo(() => {
    return artists.map((a) => {
      const band = a.axis === "world" ? -1 : 1;
      const r = rng(hash(a.id));
      const tier = Math.floor(r() * 4); // 0..3
      const off = 96 + tier * 34 + r() * 16; // 96..210 px from axis
      return { a, cx: x(a.year), cy: cy0 + band * off, hue: periodHue[a.periodId] ?? 40 };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artists, zoom, offset, size.h, periodHue]);

  // constellation polylines, grouped by period (sorted by year)
  const constellations = useMemo(() => {
    const groups: Record<string, { x: number; y: number }[]> = {};
    [...layout]
      .sort((p, q) => p.a.year - q.a.year)
      .forEach((n) => (groups[n.a.periodId] ||= []).push({ x: n.cx, y: n.cy }));
    return Object.entries(groups).map(([pid, pts]) => ({ pid, pts, hue: periodHue[pid] ?? 40 }));
  }, [layout, periodHue]);

  // starfield (deterministic)
  const stars = useMemo(() => {
    const r = rng(98765);
    return Array.from({ length: 130 }, () => ({ x: r(), y: r(), s: r() * 1.6 + 0.3, o: r() * 0.45 + 0.08 }));
  }, []);

  const ticks = useMemo(() => {
    const step = zoom > 1.2 ? 100 : zoom > 0.5 ? 250 : 500;
    const out: number[] = [];
    for (let y = Math.ceil(YEAR_MIN / step) * step; y <= YEAR_MAX; y += step) out.push(y);
    return out;
  }, [zoom]);

  return (
    <div
      ref={containerRef}
      onWheel={onWheel}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      className="relative h-full w-full cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing"
      style={{ background: "radial-gradient(130% 130% at 50% 45%, #0e1016 0%, #07080b 55%, #050507 100%)" }}
    >
      {/* starfield */}
      <div className="pointer-events-none absolute inset-0">
        {stars.map((s, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white"
            style={{ left: s.x * size.w, top: s.y * size.h, width: s.s, height: s.s, opacity: s.o }}
          />
        ))}
      </div>

      {/* era nebulae */}
      {periods.map((p) => {
        const cx = x((p.startYear + p.endYear) / 2);
        const wpx = Math.min(960, Math.max(300, (p.endYear - p.startYear) * zoom * 1.25));
        if (cx + wpx / 2 < -40 || cx - wpx / 2 > size.w + 40) return null;
        const band = p.axis === "world" ? -1 : 1;
        const cy = cy0 + band * 150;
        const h = periodHue[p.id] ?? 40;
        return (
          <div key={`neb-${p.id}`} className="pointer-events-none absolute" style={{ left: cx, top: cy, transform: "translate(-50%,-50%)" }}>
            <div
              style={{
                width: wpx,
                height: wpx * 0.74,
                borderRadius: "50%",
                background: `radial-gradient(closest-side, hsla(${h},70%,55%,0.30), hsla(${h},70%,45%,0.12) 55%, transparent 72%)`,
                filter: "blur(42px)",
                mixBlendMode: "screen",
              }}
            />
          </div>
        );
      })}

      {/* center axis */}
      <div className="pointer-events-none absolute left-0 right-0" style={{ top: cy0 }}>
        <div className="h-px w-full" style={{ background: "linear-gradient(90deg,transparent,rgba(200,164,92,0.5),transparent)" }} />
      </div>

      {/* century ticks */}
      {ticks.map((y) => {
        const px = x(y);
        if (px < -40 || px > size.w + 40) return null;
        return (
          <div key={y} className="pointer-events-none absolute -translate-x-1/2 text-[10px] tracking-wider text-white/25" style={{ left: px, top: cy0 - 7 }}>
            {fmtYear(y)}
          </div>
        );
      })}

      {/* constellation lines + star dots */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        {constellations.map(({ pid, pts, hue }) => (
          <g key={`c-${pid}`}>
            {pts.length > 1 && (
              <polyline
                points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke={`hsla(${hue},75%,72%,0.22)`}
                strokeWidth={1}
              />
            )}
            {pts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={1.6} fill={`hsla(${hue},80%,80%,0.7)`} />
            ))}
          </g>
        ))}
      </svg>

      {/* era labels (serif) */}
      {periods.map((p) => {
        const cx = x((p.startYear + p.endYear) / 2);
        if (cx < -120 || cx > size.w + 120) return null;
        const band = p.axis === "world" ? -1 : 1;
        const cy = cy0 + band * 150;
        const h = periodHue[p.id] ?? 40;
        return (
          <button
            key={`lab-${p.id}`}
            onClick={() => window.open(p.wikipedia, "_blank")}
            className="absolute z-[5] -translate-x-1/2 -translate-y-1/2 text-center transition hover:scale-105"
            style={{ left: cx, top: cy }}
          >
            <div className="whitespace-nowrap font-serif text-[15px] tracking-wide" style={{ color: `hsl(${h},60%,82%)`, textShadow: "0 2px 14px rgba(0,0,0,0.8)" }}>
              {p.name}
            </div>
            <div className="text-[10px] tracking-[0.2em] text-white/40">
              {fmtYear(p.startYear)} – {fmtYear(p.endYear)}
            </div>
          </button>
        );
      })}

      {/* artist nodes */}
      {layout.map(({ a, cx, cy, hue }) => {
        if (cx < -80 || cx > size.w + 80) return null;
        const hasMuseum = artistsWithWorks.has(a.id);
        const disc = artistDisc[a.id];
        const enter = () => (hasMuseum ? router.push(`/museum/${a.slug}`) : window.open(a.wikipedia, "_blank"));
        if (!showMedallions) {
          // overview: just a glowing dot
          return (
            <button
              key={a.id}
              onClick={enter}
              onMouseEnter={() => setHoverArtist(a)}
              className="absolute z-[7] -translate-x-1/2 -translate-y-1/2"
              style={{ left: cx, top: cy }}
            >
              <span
                className="block rounded-full"
                style={{
                  width: hasMuseum ? 7 : 5,
                  height: hasMuseum ? 7 : 5,
                  background: hasMuseum ? "#e7cf9b" : `hsla(${hue},80%,80%,0.85)`,
                  boxShadow: hasMuseum ? "0 0 10px 2px rgba(231,207,155,0.7)" : `0 0 8px hsla(${hue},80%,70%,0.6)`,
                }}
              />
            </button>
          );
        }
        // zoomed: portrait medallion
        const d = 56;
        return (
          <button
            key={a.id}
            onClick={enter}
            onMouseEnter={() => setHoverArtist(a)}
            className="group absolute z-[8] -translate-x-1/2 -translate-y-1/2"
            style={{ left: cx, top: cy }}
          >
            <span
              className="block overflow-hidden rounded-full transition-transform duration-200 group-hover:scale-110"
              style={{
                width: d,
                height: d,
                border: `2px solid ${hasMuseum ? "#c8a45c" : `hsla(${hue},50%,70%,0.6)`}`,
                boxShadow: hasMuseum ? "0 0 16px rgba(200,164,92,0.45)" : "0 4px 14px rgba(0,0,0,0.6)",
                background: "#14171d",
              }}
            >
              {disc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={disc} alt={a.name} loading="lazy" className="h-full w-full object-cover" onError={(e) => (e.currentTarget.style.opacity = "0")} />
              ) : (
                <span className="grid h-full w-full place-items-center font-serif text-base" style={{ color: `hsl(${hue},55%,80%)` }}>
                  {a.name.split(" ").slice(-1)[0][0]}
                </span>
              )}
            </span>
            {showNames && (
              <span className="mt-1 block w-28 -translate-x-1/2 translate-x-[28px] text-center text-[10px] leading-tight text-white/70">
                <span className="block truncate">{a.name}</span>
                <span className="text-white/35">{a.life}</span>
              </span>
            )}
          </button>
        );
      })}

      {/* artist hover card */}
      {hoverArtist &&
        (() => {
          const left = x(hoverArtist.year);
          if (left < -200 || left > size.w + 200) return null;
          const above = hoverArtist.axis === "world";
          const hasMuseum = artistsWithWorks.has(hoverArtist.id);
          const disc = artistDisc[hoverArtist.id];
          const works = worksByArtist[hoverArtist.id] ?? [];
          const cardLeft = Math.max(12, Math.min(size.w - 284, left - 132));
          return (
            <div
              onMouseLeave={() => setHoverArtist(null)}
              className="absolute z-[15] w-[268px] animate-fadeUp rounded-xl border border-white/10 bg-ink/95 p-4 shadow-2xl backdrop-blur-xl"
              style={{ left: cardLeft, top: above ? cy0 - 300 : cy0 + 80 }}
            >
              <div className="flex items-center gap-3">
                {disc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={disc} alt={hoverArtist.name} className="h-12 w-12 rounded-full object-cover ring-1 ring-gold/40" />
                ) : (
                  <span className={`grid h-12 w-12 place-items-center rounded-full text-sm font-semibold ${above ? "bg-world/25 text-world" : "bg-india/25 text-india"}`}>
                    {hoverArtist.name.split(" ").slice(-1)[0][0]}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-serif text-base text-ivory">{hoverArtist.name}</p>
                  <p className="text-[11px] text-gold/80">{hoverArtist.life}</p>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-white/45">
                {periodName[hoverArtist.periodId]} · {hoverArtist.nationality}
                {workCount[hoverArtist.id] ? ` · ${workCount[hoverArtist.id]} works` : ""}
              </p>
              <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-white/70">{hoverArtist.bio}</p>
              {works.length > 0 && (
                <div className="mt-3 flex gap-1.5 overflow-x-auto">
                  {works.slice(0, 4).map((w) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={w.id}
                      src={artImage(w, images[w.id], 160)}
                      alt={w.title}
                      onClick={() => inspect(w)}
                      className="h-12 w-12 flex-none cursor-pointer rounded object-cover ring-1 ring-white/10 transition hover:ring-gold"
                      onError={(e) => (e.currentTarget.style.display = "none")}
                    />
                  ))}
                </div>
              )}
              <div className="mt-3 flex gap-2">
                {hasMuseum ? (
                  <button onClick={() => router.push(`/museum/${hoverArtist.slug}`)} className="flex-1 rounded-full bg-gold px-3 py-1.5 text-[12px] font-medium text-ink transition hover:bg-goldsoft">
                    Enter museum →
                  </button>
                ) : (
                  <span className="flex-1 rounded-full border border-white/10 px-3 py-1.5 text-center text-[11px] text-white/40">Biography</span>
                )}
                <button onClick={() => window.open(hoverArtist.wikipedia, "_blank")} className="rounded-full border border-white/15 px-3 py-1.5 text-[12px] text-white/70 transition hover:border-gold hover:text-gold">
                  Wiki ↗
                </button>
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
      <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 hidden -translate-x-1/2 text-center text-[11px] text-white/30 sm:block">
        {showMedallions ? "drag to pan · scroll to move · gold rings are walkable museums" : "scroll / pinch to zoom into an era · drag to pan"}
      </div>
    </div>
  );
}

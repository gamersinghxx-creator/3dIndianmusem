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

function fmtYear(y: number): string {
  if (y < 0) return `${Math.abs(y)} BCE`;
  return `${y} CE`;
}

// Greedy lane packing so period bands don't overlap.
function packLanes<T extends { startYear: number; endYear: number }>(
  items: T[],
  zoom: number,
  minPx = 90
): (T & { lane: number })[] {
  const sorted = [...items].sort((a, b) => a.startYear - b.startYear);
  const laneEnds: number[] = [];
  return sorted.map((it) => {
    const startX = (it.startYear - YEAR_MIN) * zoom;
    const endX = Math.max((it.endYear - YEAR_MIN) * zoom, startX + minPx);
    let lane = laneEnds.findIndex((e) => e < startX - 6);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(endX);
    } else {
      laneEnds[lane] = endX;
    }
    return { ...it, lane };
  });
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
  const [width, setWidth] = useState(1200);
  const fitZoom = useMemo(() => (width * 1.6) / SPAN, [width]);
  const [zoom, setZoom] = useState(0.22);
  const [offset, setOffset] = useState(40);
  const [hover, setHover] = useState<string | null>(null);
  const [hoverArtist, setHoverArtist] = useState<Artist | null>(null);

  const periodName = useMemo(() => {
    const m: Record<string, string> = {};
    periods.forEach((p) => (m[p.id] = p.name));
    return m;
  }, [periods]);
  const workCount = useMemo(() => {
    const m: Record<string, number> = {};
    artworks.forEach((w) => (m[w.artistId] = (m[w.artistId] || 0) + 1));
    return m;
  }, [artworks]);

  // Initialise zoom to fit once we know the width.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setZoom(fitZoom);
    setOffset(40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitZoom > 0 ? Math.round(fitZoom * 1000) : 0]);

  const trackWidth = SPAN * zoom;
  const clampOffset = useCallback(
    (o: number) => {
      const min = Math.min(40, width - trackWidth - 120);
      const max = 120;
      return Math.max(min, Math.min(max, o));
    },
    [width, trackWidth]
  );

  const zoomAround = useCallback(
    (screenX: number, factor: number) => {
      setZoom((z) => {
        const nz = Math.max(fitZoom * 0.9, Math.min(6, z * factor));
        setOffset((o) => {
          const yearUnder = (screenX - o) / z + YEAR_MIN;
          const no = screenX - (yearUnder - YEAR_MIN) * nz;
          const min = Math.min(40, width - SPAN * nz - 120);
          return Math.max(min, Math.min(120, no));
        });
        return nz;
      });
    },
    [fitZoom, width]
  );

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        zoomAround(e.clientX - rect.left, factor);
      } else {
        setOffset((o) => clampOffset(o - e.deltaX));
      }
    },
    [zoomAround, clampOffset]
  );

  // Drag to pan (also works for touch via pointer events)
  const drag = useRef<{ x: number; o: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, o: offset };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setOffset(clampOffset(drag.current.o + (e.clientX - drag.current.x)));
  };
  const onPointerUp = () => (drag.current = null);

  const x = (year: number) => (year - YEAR_MIN) * zoom + offset;

  const worldPeriods = useMemo(
    () => packLanes(periods.filter((p) => p.axis === "world"), zoom),
    [periods, zoom]
  );
  const indiaPeriods = useMemo(
    () => packLanes(periods.filter((p) => p.axis === "india"), zoom),
    [periods, zoom]
  );

  const ticks = useMemo(() => {
    const step = zoom > 1.2 ? 100 : zoom > 0.5 ? 200 : 500;
    const out: number[] = [];
    const first = Math.ceil(YEAR_MIN / step) * step;
    for (let y = first; y <= YEAR_MAX; y += step) out.push(y);
    return out;
  }, [zoom]);

  const laneH = 30;
  const showLabels = zoom > 0.18;

  return (
    <div
      ref={containerRef}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      className="relative h-full w-full cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing"
      style={{
        background:
          "radial-gradient(120% 120% at 50% 50%, #14171d 0%, #0b0c10 70%)",
      }}
    >
      {/* center axis */}
      <div className="pointer-events-none absolute left-0 right-0" style={{ top: "50%" }}>
        <div className="h-px w-full hairline" />
      </div>

      {/* axis labels */}
      <div className="pointer-events-none absolute left-4 top-4 z-10 text-xs uppercase tracking-[0.3em] text-world/80">
        World Art
      </div>
      <div className="pointer-events-none absolute bottom-4 left-4 z-10 text-xs uppercase tracking-[0.3em] text-india/90">
        Indian Art
      </div>

      {/* gridlines + year labels */}
      {ticks.map((y) => {
        const px = x(y);
        if (px < -60 || px > width + 60) return null;
        return (
          <div key={y} className="pointer-events-none absolute top-0 bottom-0" style={{ left: px }}>
            <div className="h-full w-px bg-white/5" />
            <div
              className="absolute -translate-x-1/2 text-[10px] text-white/35"
              style={{ top: "calc(50% - 8px)" }}
            >
              {fmtYear(y)}
            </div>
          </div>
        );
      })}

      {/* WORLD period bands (above axis) */}
      {worldPeriods.map((p) => {
        const left = x(p.startYear);
        const w = Math.max((p.endYear - p.startYear) * zoom, 84);
        if (left + w < -40 || left > width + 40) return null;
        const top = `calc(50% - ${56 + p.lane * laneH}px)`;
        return (
          <button
            key={p.id}
            onClick={() => window.open(p.wikipedia, "_blank")}
            onMouseEnter={() => setHover(p.id)}
            onMouseLeave={() => setHover(null)}
            className="absolute z-[6] flex items-center rounded-md border border-world/30 bg-world/10 px-2 text-left text-[11px] text-world/90 backdrop-blur-sm transition hover:border-world/70 hover:bg-world/20"
            style={{ left, width: w, top, height: laneH - 6 }}
            title={`${p.name} · ${fmtYear(p.startYear)} – ${fmtYear(p.endYear)}`}
          >
            <span className="truncate">{p.name}</span>
          </button>
        );
      })}

      {/* INDIA period bands (below axis) */}
      {indiaPeriods.map((p) => {
        const left = x(p.startYear);
        const w = Math.max((p.endYear - p.startYear) * zoom, 84);
        if (left + w < -40 || left > width + 40) return null;
        const top = `calc(50% + ${30 + p.lane * laneH}px)`;
        return (
          <button
            key={p.id}
            onClick={() => window.open(p.wikipedia, "_blank")}
            onMouseEnter={() => setHover(p.id)}
            onMouseLeave={() => setHover(null)}
            className="absolute z-[6] flex items-center rounded-md border border-india/40 bg-india/10 px-2 text-left text-[11px] text-india backdrop-blur-sm transition hover:border-india/80 hover:bg-india/25"
            style={{ left, width: w, top, height: laneH - 6 }}
            title={`${p.name} · ${fmtYear(p.startYear)} – ${fmtYear(p.endYear)}`}
          >
            <span className="truncate">{p.name}</span>
          </button>
        );
      })}

      {/* ARTWORK markers (framed thumbnails near the axis) */}
      {artworks.map((w) => {
        const left = x(w.year);
        if (left < -60 || left > width + 60) return null;
        const above = w.axis === "world";
        const top = above ? "calc(50% - 30px)" : "calc(50% + 6px)";
        const isHover = hover === w.id;
        return (
          <button
            key={w.id}
            onClick={() => inspect(w)}
            onMouseEnter={() => setHover(w.id)}
            onMouseLeave={() => setHover(null)}
            className="group absolute z-[8] -translate-x-1/2"
            style={{ left, top }}
            title={w.title}
          >
            <span
              className={`block h-6 w-6 overflow-hidden rounded-[3px] border shadow-md transition-all duration-200 ${
                isHover ? "scale-[2.6] border-gold" : "border-white/30 group-hover:border-gold/70"
              }`}
              style={{ transformOrigin: above ? "bottom center" : "top center" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={artImage(w, images[w.id], 200)}
                alt={w.title}
                loading="lazy"
                className="h-full w-full object-cover"
                onError={(e) => (e.currentTarget.style.opacity = "0")}
              />
            </span>
            {isHover && (
              <span
                className="absolute left-1/2 z-20 w-40 -translate-x-1/2 rounded bg-black/85 px-2 py-1 text-[10px] leading-tight text-ivory shadow-lg"
                style={{ top: above ? "-46px" : "70px" }}
              >
                <strong className="text-gold">{w.title}</strong>
                <br />
                {w.date}
              </span>
            )}
          </button>
        );
      })}

      {/* ARTIST markers (dots on the axis) */}
      {artists.map((a) => {
        const left = x(a.year);
        if (left < -40 || left > width + 40) return null;
        const hasMuseum = artistsWithWorks.has(a.id);
        const above = a.axis === "world";
        return (
          <button
            key={a.id}
            onClick={() =>
              hasMuseum ? router.push(`/museum/${a.slug}`) : window.open(a.wikipedia, "_blank")
            }
            onMouseEnter={() => {
              setHover(a.id);
              setHoverArtist(a);
            }}
            onMouseLeave={() => setHover(null)}
            className="absolute z-[7] -translate-x-1/2 -translate-y-1/2"
            style={{ left, top: "50%" }}
          >
            <span
              className={`block h-2.5 w-2.5 rounded-full border transition ${
                hasMuseum
                  ? "border-gold bg-gold pulse-glow"
                  : above
                    ? "border-world bg-world/40"
                    : "border-india bg-india/40"
              }`}
            />
            {showLabels && (
              <span
                className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-white/55"
                style={{ top: above ? "-18px" : "8px" }}
              >
                {a.name}
              </span>
            )}
          </button>
        );
      })}

      {/* artist hover card */}
      {hoverArtist &&
        (() => {
          const left = x(hoverArtist.year);
          if (left < -200 || left > width + 200) return null;
          const above = hoverArtist.axis === "world";
          const hasMuseum = artistsWithWorks.has(hoverArtist.id);
          const portrait = portraits[hoverArtist.id];
          const cardLeft = Math.max(12, Math.min(width - 272, left - 130));
          return (
            <div
              onMouseLeave={() => setHoverArtist(null)}
              className="absolute z-[15] w-[260px] animate-fadeUp rounded-xl border border-white/10 bg-ink/95 p-4 shadow-2xl backdrop-blur-xl"
              style={{
                left: cardLeft,
                top: above ? "calc(50% - 250px)" : "calc(50% + 70px)",
              }}
            >
              <div className="flex items-center gap-3">
                {portrait ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={portrait} alt={hoverArtist.name} className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <span
                    className={`grid h-12 w-12 place-items-center rounded-full text-sm font-semibold ${
                      above ? "bg-world/25 text-world" : "bg-india/25 text-india"
                    }`}
                  >
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
              <p className="mt-2 line-clamp-4 text-[12px] leading-relaxed text-white/70">
                {hoverArtist.bio}
              </p>
              <div className="mt-3 flex gap-2">
                {hasMuseum ? (
                  <button
                    onClick={() => router.push(`/museum/${hoverArtist.slug}`)}
                    className="flex-1 rounded-full bg-gold px-3 py-1.5 text-[12px] font-medium text-ink transition hover:bg-goldsoft"
                  >
                    Enter museum →
                  </button>
                ) : (
                  <span className="flex-1 rounded-full border border-white/10 px-3 py-1.5 text-center text-[11px] text-white/40">
                    Biography
                  </span>
                )}
                <button
                  onClick={() => window.open(hoverArtist.wikipedia, "_blank")}
                  className="rounded-full border border-white/15 px-3 py-1.5 text-[12px] text-white/70 transition hover:border-gold hover:text-gold"
                >
                  Wiki ↗
                </button>
              </div>
            </div>
          );
        })()}

      {/* zoom controls */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
        <button
          onClick={() => zoomAround(width / 2, 1 / 1.4)}
          className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/50 text-lg text-ivory backdrop-blur hover:border-gold"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          onClick={() => zoomAround(width / 2, 1.4)}
          className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/50 text-lg text-ivory backdrop-blur hover:border-gold"
          aria-label="Zoom in"
        >
          +
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 hidden -translate-x-1/2 text-center text-[11px] text-white/30 sm:block">
        drag to pan · scroll to move · ⌘/Ctrl-scroll to zoom · gold dots are walkable museums
      </div>
    </div>
  );
}

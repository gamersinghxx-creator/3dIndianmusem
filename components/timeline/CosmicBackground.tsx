"use client";
import { useEffect, useRef } from "react";

/**
 * Immersive, performant deep-space background on a single canvas:
 *  - three parallax star layers (different depths) that drift with the timeline
 *    pan and with slow autonomous motion,
 *  - continuous per-star twinkle,
 *  - occasional shooting stars,
 *  - softly drifting nebulae (additive glow) behind the stars.
 * Respects prefers-reduced-motion. `getPan` lets the loop read the live timeline
 * pan offset (px) without triggering React re-renders.
 */
export default function CosmicBackground({ getPan }: { getPan?: () => number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    type Star = { x: number; y: number; r: number; a: number; tw: number; ph: number; depth: number; hue: number };
    type Neb = { x: number; y: number; r: number; hue: number; ax: number; ay: number; ph: number };
    type Shoot = { x: number; y: number; vx: number; vy: number; life: number; max: number };
    let stars: Star[] = [];
    let nebulae: Neb[] = [];
    let shoots: Shoot[] = [];

    function build() {
      const rect = canvas!.getBoundingClientRect();
      W = rect.width; H = rect.height;
      canvas!.width = Math.floor(W * dpr);
      canvas!.height = Math.floor(H * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const layers = [
        { n: Math.round((W * H) / 9000), depth: 0.04, rs: [0.4, 0.9], as: [0.25, 0.55], tw: [0.4, 1.0] },
        { n: Math.round((W * H) / 14000), depth: 0.09, rs: [0.7, 1.4], as: [0.4, 0.8], tw: [0.5, 1.4] },
        { n: Math.round((W * H) / 26000), depth: 0.17, rs: [1.0, 2.0], as: [0.6, 1.0], tw: [0.6, 1.8] },
      ];
      stars = [];
      for (const L of layers)
        for (let i = 0; i < L.n; i++)
          stars.push({
            x: Math.random() * W, y: Math.random() * H, r: rand(L.rs[0], L.rs[1]), a: rand(L.as[0], L.as[1]),
            tw: rand(L.tw[0], L.tw[1]), ph: Math.random() * Math.PI * 2, depth: L.depth,
            hue: Math.random() < 0.16 ? rand(20, 50) : rand(190, 230),
          });
      nebulae = [
        { x: W * 0.22, y: H * 0.32, r: Math.max(W, H) * 0.34, hue: 265, ax: 26, ay: 18, ph: 0 },
        { x: W * 0.74, y: H * 0.6, r: Math.max(W, H) * 0.4, hue: 200, ax: 34, ay: 22, ph: 2 },
        { x: W * 0.5, y: H * 0.5, r: Math.max(W, H) * 0.3, hue: 28, ax: 20, ay: 16, ph: 4 },
      ];
    }

    const mod = (v: number, m: number) => ((v % m) + m) % m;
    let raf = 0, start = performance.now();

    function frame(now: number) {
      const t = (now - start) / 1000;
      const pan = getPan ? getPan() : 0;
      ctx!.fillStyle = "#050507";
      ctx!.fillRect(0, 0, W, H);

      ctx!.globalCompositeOperation = "lighter";
      for (const nb of nebulae) {
        const nx = nb.x + Math.sin(t * 0.05 + nb.ph) * nb.ax - pan * 0.02;
        const ny = nb.y + Math.cos(t * 0.04 + nb.ph) * nb.ay;
        const g = ctx!.createRadialGradient(nx, ny, 0, nx, ny, nb.r);
        g.addColorStop(0, `hsla(${nb.hue},70%,55%,0.17)`);
        g.addColorStop(0.5, `hsla(${nb.hue},70%,45%,0.05)`);
        g.addColorStop(1, "hsla(0,0%,0%,0)");
        ctx!.fillStyle = g;
        ctx!.fillRect(nx - nb.r, ny - nb.r, nb.r * 2, nb.r * 2);
      }

      for (const s of stars) {
        const drift = reduce ? 0 : t * s.depth * 2;
        const x = mod(s.x - pan * s.depth - drift, W);
        const tw = reduce ? 1 : 0.55 + 0.45 * Math.sin(t * s.tw + s.ph);
        const a = s.a * tw;
        if (s.r > 1.1) {
          const g = ctx!.createRadialGradient(x, s.y, 0, x, s.y, s.r * 3);
          g.addColorStop(0, `hsla(${s.hue},90%,88%,${a})`);
          g.addColorStop(1, "hsla(0,0%,0%,0)");
          ctx!.fillStyle = g;
          ctx!.fillRect(x - s.r * 3, s.y - s.r * 3, s.r * 6, s.r * 6);
        } else {
          ctx!.fillStyle = `hsla(${s.hue},80%,90%,${a})`;
          ctx!.fillRect(x, s.y, s.r, s.r);
        }
      }

      if (!reduce) {
        if (Math.random() < 0.006 && shoots.length < 2) {
          const fromLeft = Math.random() < 0.5;
          const sp = rand(7, 12);
          shoots.push({ x: fromLeft ? rand(0, W * 0.4) : rand(W * 0.6, W), y: rand(0, H * 0.5), vx: (fromLeft ? 1 : -1) * sp, vy: sp * 0.5, life: 0, max: rand(40, 70) });
        }
        ctx!.lineCap = "round";
        shoots = shoots.filter((sh) => sh.life < sh.max);
        for (const sh of shoots) {
          sh.x += sh.vx; sh.y += sh.vy; sh.life++;
          const k = 1 - sh.life / sh.max;
          const tx = sh.x - sh.vx * 6, ty = sh.y - sh.vy * 6;
          const g = ctx!.createLinearGradient(tx, ty, sh.x, sh.y);
          g.addColorStop(0, "hsla(210,90%,90%,0)");
          g.addColorStop(1, `hsla(210,90%,92%,${0.8 * k})`);
          ctx!.strokeStyle = g; ctx!.lineWidth = 2;
          ctx!.beginPath(); ctx!.moveTo(tx, ty); ctx!.lineTo(sh.x, sh.y); ctx!.stroke();
        }
      }

      ctx!.globalCompositeOperation = "source-over";
      if (!reduce) raf = requestAnimationFrame(frame);
    }

    build();
    if (reduce) frame(start);
    else raf = requestAnimationFrame(frame);

    const onResize = () => { dpr = Math.min(window.devicePixelRatio || 1, 2); build(); };
    window.addEventListener("resize", onResize);
    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else if (!reduce) { start = performance.now(); raf = requestAnimationFrame(frame); }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [getPan]);

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" />;
}

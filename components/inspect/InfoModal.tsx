"use client";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMuseum } from "@/lib/store";

/** In-app reading panel for eras and artist biographies (no external links). */
export default function InfoModal() {
  const info = useMuseum((s) => s.info);
  const setInfo = useMuseum((s) => s.setInfo);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setInfo(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setInfo]);

  return (
    <AnimatePresence>
      {info && (
        <motion.div
          key="info-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex bg-black/80 backdrop-blur-md"
          onClick={() => setInfo(null)}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: "spring", stiffness: 240, damping: 26 }}
            className="m-auto w-[min(92vw,520px)] overflow-hidden rounded-2xl border border-white/10 bg-gallery shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {info.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={info.image} alt={info.title} className="h-44 w-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
            )}
            <div className="p-7">
              <button onClick={() => setInfo(null)} className="float-right text-xs uppercase tracking-widest text-white/40 hover:text-gold">Close ✕</button>
              {info.tag && <span className="mb-2 inline-block rounded-full bg-gold/15 px-2 py-0.5 text-[10px] uppercase tracking-widest text-gold">{info.tag}</span>}
              <h2 className="font-serif text-2xl leading-tight text-ivory">{info.title}</h2>
              {info.subtitle && <p className="mt-1 text-sm text-gold/85">{info.subtitle}</p>}
              <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-white/80">{info.body}</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

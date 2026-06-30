# PROJECT REPORT — chronological work log

Newest entries first. Every substantial change records: date, what changed, files touched, why, and what remains.

---

## 2026-06-30 — Project genesis: foundation, timeline & first 3D museums

**Added**
- Full Next.js 14 + TypeScript + Tailwind scaffold with React Three Fiber, drei, postprocessing, Zustand, Framer Motion, Drizzle + Neon.
- **Verified data catalog** (`lib/data/*`): 24 periods (Indus Valley → Progressive Artists' Group on the Indian axis; Italian Renaissance → Modern on the World axis), 30+ artists (anonymous historical ateliers + named masters), and 25 public-domain artworks with full metadata, stories, significance and fun facts. All cross-checked against Wikipedia (e.g. Starry Night verified: 1889, oil on canvas, 73.7×92.1 cm, MoMA).
- **Neon/Drizzle schema** (`lib/db/schema.ts`) + serverless client with graceful static fallback (`lib/db/client.ts`, `lib/catalog.ts`).
- **Seed/enrich script** (`scripts/seed.ts`): resolves canonical image URLs, licences and credits from the Wikimedia Commons API and upserts into Neon. This is the project's only data-ingestion path — no invented data.
- **Horizontal time-river timeline** (`components/timeline/*`): drag-to-pan, scroll-to-move, ⌘/Ctrl-scroll zoom; World above / India below; period bands with lane packing; artwork thumbnails; artist dots (gold pulsing = walkable museum); axis/medium/search filters.
- **Walkable 3D museum** (`components/museum/*`): first-person WASD + pointer-lock look, hall with reflective floor (`MeshReflectorMaterial`), gilt frames, per-artwork spotlights with shadows, procedural HDR environment, bloom + vignette + ACES tone mapping, center-raycast focus, click-to-inspect, collision clamping.
- **Inspect mode** (`components/inspect/InspectModal.tsx`): full-screen, zoom/pan hi-res image, full metadata, story, significance, fun facts, related works, Wikipedia link.
- Project docs: `PROJECT_BIBLE.md`, `PROJECT_REPORT.md`, `HANDOFF.md`.

**Why**
- Per the agreed plan: "deep vertical slice first" — build the complete architecture plus genuinely walkable museums (Van Gogh, Vermeer, Chola bronzes, etc.) end-to-end, then expand breadth.
- Timeline checkpoint #1 resolved to the **horizontal time-river** design.

**Verified**
- `npm install` (492 packages), `tsc --noEmit` (0 errors), and `next build` all pass. Production smoke test: `/` → 200 (renders "Antarang"), `/museum/vincent-van-gogh` → 200, `/museum/chola-bronze-casters` → 200, invalid slug → 404. Museum 3D code is correctly code-split via `dynamic(ssr:false)`.
- Note: Next.js 14.2.15 carries a security advisory (2025-12-11); recommend `npm i next@14` to take the latest patched 14.2.x before deploying.

**Known issues / pending**
- Database not yet connected (awaiting Neon `DATABASE_URL`) — app runs on the static catalog meanwhile.
- Git remote not yet configured (awaiting repo URL) — no commits pushed yet.
- A few ancient-Indian Commons file names are best-guess and are resolved/repaired by the seed script at runtime; UI degrades gracefully if a file moved.
- Not yet deployed to Vercel; Playwright QA not yet run.
- Mobile/touch controls not yet implemented.

**Next priorities**
1. Receive Neon creds + repo URL; wire `.env.local`, run `db:push` + `db:seed`, initial commit/push.
2. Checkpoint reviews: artist card, museum navigation, inspect UI, search, mobile.
3. Expand catalog breadth (more periods/artists/works) via the verified pipeline.
4. Deploy to Vercel; run Playwright QA; fix issues.

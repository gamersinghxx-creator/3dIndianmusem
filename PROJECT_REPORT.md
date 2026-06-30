# PROJECT REPORT — chronological work log

Newest entries first. Every substantial change records: date, what changed, files touched, why, and what remains.

---

## 2026-06-30 (later) — Phase A: design polish + critical disk-integrity fix

**Added (Phase A design checkpoints)**
- **Search results panel** (`components/timeline/SearchResults.tsx`): live floating panel listing matching periods, artists (with portrait) and artworks (thumbnails); click to enter a museum or open inspect.
- **Artist hover cards** on the timeline (`TimeRiver.tsx`): portrait, life span, period, nationality, work count, bio, and Enter-museum / Wikipedia actions.
- **In-gallery HUD** (`MuseumClient.tsx`): collapsible "Works in this hall" list (click any piece to inspect), a controls/help toggle, refined nameplate.
- **Inspect refinements** (`InspectModal.tsx`): high-res loading shimmer; ← → keyboard navigation and on-screen chevrons to browse an artist's works.
- **Responsive / mobile**: responsive header; touch devices get a graceful path — the walkable 3D is flagged desktop-best and the full works list opens for tap-to-inspect browsing.

**Fixed (critical)**
- Discovered that in this authoring environment, **overwriting an existing file truncates it on disk** (only fresh file creates flush fully). Every previously *edited* file was therefore corrupted on disk: `Gallery3D.tsx`, `TimeRiver.tsx`, `TimelineExperience.tsx`, `MuseumClient.tsx`, `InspectModal.tsx`, `scripts/seed.ts`, `drizzle.config.ts`, `package.json`, `PROJECT_REPORT.md`. Each was deleted and **recreated from scratch with complete content**. Going forward, edits are made by full rewrite-on-recreate, not in-place edits.
- ⚠️ The first Git commit captured the truncated versions — a new commit is required after this fix (see HANDOFF).

**Next priorities**
1. Re-commit the repaired files to `main`.
2. Deploy to Vercel; run Playwright QA; fix issues.
3. Remaining checkpoints if desired: deepen 3D (era-specific architecture), expand content breadth.

---

## 2026-06-30 — Project genesis: foundation, timeline & first 3D museums

**Added**
- Full Next.js 14 + TypeScript + Tailwind scaffold with React Three Fiber, drei, postprocessing, Zustand, Framer Motion, Drizzle + Neon.
- **Verified data catalog** (`lib/data/*`): 24 periods (Indus Valley → Progressive Artists' Group on the Indian axis; Italian Renaissance → Modern on the World axis), 30+ artists (anonymous historical ateliers + named masters), and 25 public-domain artworks with full metadata, stories, significance and fun facts. Cross-checked against Wikipedia (e.g. Starry Night: 1889, oil on canvas, 73.7×92.1 cm, MoMA).
- **Neon/Drizzle schema** (`lib/db/schema.ts`) + serverless client with graceful static fallback (`lib/db/client.ts`, `lib/catalog.ts`).
- **Seed/enrich script** (`scripts/seed.ts`): resolves canonical image URLs, licences and credits from the Wikimedia Commons API and upserts into Neon. The project's only data-ingestion path — no invented data.
- **Horizontal time-river timeline** (`components/timeline/*`): drag-to-pan, scroll-to-move, ⌘/Ctrl-scroll zoom; World above / India below; period bands with lane packing; artwork thumbnails; artist dots (gold pulsing = walkable museum); axis/medium/search filters.
- **Walkable 3D museum** (`components/museum/*`): first-person WASD + pointer-lock look, collision clamping, PBR materials, soft shadows, reflective floor, per-artwork spotlights, procedural HDR environment, bloom + vignette + ACES tone mapping, center-raycast focus, click-to-inspect.
- **Inspect mode**: full-screen, zoom/pan hi-res image, full metadata, story, significance, fun facts, related works, Wikipedia link.
- Project docs: `PROJECT_BIBLE.md`, `PROJECT_REPORT.md`, `HANDOFF.md`, `README.md`.

**Verified**
- `npm install` (492 packages), `tsc --noEmit` (0 errors), and `next build` all pass. Production smoke test: `/` → 200, `/museum/vincent-van-gogh` → 200, `/museum/chola-bronze-casters` → 200, invalid slug → 404. Museum 3D code is code-split via `dynamic(ssr:false)`.
- Note: Next.js 14.2.15 carries a security advisory (2025-12-11); recommend `npm i next@14` to take the latest patched 14.2.x before deploying.

**Known issues / pending**
- Database connected (Neon `DATABASE_URL` in `.env.local`); run `npm run db:setup` on a machine with network to create tables + load Wikimedia data.
- Deploy to Vercel + Playwright QA still pending.

# PROJECT BIBLE — Antarang

_Antarang_ ("inner light / the heart of things") is an interactive 3D museum of **World and Indian art history** that runs entirely in the browser. It presents Indian art history as a first-class citizen alongside the rest of world art, on a single shared timeline, using **only verified Wikipedia / Wikimedia Commons data**.

This document is the single source of truth for the project's architecture and decisions. It is kept current with every substantial change (see also `PROJECT_REPORT.md` and `HANDOFF.md`).

---

## 1. Design philosophy

- **Historical accuracy over volume.** Every artist, artwork and fact must be verifiable on Wikipedia / Wikimedia Commons. Nothing is invented — no fictional artists, works, or facts.
- **Two axes, one history.** The homepage timeline runs horizontally: **World art above the axis, Indian art below**, so the two traditions can be read against each other century by century.
- **Public-domain first.** All artworks shipped with images are verified public domain. Modern artists whose work is still in copyright (e.g. Husain, Raza, Picasso, Dalí) appear as **biography nodes** that link to Wikipedia rather than reproducing copyrighted images.
- **Museum quality, not a demo.** PBR materials, soft shadows, reflective floors, spotlights, bloom, tone mapping and a procedurally-generated HDR environment.
- **Always runnable.** The app works from a bundled static catalog even before the database is connected; Neon is the production source of truth once seeded.

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 14 (App Router) + TypeScript** | Server components fetch the catalog; client components render the experiences. |
| 3D | **React Three Fiber + three.js** | `@react-three/drei` (controls, reflector, environment, text), `@react-three/postprocessing` (bloom, vignette). |
| Styling | **Tailwind CSS** | Museum palette in `tailwind.config.ts`. |
| State | **Zustand** | Inspect-modal + timeline filters (`lib/store.ts`). |
| Animation | **Framer Motion** | UI transitions; GSAP-quality easing via spring transitions. |
| Database | **Neon Postgres + Drizzle ORM** | `@neondatabase/serverless` HTTP driver — edge-friendly. |
| Data source | **Wikimedia Commons API + Wikipedia** | `scripts/seed.ts` resolves canonical image URLs, licences and credits. |
| Deploy | **Vercel** | (Pending — see roadmap.) |

## 3. Folder structure

```
app/
  layout.tsx                 Root layout + metadata
  page.tsx                   Home (server) → TimelineExperience
  museum/[slug]/page.tsx     Artist museum (server) → MuseumClient
components/
  timeline/
    TimelineExperience.tsx   Header, filters, search; applies filters
    TimeRiver.tsx            Horizontal zoom/pan time-river canvas
  museum/
    MuseumClient.tsx         Overlay UI + dynamic(ssr:false) loader
    Gallery3D.tsx            R3F scene: hall, frames, lighting, player
  inspect/
    InspectModal.tsx         Hi-res zoom/pan inspection interface
lib/
  data/                      Verified static catalog (source of truth for seed)
    types.ts  periods.ts  artists.ts  artworks.ts  index.ts
  db/
    schema.ts                Drizzle/Postgres schema
    client.ts                Neon client (+ dbEnabled flag)
  catalog.ts                 Server data access (Neon → static fallback)
  img.ts                     Best-image-URL resolver
  store.ts                   Zustand store
scripts/
  seed.ts                    Wikimedia enrich + Neon upsert
drizzle.config.ts
PROJECT_BIBLE.md  PROJECT_REPORT.md  HANDOFF.md  README.md
```

## 4. Data model

Three tables, mirrored exactly by `lib/data/types.ts`:

- **periods** — civilizations, empires, dynasties, movements. `axis` (`world`|`india`), `startYear`/`endYear` (negative = BCE), `kind`, `region`, `blurb`, `wikipedia`.
- **artists** — real individuals and named collective ateliers (e.g. "Chola Bronze-Casters"). `slug`, `axis`, `life`, `year` (floruit), `periodId`, `bio`, `wikipedia`, optional `portraitFile`/`portraitUrl`.
- **artworks** — `title`, `date`, `year`, `medium`, `mediumDetail`, `dimensions`, `museum`, `location`, `story`, `significance`, `funFacts[]`, `commonsFile`, and Commons-resolved `imageUrl`/`thumbUrl`/`license`/`credit`, `wikipedia`, `publicDomain`.

**Image strategy.** Each artwork stores a Wikimedia Commons file name. `scripts/seed.ts` calls the Commons API to resolve the canonical full-resolution URL + licence + credit and writes them to Neon. The UI (`lib/img.ts`) prefers the resolved URL and otherwise builds a stable `Special:FilePath` URL, with a graceful visual fallback if a file is missing.

## 5. Coding standards

- TypeScript strict mode. No `any` in domain code (narrow casts only at the DB boundary).
- Server components fetch data; client components (`"use client"`) own interactivity. The 3D Canvas is loaded with `dynamic(..., { ssr: false })`.
- Secrets only in `.env.local` (gitignored). **Never** log or print the connection string.
- Real data only. If a fact cannot be verified on Wikipedia/Wikimedia, it does not ship.

## 6. Key UI decisions (checkpoints)

1. **Timeline design — Horizontal "time-river" (chosen).** Single horizontal axis, World above / India below, drag to pan, scroll to move, ⌘/Ctrl-scroll to zoom; gold pulsing dots mark walkable museums.
2. Artist card design — _pending review_.
3. Museum navigation — first-person WASD + pointer-lock mouse-look, center-raycast focus, click to inspect (_implemented; pending review_).
4. Artwork inspection — full-screen modal, zoom/pan hi-res, metadata, story, significance, fun facts, related works, Wikipedia link (_implemented; pending review_).
5. Search experience — header search across artists/works/museums (_basic; pending review_).
6. Mobile responsiveness — _pending_.

## 7. Environment & scripts

`.env.local`:
```
DATABASE_URL="postgresql://…?sslmode=require"   # Neon pooled
DATABASE_URL_UNPOOLED="postgresql://…"          # optional, for migrations
```
Scripts: `npm run dev`, `npm run build`, `npm run typecheck`, `npm run db:push` (create tables), `npm run db:seed` (enrich from Wikimedia + upsert).

## 8. Deployment process (planned)

1. Push to GitHub (`main`).
2. Import the repo into Vercel; add `DATABASE_URL` env var.
3. Run `npm run db:push && npm run db:seed` against Neon.
4. Deploy; QA the live site with Playwright; fix issues before sign-off.

## 9. Future roadmap

- Broaden the catalog era by era (Indus → Contemporary; Renaissance → Pop) using the same verified pipeline.
- Per-period architecture: temple-style halls for Indian dynasties (Dravidian, Nagara), white-cube halls for modern art.
- Multi-hall museums for prolific artists.
- Audio ambience and optional narrated tours.
- Accessibility pass (keyboard-only navigation of inspect mode, reduced-motion, captions).
- Mobile/touch controls (virtual joystick + look).
- Playwright e2e + visual regression in CI.

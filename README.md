# Antarang — A 3D Museum of World & Indian Art History

Walk through the history of human civilisation in art. **Antarang** is an interactive, browser-based 3D museum where **Indian art history stands as a first-class citizen** alongside the rest of world art — on a single shared timeline, built on **verified Wikipedia / Wikimedia Commons data only**.

> The homepage is a horizontal, zoomable **time-river**: World art above the axis, Indian art below, spanning the Indus Valley Civilisation to the present. Gold pulsing dots are **walkable first-person 3D museums**. Click any artwork to open a museum-quality **zoom/pan inspection** view with its story, significance and sources.

## Features
- 🏛 **Walkable 3D galleries** (WASD + mouse-look) with PBR materials, reflective floors, per-artwork spotlights, soft shadows, bloom and ACES tone mapping.
- 🕰 **Infinite-feel time-river** with pan/zoom, World/India axes, and filters by axis, medium and free-text search.
- 🔍 **Inspect mode** — ultra-hi-res zoom & pan, full metadata, story, significance, fun facts, related works, Wikipedia links.
- 🇮🇳 **Indian art in depth** — Indus Valley, Mauryan, Gupta, Ajanta, Ellora, Chola bronzes, Khajuraho, Konark, Mughal, Bengal School and the Progressive Artists' Group.
- 🌍 **World art** — Renaissance, Dutch Golden Age, Edo ukiyo-e, Impressionism, Post-Impressionism, Vienna Secession and Modern art.
- ✅ **Verified data only.** Real artists, real artworks, real facts. Public-domain images; in-copyright modern artists appear as biography nodes linking to Wikipedia.

## Quick start
```bash
npm install            # add --legacy-peer-deps if needed
npm run dev            # http://localhost:3000
```

### Optional: connect Neon (production data source)
```bash
cp .env.example .env.local      # paste your Neon DATABASE_URL
npm run db:push                 # create tables
npm run db:seed                 # enrich images from Wikimedia + upsert
```
Without a database, the app runs from the bundled verified catalog.

## Tech
Next.js 14 · TypeScript · React Three Fiber / three.js · drei · postprocessing · Tailwind · Zustand · Framer Motion · Drizzle ORM · Neon Postgres.

## Documentation
- [`PROJECT_BIBLE.md`](./PROJECT_BIBLE.md) — architecture, schema, decisions, roadmap.
- [`PROJECT_REPORT.md`](./PROJECT_REPORT.md) — chronological work log.
- [`HANDOFF.md`](./HANDOFF.md) — how to continue the project.

## Data & licensing
All images and facts come from **Wikimedia Commons / Wikipedia**. Each artwork stores its Commons file; the seed script resolves the canonical URL, licence and credit. Please respect the individual licences shown in the inspect panel.

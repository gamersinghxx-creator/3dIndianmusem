# HANDOFF — continue this project

Everything another developer or AI needs to pick up Antarang immediately.

## What this is
An interactive 3D museum of World + Indian art history in the browser. Homepage = a horizontal zoomable "time-river" (World art above the axis, Indian below). Gold pulsing dots are walkable first-person 3D museums; clicking any artwork opens a zoom/pan inspection panel. All content is verified Wikipedia / Wikimedia Commons data — **never invent artists, works, or facts.**

## Current status (2026-06-30)
- **Foundation complete and self-contained.** Next.js 14 + R3F app with a verified static catalog (`lib/data/*`), the time-river timeline, walkable 3D museums, and inspect mode all implemented.
- **Runs without a database** — it falls back to the bundled static catalog. Neon is the production source once seeded.
- **Not yet:** Neon connected, Git remote configured, Vercel deploy, Playwright QA, mobile controls.

## Get it running
```bash
npm install            # use --legacy-peer-deps if the three.js peers complain
cp .env.example .env.local   # then paste your Neon DATABASE_URL (optional to start)
npm run dev            # http://localhost:3000
```
Optional database:
```bash
npm run db:push        # create tables in Neon
npm run db:seed        # enrich images from Wikimedia Commons + upsert into Neon
```

## Where things live
- Verified content: `lib/data/{periods,artists,artworks}.ts` — **edit here** to add real content; the seed script ingests it.
- Timeline: `components/timeline/TimeRiver.tsx` (canvas) + `TimelineExperience.tsx` (filters).
- 3D museum: `components/museum/Gallery3D.tsx` (scene) + `MuseumClient.tsx` (overlay).
- Inspect: `components/inspect/InspectModal.tsx`.
- Data access: `lib/catalog.ts` (Neon → static fallback). Image URLs: `lib/img.ts`.
- Schema: `lib/db/schema.ts`. Seed: `scripts/seed.ts`.

## Open items / next recommended task
1. **Add `DATABASE_URL` to `.env.local`**, then `npm run db:push && npm run db:seed`. Verify the homepage shows "data: Neon + Wikimedia".
2. **Configure the Git remote** and push the initial commit to `main` (no remote is set yet — ask the owner for the repo URL).
3. **Checkpoint reviews still owed to the owner:** artist card, museum navigation, inspect UI, search, mobile responsiveness.
4. **Expand the catalog** era by era using the same verified pipeline (add to `lib/data`, re-run seed).
5. **Deploy to Vercel**, then run **Playwright** QA and fix issues.

## Gotchas
- Modern artists in copyright (Husain, Raza, Souza, Tyeb Mehta, Picasso, Dalí, Bose, Jamini Roy) are **biography nodes** with Wikipedia links and **no reproduced image** — keep it that way.
- Some ancient-Indian Commons file names are best-guess; the seed script resolves the canonical URL from the Commons API and the UI degrades gracefully if a file moved. If an image is blank, fix the `commonsFile` in `lib/data/artworks.ts` and re-seed.
- The 3D Canvas must stay behind `dynamic(..., { ssr: false })`.
- Never commit `.env.local`; never print the connection string.

## Branch / deploy
- Branch: `main` (no remote yet).
- Deploy: none yet (target: Vercel).

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// A single shared Neon/Drizzle client. If DATABASE_URL is not configured the
// app silently falls back to the bundled static catalog (see lib/catalog.ts),
// so the museum always runs even before the database is wired up.
const url = process.env.DATABASE_URL;

export const dbEnabled = Boolean(url);

export const db = url ? drizzle(neon(url), { schema }) : null;

export { schema };

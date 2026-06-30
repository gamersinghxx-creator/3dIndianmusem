import {
  pgTable,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  doublePrecision,
} from "drizzle-orm/pg-core";

// Schema mirrors lib/data/types.ts. Years are integers (negative = BCE).

export const periods = pgTable("periods", {
  id: text("id").primaryKey(),
  axis: text("axis").notNull(), // 'world' | 'india'
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  startYear: integer("start_year").notNull(),
  endYear: integer("end_year").notNull(),
  region: text("region").notNull(),
  blurb: text("blurb").notNull(),
  wikipedia: text("wikipedia").notNull(),
});

export const artists = pgTable("artists", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  axis: text("axis").notNull(),
  name: text("name").notNull(),
  life: text("life").notNull(),
  year: integer("year").notNull(),
  periodId: text("period_id").notNull(),
  nationality: text("nationality").notNull(),
  bio: text("bio").notNull(),
  wikipedia: text("wikipedia").notNull(),
  portraitFile: text("portrait_file"),
  portraitUrl: text("portrait_url"),
});

export const artworks = pgTable("artworks", {
  id: text("id").primaryKey(),
  artistId: text("artist_id").notNull(),
  periodId: text("period_id").notNull(),
  axis: text("axis").notNull(),
  title: text("title").notNull(),
  date: text("date").notNull(),
  year: integer("year").notNull(),
  medium: text("medium").notNull(),
  mediumDetail: text("medium_detail").notNull(),
  dimensions: text("dimensions"),
  museum: text("museum").notNull(),
  location: text("location").notNull(),
  story: text("story").notNull(),
  significance: text("significance").notNull(),
  funFacts: jsonb("fun_facts").$type<string[]>().notNull(),
  commonsFile: text("commons_file").notNull(),
  // Resolved live from the Commons API by the seed script:
  imageUrl: text("image_url"),
  thumbUrl: text("thumb_url"),
  imageWidth: integer("image_width"),
  imageHeight: integer("image_height"),
  licenseShort: text("license_short"),
  credit: text("credit"),
  wikipedia: text("wikipedia").notNull(),
  publicDomain: boolean("public_domain").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type PeriodRow = typeof periods.$inferSelect;
export type ArtistRow = typeof artists.$inferSelect;
export type ArtworkRow = typeof artworks.$inferSelect;

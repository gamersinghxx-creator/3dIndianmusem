import { NextResponse } from "next/server";
import { artists } from "@/lib/data/artists";
import { commonsCategories } from "@/lib/data/commonsCategories";

// Live gallery data: pull an artist's works from Wikimedia Commons at runtime.
// Tries the artist's Commons category first, then a name search as fallback.
// Cached for a day. Uses ONLY the Wikimedia Commons API — real, free-licensed.

export const revalidate = 86400;

const API = "https://commons.wikimedia.org/w/api.php";
const UA = "AntarangMuseum/0.1 (educational; Wikimedia Commons data)";

const strip = (s?: string) => (s ? s.replace(/<[^>]+>/g, "").trim() : undefined);
const cleanTitle = (t: string) =>
  t.replace(/^File:/, "").replace(/\.(jpg|jpeg|png|tif|tiff|svg|webp|gif)$/i, "").replace(/_/g, " ").trim();

async function commons(params: Record<string, string>): Promise<any> {
  const u = new URL(API);
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  try {
    const r = await fetch(u.toString(), { headers: { "User-Agent": UA }, next: { revalidate: 86400 } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

interface DynWork {
  file: string; title: string; imageUrl?: string; thumbUrl?: string;
  width?: number; height?: number; date?: string; credit?: string; license?: string;
}

function mapPages(data: any): DynWork[] {
  const pages = Object.values(data?.query?.pages ?? {}) as any[];
  return pages
    .map((p) => {
      const info = p.imageinfo?.[0];
      if (!info?.url) return null;
      const mime: string = info.mime || "";
      if (mime && !/^image\/(jpeg|png|tiff|webp)/.test(mime)) return null;
      const meta = info.extmetadata ?? {};
      return {
        file: String(p.title).replace(/^File:/, ""),
        title: cleanTitle(String(p.title)),
        imageUrl: info.url,
        thumbUrl: info.thumburl,
        width: info.width,
        height: info.height,
        date: strip(meta.DateTimeOriginal?.value) || strip(meta.DateTime?.value) || "",
        credit: strip(meta.Artist?.value) || strip(meta.Credit?.value),
        license: strip(meta.LicenseShortName?.value),
      } as DynWork;
    })
    .filter((w): w is DynWork => !!w);
}

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const artist = artists.find((a) => a.slug === params.slug);
  if (!artist) return NextResponse.json({ works: [] });

  const cat = commonsCategories[artist.id];
  let works: DynWork[] = [];

  if (cat) {
    const d = await commons({
      action: "query", format: "json", generator: "categorymembers",
      gcmtitle: `Category:${cat}`, gcmtype: "file", gcmlimit: "80",
      prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: "1600", origin: "*",
    });
    works = mapPages(d);
  }

  if (works.length === 0) {
    const d = await commons({
      action: "query", format: "json", generator: "search",
      gsrsearch: artist.name, gsrnamespace: "6", gsrlimit: "40",
      prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: "1600", origin: "*",
    });
    works = mapPages(d);
  }

  // De-dupe by file, prefer larger images, cap the payload.
  const seen = new Set<string>();
  works = works
    .filter((w) => (seen.has(w.file) ? false : (seen.add(w.file), true)))
    .sort((a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0))
    .slice(0, 60);

  return NextResponse.json({ works, source: cat ? "category" : "search" });
}

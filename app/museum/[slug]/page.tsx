import { notFound } from "next/navigation";
import { getCatalog } from "@/lib/catalog";
import MuseumClient from "@/components/museum/MuseumClient";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const catalog = await getCatalog();
  const artist = catalog.artists.find((a) => a.slug === params.slug);
  return {
    title: artist ? `${artist.name} — Antarang Museum` : "Museum — Antarang",
  };
}

export default async function MuseumPage({ params }: { params: { slug: string } }) {
  const catalog = await getCatalog();
  const artist = catalog.artists.find((a) => a.slug === params.slug);
  if (!artist) notFound();

  const works = catalog.artworks.filter((w) => w.artistId === artist.id);
  if (works.length === 0) notFound();

  const period = catalog.periods.find((p) => p.id === artist.periodId) ?? null;

  return (
    <MuseumClient
      artist={artist}
      period={period}
      works={works}
      images={catalog.images}
      allArtworks={catalog.artworks}
    />
  );
}

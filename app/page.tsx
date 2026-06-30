import { getCatalog } from "@/lib/catalog";
import TimelineExperience from "@/components/timeline/TimelineExperience";

export default async function HomePage() {
  const catalog = await getCatalog();
  return <TimelineExperience catalog={catalog} />;
}

import Experience from "@/components/Experience";
import { inventoryStats } from "@/lib/snapshot-stats";

export default async function Home() {
  return <Experience stats={await inventoryStats()} />;
}

import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { categorize, type Category, type Snapshot } from "./properties";

export type InventoryStats = {
  total: number;
  fetchedAt: string;
  byCategory: Record<Category, number>;
  neighborhoods: number;
};

export async function inventoryStats(): Promise<InventoryStats> {
  "use cache";
  const file = path.join(process.cwd(), "public", "data", "properties.json");
  const snapshot = JSON.parse(await readFile(file, "utf8")) as Snapshot;
  const byCategory: Record<Category, number> = { side: 0, lot: 0, structure: 0, dormant: 0 };
  const categories = snapshot.statuses.map(categorize);
  for (const row of snapshot.rows) byCategory[categories[row[2]]] += 1;
  return {
    total: snapshot.rows.length,
    fetchedAt: snapshot.fetchedAt,
    byCategory,
    neighborhoods: snapshot.neighborhoods.length,
  };
}

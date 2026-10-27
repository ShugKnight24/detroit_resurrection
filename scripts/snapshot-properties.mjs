// Pulls every DLBA-owned property from the City of Detroit open data layer and
// writes a compact snapshot to public/data/properties.json, so the map still
// works on flaky hackathon wifi. Re-run with `npm run snapshot`.
import { mkdir, writeFile } from "node:fs/promises";

const LAYER =
  "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/DLBA_Owned_Properties/FeatureServer/0/query";
const PAGE = 2000;
const FIELDS = [
  "name",
  "parcel_id",
  "inventory_status_socrata",
  "neighborhood",
  "council_district",
  "longitude",
  "latitude",
];

async function page(offset) {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: FIELDS.join(","),
    returnGeometry: "false",
    orderByFields: "ObjectId",
    resultOffset: String(offset),
    resultRecordCount: String(PAGE),
    f: "json",
  });
  const res = await fetch(`${LAYER}?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} at offset ${offset}`);
  const body = await res.json();
  if (body.error) throw new Error(`ArcGIS error at offset ${offset}: ${JSON.stringify(body.error)}`);
  return body;
}

const statuses = [];
const neighborhoods = [];
const indexOf = (list, value) => {
  let i = list.indexOf(value);
  if (i === -1) i = list.push(value) - 1;
  return i;
};

const rows = [];
for (let offset = 0; ; offset += PAGE) {
  const body = await page(offset);
  for (const { attributes: a } of body.features) {
    if (a.longitude == null || a.latitude == null) continue;
    rows.push([
      Math.round(a.longitude * 1e5) / 1e5,
      Math.round(a.latitude * 1e5) / 1e5,
      indexOf(statuses, a.inventory_status_socrata ?? "Unknown"),
      indexOf(neighborhoods, a.neighborhood ?? "Unknown"),
      a.name ?? "",
      (a.parcel_id ?? "").replace(/\.$/, ""),
      a.council_district ?? 0,
    ]);
  }
  process.stdout.write(`\r${rows.length} properties`);
  if (!body.exceededTransferLimit && body.features.length < PAGE) break;
}

await mkdir("public/data", { recursive: true });
await writeFile(
  "public/data/properties.json",
  JSON.stringify({ fetchedAt: new Date().toISOString(), statuses, neighborhoods, rows }),
);
console.log(`\nWrote public/data/properties.json (${statuses.length} statuses, ${neighborhoods.length} neighborhoods)`);

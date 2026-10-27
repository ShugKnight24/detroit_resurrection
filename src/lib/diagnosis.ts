import { z } from "zod";
import type { Nearby, Property } from "./properties";
import { PROGRAM_NOTES } from "./programs";

export const REVIVAL_KINDS = [
  "side_yard",
  "garden",
  "pocket_park",
  "rehab",
  "infill_home",
  "community_space",
  "small_business",
] as const;

export const DiagnosisSchema = z.object({
  verdict: z.string().describe("One spooky but respectful sentence, like a doctor's note on the patient's chart"),
  condition: z.string().describe("2-3 plain sentences on what the data and photo say about this parcel and its block"),
  options: z
    .array(
      z.object({
        title: z.string(),
        kind: z.enum(REVIVAL_KINDS),
        why: z.string().describe("Why this fits this parcel and block, citing the data"),
        cost: z.string().describe("Rough cost range in USD, labeled as an estimate"),
        timeline: z.string(),
        program: z.string().describe("Which Land Bank program from the notes applies"),
      }),
    )
    .describe("2 or 3 revival options, best first"),
  checklist: z
    .array(z.object({ step: z.string(), detail: z.string() }))
    .describe("4-6 concrete steps to apply through the Land Bank and start the revival"),
  partners: z.array(z.string()).describe("Names chosen only from the provided partner list"),
});

export type Diagnosis = z.infer<typeof DiagnosisSchema>;

export type DiagnoseRequest = {
  property: Property;
  nearby: Nearby;
  goal?: string;
  photo?: { mediaType: "image/jpeg" | "image/png" | "image/webp"; data: string };
};

export type DiagnoseResponse = { diagnosis: Diagnosis; source: "claude" | "offline" };

// Rule-based plan used when the API is unavailable, so the demo never dead-ends.
export function offlineDiagnosis({ property, nearby }: DiagnoseRequest): Diagnosis {
  const vacantNearby = nearby.byCategory.lot + nearby.byCategory.side + nearby.byCategory.dormant;
  const cluster = vacantNearby >= 12;
  const note = PROGRAM_NOTES[property.status] ?? "Land Bank owned parcel.";
  const isHouse = property.category === "structure" || property.status === "DLBA Owned Structure";

  const options: Diagnosis["options"] = isHouse
    ? [
        {
          title: "Bring the house back",
          kind: "rehab",
          why: "The structure is still standing. A rehab keeps a family on the block.",
          cost: "Estimate: $40k-$150k depending on roof, systems, and code work",
          timeline: "6-18 months",
          program: note,
        },
        {
          title: "Neighborhood hub",
          kind: "community_space",
          why: `${vacantNearby} vacant Land Bank parcels within ${nearby.radiusMeters}m. The block needs an anchor.`,
          cost: "Estimate: $60k-$200k",
          timeline: "1-2 years",
          program: note,
        },
      ]
    : [
        property.category === "side"
          ? {
              title: "Side yard for the house next door",
              kind: "side_yard",
              why: "Side lots go to the owner-occupant next door. It's the fastest path from dead lot to cared-for land.",
              cost: "Estimate: $100-$2k for the sale, fencing, and seed",
              timeline: "1-3 months",
              program: note,
            }
          : {
              title: "Neighborhood garden",
              kind: "garden",
              why: "Vacant land plus nearby residents is the classic Detroit garden recipe.",
              cost: "Estimate: $500-$5k for soil testing, raised beds, and water",
              timeline: "One growing season",
              program: note,
            },
        {
          title: cluster ? "Pocket park across the cluster" : "Pocket park",
          kind: "pocket_park",
          why: cluster
            ? `${vacantNearby} vacant parcels within ${nearby.radiusMeters}m. Group them into one green space.`
            : "A small, low-maintenance green space with seating and trees.",
          cost: "Estimate: $5k-$40k",
          timeline: "6-12 months",
          program: note,
        },
      ];

  return {
    verdict: cluster
      ? "Patient is part of a fading block, but there's still a pulse."
      : "Patient is quiet, not gone. One good neighbor could bring it back.",
    condition: `${property.address} in ${property.neighborhood} is listed as "${property.status}". There are ${nearby.total} other Land Bank parcels within ${nearby.radiusMeters}m (${vacantNearby} vacant lots).`,
    options,
    checklist: [
      { step: "Confirm the listing", detail: "Look up the parcel ID on buildingdetroit.org and check it is still available." },
      { step: "Check eligibility", detail: "Side and neighborhood lots have residency rules. Read the program page before applying." },
      { step: "Gather documents", detail: "Photo ID, proof of address, and a short plan for the land." },
      { step: "Apply online", detail: "Submit through the Land Bank's online application for this program." },
      { step: "Plan the first season", detail: "Clean up, test the soil if you plan to grow food, and talk to your neighbors." },
    ],
    partners: ["Detroit Land Bank Authority", isHouse ? "Detroit Future City" : "Keep Growing Detroit"],
  };
}

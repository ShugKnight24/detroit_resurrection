import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  DiagnosisSchema,
  offlineDiagnosis,
  type DiagnoseRequest,
  type DiagnoseResponse,
} from "@/lib/diagnosis";
import { PARTNERS, PROGRAM_NOTES } from "@/lib/programs";

const client = new Anthropic();

const SYSTEM = `You are Dr. Detroit, the attending physician at Detroit Resurrection: a tool that helps Detroit residents bring vacant Detroit Land Bank Authority (DLBA) lots and houses back to life.

You receive one parcel's record from the City of Detroit open data portal, counts of other Land Bank parcels nearby, the resident's goal if they gave one, and sometimes a photo.

Write a revival plan:
- The verdict is a single line in the voice of a doctor's note on a patient chart. Spooky is fine; mocking the neighborhood or its residents is not.
- Base every claim on the data or photo you were given. If you don't know something (soil, zoning, structural condition), say what to check instead of guessing.
- Match the program to the parcel's inventory status using only the program notes below. Never state a price, deadline, or eligibility rule that isn't in the notes; tell people to confirm on buildingdetroit.org.
- Cost ranges are rough estimates and must be labeled as estimates.
- Recommend partners only from the partner list, by exact name.

Program notes:
${Object.entries(PROGRAM_NOTES)
  .map(([status, note]) => `- ${status}: ${note}`)
  .join("\n")}

Partner list:
${PARTNERS.map((p) => `- ${p.name}: ${p.focus}`).join("\n")}`;

function isDiagnoseRequest(body: unknown): body is DiagnoseRequest {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  const p = b.property as Record<string, unknown> | undefined;
  return (
    !!p &&
    typeof p.address === "string" &&
    typeof p.status === "string" &&
    typeof p.neighborhood === "string" &&
    !!b.nearby &&
    typeof b.nearby === "object" &&
    (b.goal === undefined || (typeof b.goal === "string" && b.goal.length <= 500))
  );
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isDiagnoseRequest(body)) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { property, nearby, goal, photo } = body;
  const facts = {
    address: property.address,
    parcelId: property.parcelId,
    neighborhood: property.neighborhood,
    councilDistrict: property.district,
    inventoryStatus: property.status,
    nearbyLandBankParcels: nearby,
  };

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (photo && photo.data.length < 7_000_000) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: photo.mediaType, data: photo.data },
    });
  }
  content.push({
    type: "text",
    text: `Parcel record:\n${JSON.stringify(facts, null, 2)}\n\nResident's goal: ${goal?.trim() || "(none given)"}${
      photo ? "\n\nThe resident attached a photo of the parcel." : ""
    }`,
  });

  try {
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(DiagnosisSchema) },
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      throw new Error(`No diagnosis (stop_reason: ${response.stop_reason})`);
    }

    const known = new Set(PARTNERS.map((p) => p.name));
    const diagnosis = {
      ...response.parsed_output,
      partners: response.parsed_output.partners.filter((name) => known.has(name)),
    };
    return Response.json({ diagnosis, source: "claude" } satisfies DiagnoseResponse);
  } catch (error) {
    console.error("diagnose: falling back to offline plan:", error instanceof Error ? error.message : error);
    return Response.json({ diagnosis: offlineDiagnosis(body), source: "offline" } satisfies DiagnoseResponse);
  }
}

import { connection } from "next/server";
import { appendEvent, isVitalEvent, readEvents, summarize } from "@/lib/event-store";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isVitalEvent(body)) {
    return Response.json({ error: "Invalid event" }, { status: 400 });
  }
  await appendEvent(body);
  return new Response(null, { status: 204 });
}

export async function GET() {
  await connection();
  return Response.json(summarize(await readEvents()));
}

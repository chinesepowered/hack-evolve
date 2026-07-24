import { upsertPoints } from "@/lib/server/actian";
import type { VectorPoint } from "@/lib/sponsors/types";

export async function POST(request: Request) {
  const { points } = (await request.json()) as { points: VectorPoint[] };
  try {
    await upsertPoints(points);
    return Response.json({ ok: true, upserted: points.length });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 502 });
  }
}

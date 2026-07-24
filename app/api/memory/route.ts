import { health, scrollPoints } from "@/lib/server/actian";

/** Full memory dump + count, used by the retrieval panel and the engine. */
export async function GET() {
  try {
    const [points, hc] = await Promise.all([scrollPoints(), health()]);
    return Response.json({ points, count: points.length, ...hc });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 502 });
  }
}

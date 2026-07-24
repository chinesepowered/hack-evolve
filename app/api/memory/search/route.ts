import { searchPoints } from "@/lib/server/actian";
import type { VectorFilter } from "@/lib/sponsors/types";

export async function POST(request: Request) {
  const { vector, topK, filter } = (await request.json()) as {
    vector: number[];
    topK?: number;
    filter?: VectorFilter;
  };
  try {
    const hits = await searchPoints(vector, { topK, filter });
    return Response.json({ hits });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 502 });
  }
}

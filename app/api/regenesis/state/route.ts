import { snapshot } from "@/lib/server/app-state";

/** Current rules genome + whether the app is currently healthy. */
export async function GET() {
  return Response.json(snapshot());
}

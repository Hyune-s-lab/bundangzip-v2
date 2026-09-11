import { requireAuth } from "@/lib/auth";
import { errorResponse, json, readJson, sameOrigin } from "@/lib/http";
import { createPublicationSchema } from "@/lib/publication";
import { createPublication, listPublications } from "@/lib/publication-store";
export const runtime = "nodejs";
export async function GET() {
  try {
    await requireAuth();
    return json({ publications: await listPublications() });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await requireAuth();
    const input = createPublicationSchema.parse(
      await readJson(request, 3_300_000),
    );
    return json(
      { publication: await createPublication(input.id, input.snapshots) },
      201,
    );
  } catch (e) {
    return errorResponse(e);
  }
}

import { requireAuth } from "@/lib/auth";
import { errorResponse, json, readJson, sameOrigin } from "@/lib/http";
import { createPublicationSchema } from "@/lib/publication";
import { listPublications } from "@/lib/publication-store";
import { createSummarizedPublication } from "@/lib/publication-draft";
export const maxDuration = 120;
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
      {
        publication: await createSummarizedPublication(
          input.id,
          input.snapshots,
          undefined,
          input.drawingVersion,
        ),
      },
      201,
    );
  } catch (e) {
    return errorResponse(e);
  }
}

import { requireAuth } from "@/lib/auth";
import { errorResponse, json, readJson, sameOrigin } from "@/lib/http";
import { editPublicationSchema } from "@/lib/publication";
import { editPublication } from "@/lib/publication-store";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    await requireAuth();
    const input = editPublicationSchema.parse(
      await readJson(request, 1_000_000),
    );
    const publication = await editPublication(
      (await context.params).id,
      input,
      true,
    );
    return json({ publication, path: `/share/${publication.id}` });
  } catch (e) {
    return errorResponse(e);
  }
}

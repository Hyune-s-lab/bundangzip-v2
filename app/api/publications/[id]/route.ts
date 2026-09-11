import { requireAuth } from "@/lib/auth";
import { errorResponse, json, readJson, sameOrigin } from "@/lib/http";
import { editPublicationSchema } from "@/lib/publication";
import { editPublication, getPublication } from "@/lib/publication-store";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    await requireAuth();
    return json({
      publication: await getPublication((await context.params).id),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function PATCH(request: Request, context: Context) {
  try {
    sameOrigin(request);
    await requireAuth();
    const input = editPublicationSchema.parse(
      await readJson(request, 1_000_000),
    );
    return json({
      publication: await editPublication((await context.params).id, input),
    });
  } catch (e) {
    return errorResponse(e);
  }
}

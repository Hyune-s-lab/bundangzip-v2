import { requireAuth, requireMember } from "@/lib/auth";
import { errorResponse, json, readJson, sameOrigin } from "@/lib/http";
import { deleteCommentSchema } from "@/lib/model";
import { deleteComment } from "@/lib/store";
export const runtime = "nodejs";
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    await requireAuth();
    const input = deleteCommentSchema.parse(await readJson(request));
    requireMember(input.authorId);
    await deleteComment((await params).id, input);
    return json({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}

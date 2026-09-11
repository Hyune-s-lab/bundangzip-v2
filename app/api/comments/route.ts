import { requireAuth, requireMember } from "@/lib/auth";
import { errorResponse, json, readJson, sameOrigin } from "@/lib/http";
import { createCommentSchema } from "@/lib/model";
import { addComment, listComments } from "@/lib/store";
export const runtime = "nodejs";
export async function GET() {
  try {
    await requireAuth();
    return json({ comments: await listComments() });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await requireAuth();
    const input = createCommentSchema.parse(await readJson(request));
    requireMember(input.authorId);
    return json({ comment: await addComment(input) }, 201);
  } catch (e) {
    return errorResponse(e);
  }
}

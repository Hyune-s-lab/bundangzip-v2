import { requireAuth, requireMember } from "@/lib/auth";
import { errorResponse, json, readJson, sameOrigin } from "@/lib/http";
import { feedbackSchema } from "@/lib/model";
import { addFeedback } from "@/lib/store";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    await requireAuth();
    const input = feedbackSchema.parse(await readJson(request));
    requireMember(input.authorId);
    return json({ comment: await addFeedback((await params).id, input) });
  } catch (e) {
    return errorResponse(e);
  }
}

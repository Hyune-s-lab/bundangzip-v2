import { getMembers, requireAuth } from "@/lib/auth";
import { errorResponse, json } from "@/lib/http";
import { floorplanVersion, rooms } from "@/lib/model";
export async function GET() {
  try {
    await requireAuth();
    return json({ members: getMembers(), rooms, floorplanVersion });
  } catch (e) {
    return errorResponse(e);
  }
}

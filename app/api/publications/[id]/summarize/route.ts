import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import {
  HttpError,
  errorResponse,
  json,
  readJson,
  sameOrigin,
} from "@/lib/http";
import { getPublication } from "@/lib/publication-store";
import { generateSummary } from "@/lib/summary-provider";
export const runtime = "nodejs";
export const maxDuration = 120;
const schema = z
  .object({ expectedVersion: z.number().int().positive() })
  .strict();
// Coalesce accidental repeated clicks on the same draft within a function instance.
const pending = new Map<string, ReturnType<typeof generateSummary>>();
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    await requireAuth();
    const input = schema.parse(await readJson(request));
    const id = (await context.params).id;
    const p = await getPublication(id);
    if (p.state !== "draft" || p.version !== input.expectedVersion)
      throw new HttpError(
        409,
        "초안이 변경되었어요. 최신 내용을 불러와주세요.",
      );
    const key = `${id}:${p.version}`;
    let task = pending.get(key);
    if (!task) {
      task = generateSummary(p.decisions);
      pending.set(key, task);
    }
    let brief;
    try {
      brief = await task;
    } finally {
      pending.delete(key);
    }
    const latest = await getPublication(id);
    if (latest.state !== "draft" || latest.version !== p.version)
      throw new HttpError(
        409,
        "요약하는 동안 초안이 변경되었어요. 최신 내용을 불러와주세요.",
      );
    return json({ brief });
  } catch (e) {
    return errorResponse(e);
  }
}

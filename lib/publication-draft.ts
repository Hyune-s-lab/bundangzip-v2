import { randomUUID } from "node:crypto";
import { HttpError } from "./http";
import { hasBrief, type Snapshots } from "./publication";
import {
  createPublication,
  editPublication,
  getPublication,
} from "./publication-store";
import { generateSummary } from "./summary-provider";

// Creation retries always operate on the first frozen snapshot and never replace edits.
export async function createSummarizedPublication(
  id: string,
  snapshots: Snapshots,
  summarize = generateSummary,
  drawingVersion?: 1,
) {
  const draft = await createPublication(id, snapshots, drawingVersion);
  if (draft.state !== "draft" || draft.version > 1 || hasBrief(draft.brief))
    return draft;
  const brief = await summarize(draft.decisions);
  try {
    return await editPublication(id, {
      requestId: randomUUID(),
      expectedVersion: draft.version,
      title: draft.title,
      introduction: draft.introduction,
      brief,
      decisions: draft.decisions.map(({ id, content }) => ({ id, content })),
    });
  } catch (error) {
    if (error instanceof HttpError && error.status === 409) {
      const latest = await getPublication(id);
      if (latest.version > draft.version) return latest;
    }
    throw error;
  }
}

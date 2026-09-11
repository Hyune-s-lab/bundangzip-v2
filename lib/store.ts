import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  readdir,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { get, list, put, BlobPreconditionFailedError } from "@vercel/blob";
import {
  resolveCommentRoom,
  type Comment,
  type FeedbackInput,
  type DeleteCommentInput,
  type NewComment,
} from "./model";
import { HttpError } from "./http";

type RecordVersion = { value: Comment; etag: string };
const globalStore = globalThis as typeof globalThis & {
  bundangWriteQueue?: Promise<unknown>;
};
function localDirectory() {
  return (
    process.env.COMMENT_DATA_DIR ??
    path.join(process.cwd(), ".data", "comments")
  );
}
function prefix() {
  const ns = process.env.COMMENT_NAMESPACE ?? process.env.VERCEL_ENV ?? "local";
  if (!/^[a-zA-Z0-9_-]+$/.test(ns)) throw new Error("Invalid namespace");
  return `bundangzip/${ns}/comments/`;
}
function blobMode() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return true;
  if (process.env.VERCEL)
    throw new HttpError(503, "의견 저장소 연결이 필요해요.");
  return false;
}
function fileName(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id))
    throw new HttpError(400, "의견 ID를 확인해주세요.");
  return `${id}.json`;
}
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
async function readRecord(id: string): Promise<RecordVersion | null> {
  if (blobMode()) {
    const result = await get(prefix() + fileName(id), {
      access: "private",
      useCache: false,
    });
    if (!result) return null;
    if (result.statusCode !== 200 || !result.stream)
      throw new Error("Unexpected storage response");
    const text = await new Response(result.stream).text();
    return {
      value: resolveCommentRoom(JSON.parse(text)),
      etag: result.blob.etag,
    };
  }
  try {
    const text = await readFile(
      path.join(localDirectory(), fileName(id)),
      "utf8",
    );
    return { value: resolveCommentRoom(JSON.parse(text)), etag: digest(text) };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}
async function writeRecord(value: Comment, expected?: string) {
  const text = JSON.stringify(value);
  if (blobMode()) {
    try {
      await put(prefix() + fileName(value.id), text, {
        access: "private",
        addRandomSuffix: false,
        contentType: "application/json",
        allowOverwrite: !!expected,
        ...(expected ? { ifMatch: expected } : {}),
      });
    } catch (error) {
      if (
        error instanceof BlobPreconditionFailedError ||
        (error instanceof Error && /already exists/i.test(error.message))
      )
        throw new HttpError(
          409,
          "다른 가족이 먼저 변경했어요. 최신 의견을 확인하고 다시 저장해주세요.",
        );
      throw error;
    }
    return;
  }
  // Serialize local compare-and-swap and atomically rename complete JSON files.
  const task = (globalStore.bundangWriteQueue ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      await mkdir(localDirectory(), { recursive: true });
      const existing = await readRecord(value.id);
      if (expected ? existing?.etag !== expected : !!existing)
        throw new HttpError(409, "의견이 변경되었어요. 다시 확인해주세요.");
      const target = path.join(localDirectory(), fileName(value.id));
      const temporary = target + `.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, text, { mode: 0o600, flag: "wx" });
        await rename(temporary, target);
      } finally {
        await unlink(temporary).catch(() => {});
      }
    });
  globalStore.bundangWriteQueue = task;
  await task;
}
export async function listComments(): Promise<Comment[]> {
  let ids: string[] = [];
  if (blobMode()) {
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: prefix(), limit: 1000, cursor });
      ids.push(
        ...page.blobs
          .filter((b) => b.pathname.endsWith(".json"))
          .map((b) => path.basename(b.pathname, ".json")),
      );
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  } else {
    await mkdir(localDirectory(), { recursive: true });
    ids = (await readdir(/* turbopackIgnore: true */ localDirectory()))
      .filter((n) => /^[0-9a-f-]{36}\.json$/i.test(n))
      .map((n) => n.slice(0, -5));
  }
  const values: Comment[] = [];
  for (let i = 0; i < ids.length; i += 20) {
    const batch = await Promise.all(ids.slice(i, i + 20).map(readRecord));
    values.push(...batch.filter((v) => v !== null).map((v) => v.value));
  }
  return values
    .filter((value) => !value.deletion)
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
    );
}
function sameComment(a: Comment, b: NewComment) {
  return [
    "id",
    "authorId",
    "roomId",
    "floorplanVersion",
    "x",
    "y",
    "content",
  ].every((k) => a[k as keyof NewComment] === b[k as keyof NewComment]);
}
export async function addComment(input: NewComment) {
  input = resolveCommentRoom(input);
  const existing = await readRecord(input.id);
  if (existing) {
    if (existing.value.deletion) throw new HttpError(410, "삭제된 의견이에요.");
    if (!sameComment(existing.value, input))
      throw new HttpError(409, "같은 ID의 다른 의견이 있어요.");
    return existing.value;
  }
  const now = new Date().toISOString();
  const value: Comment = {
    ...input,
    status: "pending",
    createdAt: now,
    updatedAt: now,
    version: 1,
    feedback: [],
  };
  try {
    await writeRecord(value);
  } catch (e) {
    if (e instanceof HttpError && e.status === 409) {
      const retry = await readRecord(input.id);
      if (retry?.value.deletion) throw new HttpError(410, "삭제된 의견이에요.");
      if (retry && sameComment(retry.value, input)) return retry.value;
    }
    throw e;
  }
  return value;
}
export async function addFeedback(id: string, input: FeedbackInput) {
  const record = await readRecord(id);
  if (!record || record.value.deletion)
    throw new HttpError(404, "의견을 찾지 못했어요.");
  const previous = record.value.feedback.find((f) => f.id === input.id);
  if (previous) {
    if (
      previous.authorId !== input.authorId ||
      previous.to !== input.status ||
      previous.reason !== input.reason
    )
      throw new HttpError(409, "같은 ID의 다른 피드백이 있어요.");
    return record.value;
  }
  if (record.value.version !== input.expectedVersion)
    throw new HttpError(
      409,
      "다른 가족이 먼저 변경했어요. 최신 의견을 확인하고 다시 저장해주세요.",
    );
  if (record.value.status === input.status)
    throw new HttpError(400, "이미 같은 상태예요.");
  if (record.value.status !== "pending" && input.status !== "pending")
    throw new HttpError(400, "먼저 검토 중으로 되돌린 뒤 피드백을 남겨주세요.");
  const now = new Date().toISOString();
  const value: Comment = {
    ...record.value,
    status: input.status,
    version: record.value.version + 1,
    updatedAt: now,
    feedback: [
      ...record.value.feedback,
      {
        id: input.id,
        authorId: input.authorId,
        from: record.value.status,
        to: input.status,
        reason: input.reason,
        createdAt: now,
      },
    ],
  };
  try {
    await writeRecord(value, record.etag);
  } catch (e) {
    if (e instanceof HttpError && e.status === 409) {
      const latest = await readRecord(id);
      if (latest?.value.deletion)
        throw new HttpError(404, "삭제된 의견이에요.");
      const saved = latest?.value.feedback.find((f) => f.id === input.id);
      if (
        saved &&
        saved.authorId === input.authorId &&
        saved.to === input.status &&
        saved.reason === input.reason
      )
        return latest!.value;
    }
    throw e;
  }
  return value;
}

export async function deleteComment(id: string, input: DeleteCommentInput) {
  const record = await readRecord(id);
  if (!record) throw new HttpError(404, "의견을 찾지 못했어요.");
  if (record.value.deletion) {
    if (
      record.value.deletion.id === input.id &&
      record.value.deletion.authorId === input.authorId
    )
      return;
    throw new HttpError(404, "이미 삭제된 의견이에요.");
  }
  if (record.value.version !== input.expectedVersion)
    throw new HttpError(
      409,
      "다른 가족이 의견을 변경했어요. 최신 내용을 확인하고 삭제해주세요.",
    );
  const now = new Date().toISOString();
  try {
    await writeRecord(
      {
        ...record.value,
        version: record.value.version + 1,
        updatedAt: now,
        deletion: { id: input.id, authorId: input.authorId, createdAt: now },
      },
      record.etag,
    );
  } catch (error) {
    if (error instanceof HttpError && error.status === 409) {
      const latest = await readRecord(id);
      if (
        latest?.value.deletion?.id === input.id &&
        latest.value.deletion.authorId === input.authorId
      )
        return;
    }
    throw error;
  }
}

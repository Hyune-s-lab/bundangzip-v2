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
import { HttpError } from "./http";
import { listComments } from "./store";
import {
  publicPublication,
  emptyBrief,
  hasBrief,
  snapshotDecisions,
  type Publication,
  type PublicationEdit,
  type PublicationSummary,
  type Snapshots,
} from "./publication";

import { reservePublicationNumber } from "./publication-number";

type Stored = Publication & {
  creationHash: string;
  operation?: { id: string; hash: string };
};
type RecordVersion = { value: Stored; etag: string };
const queue = globalThis as typeof globalThis & {
  publicationWriteQueue?: Promise<unknown>;
};
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
const directory = () =>
  process.env.PUBLICATION_DATA_DIR ??
  path.join(process.cwd(), ".data", "publications");
function blobMode() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return true;
  if (process.env.VERCEL)
    throw new HttpError(503, "공개 자료 저장소 연결이 필요해요.");
  return false;
}
function prefix() {
  const ns = process.env.COMMENT_NAMESPACE ?? process.env.VERCEL_ENV ?? "local";
  if (!/^[a-zA-Z0-9_-]+$/.test(ns)) throw new Error("Invalid namespace");
  return `bundangzip/${ns}/publications/`;
}
function filename(id: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  )
    throw new HttpError(404, "자료를 찾을 수 없어요.");
  return id + ".json";
}
async function read(id: string): Promise<RecordVersion | null> {
  const name = filename(id);
  if (blobMode()) {
    const result = await get(prefix() + name, {
      access: "private",
      useCache: false,
      // Compression turns the ETag into a weak validator, which cannot be used for CAS.
      headers: { "Accept-Encoding": "identity" },
    });
    if (!result) return null;
    if (result.statusCode !== 200 || !result.stream)
      throw new Error("Unexpected storage response");
    return {
      value: JSON.parse(await new Response(result.stream).text()),
      etag: result.blob.etag,
    };
  }
  try {
    const text = await readFile(path.join(directory(), name), "utf8");
    return { value: JSON.parse(text), etag: digest(text) };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}
async function write(value: Stored, expected?: string) {
  const text = JSON.stringify(value);
  if (blobMode()) {
    try {
      await put(prefix() + filename(value.id), text, {
        access: "private",
        addRandomSuffix: false,
        contentType: "application/json",
        allowOverwrite: !!expected,
        ...(expected ? { ifMatch: expected } : {}),
      });
    } catch (e) {
      if (
        e instanceof BlobPreconditionFailedError ||
        (e instanceof Error && /already exists/i.test(e.message))
      )
        throw new HttpError(
          409,
          "다른 가족이 먼저 수정했어요. 최신 초안을 불러와주세요.",
        );
      throw e;
    }
    return;
  }
  const task = (queue.publicationWriteQueue ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      await mkdir(directory(), { recursive: true });
      const existing = await read(value.id);
      if (expected ? existing?.etag !== expected : !!existing)
        throw new HttpError(
          409,
          "초안이 변경되었어요. 최신 내용을 불러와주세요.",
        );
      const target = path.join(directory(), filename(value.id)),
        temp = target + `.${randomUUID()}.tmp`;
      try {
        await writeFile(temp, text, { mode: 0o600, flag: "wx" });
        await rename(temp, target);
      } finally {
        await unlink(temp).catch(() => {});
      }
    });
  queue.publicationWriteQueue = task;
  await task;
}
function draftDto(value: Stored): Publication {
  const { creationHash: _creationHash, operation: _operation, ...p } = value;
  return p;
}
export async function getPublication(id: string): Promise<Publication> {
  const record = await read(id);
  if (!record) throw new HttpError(404, "자료를 찾을 수 없어요.");
  return draftDto(record.value);
}
export async function getPublicPublication(id: string) {
  const p = await getPublication(id);
  if (p.state !== "published")
    throw new HttpError(404, "자료를 찾을 수 없어요.");
  return publicPublication(p);
}
export async function listPublications(): Promise<PublicationSummary[]> {
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
    await mkdir(directory(), { recursive: true });
    ids = (await readdir(/* turbopackIgnore: true */ directory()))
      .filter((n) => n.endsWith(".json"))
      .map((n) => n.slice(0, -5));
  }
  const result: PublicationSummary[] = [];
  for (let i = 0; i < ids.length; i += 10) {
    const records = await Promise.all(ids.slice(i, i + 10).map(read));
    for (const record of records)
      if (record) {
        const p = record.value;
        result.push({
          id: p.id,
          title: p.title,
          number: p.number,
          state: p.state,
          snapshotAt: p.snapshotAt,
          updatedAt: p.updatedAt,
          publishedAt: p.publishedAt,
          decisionCount: p.decisions.length,
        });
      }
  }
  return result.sort((a, b) => b.snapshotAt.localeCompare(a.snapshotAt));
}
export async function createPublication(
  id: string,
  snapshots: Snapshots,
): Promise<Publication> {
  const creationHash = digest(JSON.stringify(snapshots)),
    existing = await read(id);
  if (existing) {
    if (existing.value.creationHash !== creationHash)
      throw new HttpError(409, "같은 ID의 다른 초안이 있어요.");
    return draftDto(existing.value);
  }
  const snapshotAt = new Date().toISOString();
  const value: Stored = {
    id,
    creationHash,
    number: await reservePublicationNumber(id, snapshotAt),
    state: "draft",
    version: 1,
    title: "분당집 리모델링 계획",
    introduction: "",
    brief: emptyBrief(),
    snapshotAt,
    updatedAt: snapshotAt,
    publishedAt: null,
    snapshots: structuredClone(snapshots),
    decisions: snapshotDecisions(await listComments(), randomUUID),
  };
  try {
    await write(value);
  } catch (e) {
    if (e instanceof HttpError && e.status === 409) {
      const retry = await read(id);
      if (retry?.value.creationHash === creationHash)
        return draftDto(retry.value);
    }
    throw e;
  }
  return draftDto(value);
}
export async function editPublication(
  id: string,
  input: PublicationEdit,
  publish = false,
): Promise<Publication> {
  const record = await read(id);
  if (!record) throw new HttpError(404, "초안을 찾을 수 없어요.");
  const hash = digest(JSON.stringify({ ...input, publish }));
  if (record.value.operation?.id === input.requestId) {
    if (record.value.operation.hash !== hash)
      throw new HttpError(409, "다른 내용의 저장 요청이에요.");
    return draftDto(record.value);
  }
  if (record.value.state === "published")
    throw new HttpError(
      409,
      "발행된 자료는 수정할 수 없어요. 새 초안을 만들어주세요.",
    );
  if (record.value.version !== input.expectedVersion)
    throw new HttpError(
      409,
      "다른 가족이 먼저 수정했어요. 최신 초안을 불러와주세요.",
    );
  if (publish && !hasBrief(input.brief))
    throw new HttpError(400, "전달할 요약을 작성해주세요.");
  const decisions = input.decisions.map((edit) => {
    const original = record.value.decisions.find((d) => d.id === edit.id);
    if (!original) throw new HttpError(400, "초안에 없는 의견이에요.");
    return { ...original, content: edit.content };
  });
  const now = new Date().toISOString();
  const value: Stored = {
    ...record.value,
    title: input.title,
    introduction: input.introduction,
    brief: structuredClone(input.brief),
    decisions,
    version: record.value.version + 1,
    updatedAt: now,
    state: publish ? "published" : "draft",
    publishedAt: publish ? now : null,
    operation: { id: input.requestId, hash },
  };
  try {
    await write(value, record.etag);
  } catch (e) {
    if (e instanceof HttpError && e.status === 409) {
      const retry = await read(id);
      if (retry?.value.operation?.hash === hash) return draftDto(retry.value);
    }
    throw e;
  }
  return draftDto(value);
}

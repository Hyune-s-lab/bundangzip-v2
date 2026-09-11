import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  addComment,
  addFeedback,
  deleteComment,
  listComments,
} from "../lib/store";
import {
  createPublication,
  editPublication,
  getPublication,
  getPublicPublication,
  listPublications,
} from "../lib/publication-store";
import {
  createPublicationSchema,
  editPublicationSchema,
  type Publication,
  type Snapshots,
} from "../lib/publication";
const dir = mkdtempSync(path.join(tmpdir(), "bundang-publication-"));
process.env.COMMENT_DATA_DIR = path.join(dir, "comments");
process.env.PUBLICATION_DATA_DIR = path.join(dir, "publications");
delete process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.VERCEL;
after(() => rm(dir, { recursive: true, force: true }));
const snapshots: Snapshots = {
  "as-is-2d": "data:image/jpeg;base64,/9j/AA==",
  "as-is-3d": "data:image/jpeg;base64,/9j/AQ==",
  "to-be-2d": "data:image/jpeg;base64,/9j/Ag==",
  "to-be-3d": "data:image/jpeg;base64,/9j/Aw==",
};
const edit = (p: Publication) => ({
  requestId: randomUUID(),
  expectedVersion: p.version,
  title: p.title,
  introduction: p.introduction,
  brief: { overview: "공사 요청 요약", common: "", spaces: [], questions: "" },
  decisions: p.decisions.map(({ id, content }) => ({ id, content })),
});
const input = (content: string) => ({
  id: randomUUID(),
  authorId: "private-family-person",
  roomId: "whole-house",
  floorplanVersion: "measured-v3" as const,
  x: null,
  y: null,
  content,
});

test("snapshots copy only accepted decisions and remain independent of source edits and deletion", async () => {
  const source = await addComment(input("소음이 적은 바닥재"));
  await addFeedback(source.id, {
    id: randomUUID(),
    authorId: "private-reviewer",
    status: "accepted",
    reason: "비공개 피드백",
    expectedVersion: 1,
  });
  const pending = await addComment(input("아직 검토하는 내용"));
  const rejected = await addComment(input("기각된 내용"));
  await addFeedback(rejected.id, {
    id: randomUUID(),
    authorId: "private-reviewer",
    status: "rejected",
    reason: "기각 이유",
    expectedVersion: 1,
  });
  const p = await createPublication(randomUUID(), snapshots);
  assert.equal(p.decisions.length, 1);
  assert.equal(p.decisions[0].content, source.content);
  const raw = JSON.stringify(p);
  for (const secret of [
    source.id,
    pending.id,
    rejected.id,
    "private-family-person",
    "private-reviewer",
    "비공개 피드백",
    "authorId",
    "feedback",
  ])
    assert.equal(raw.includes(secret), false, secret);
  await assert.rejects(getPublicPublication(p.id), { status: 404 });
  await addFeedback(source.id, {
    id: randomUUID(),
    authorId: "private-reviewer",
    status: "pending",
    reason: "",
    expectedVersion: 2,
  });
  await deleteComment(source.id, {
    id: randomUUID(),
    authorId: "private-reviewer",
    expectedVersion: 3,
  });
  assert.equal(
    (await getPublication(p.id)).decisions[0].content,
    source.content,
  );
  const published = await editPublication(
    p.id,
    {
      ...edit(p),
      title: "공유할 제목",
      decisions: [{ id: p.decisions[0].id, content: "편집한 공개용 본문" }],
    },
    true,
  );
  const shared = await getPublicPublication(p.id);
  assert.equal(shared.brief.overview, "공사 요청 요약");
  assert.equal("decisions" in shared, false);
  assert.equal(JSON.stringify(shared).includes("편집한 공개용 본문"), false);
  assert.deepEqual(shared.snapshots, snapshots);
  assert.equal("state" in shared, false);
  assert.equal("creationHash" in shared, false);
  assert.equal(published.state, "published");
  assert.equal(
    (await listComments()).some((c) => c.content === "편집한 공개용 본문"),
    false,
  );
  await assert.rejects(
    editPublication(p.id, { ...edit(published), title: "발행 후 변경" }),
    { status: 409 },
  );
});

test("save and publish compete with CAS; retries are idempotent and publication is immutable", async () => {
  const p = await createPublication(randomUUID(), snapshots);
  const save = { ...edit(p), title: "초안 저장" },
    publish = { ...edit(p), title: "발행 내용" };
  const results = await Promise.allSettled([
    editPublication(p.id, save),
    editPublication(p.id, publish, true),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.filter((r) => r.status === "rejected").length, 1);
  let latest = await getPublication(p.id);
  if (latest.state === "draft") {
    assert.deepEqual(await editPublication(p.id, save), latest);
    assert.deepEqual(await createPublication(p.id, snapshots), latest);
    const final = { ...edit(latest), title: "최종안" };
    latest = await editPublication(p.id, final, true);
    assert.deepEqual(await editPublication(p.id, final, true), latest);
  } else assert.deepEqual(await editPublication(p.id, publish, true), latest);
  await assert.rejects(editPublication(p.id, edit(latest)), { status: 409 });
  assert.equal((await getPublicPublication(p.id)).number, latest.number);
  assert.equal("title" in (await getPublicPublication(p.id)), false);
  assert.ok(
    (await listPublications()).some(
      (d) => d.id === p.id && d.state === "published",
    ),
  );
});

test("draft inputs cannot inject authors, arbitrary images, or unknown decisions", async () => {
  assert.equal(
    createPublicationSchema.safeParse({
      id: randomUUID(),
      snapshots: { ...snapshots, "as-is-2d": "https://tracker.example/image" },
    }).success,
    false,
  );
  assert.equal(
    createPublicationSchema.safeParse({
      id: randomUUID(),
      snapshots,
      authorId: "leak",
    }).success,
    false,
  );
  const p = await createPublication(randomUUID(), snapshots);
  assert.equal(
    editPublicationSchema.safeParse({ ...edit(p), snapshots }).success,
    false,
  );
  assert.equal(
    editPublicationSchema.safeParse({
      ...edit(p),
      decisions: [{ id: randomUUID(), content: "text", authorId: "leak" }],
    }).success,
    false,
  );
  await assert.rejects(
    editPublication(p.id, {
      ...edit(p),
      decisions: [{ id: randomUUID(), content: "외부 의견 삽입" }],
    }),
    { status: 400 },
  );
  await assert.rejects(getPublicPublication(randomUUID()), { status: 404 });
  await assert.rejects(getPublication("../../.env.local"), { status: 404 });
});

test("interactive model version survives edits and publish; image-only records stay image-only", async () => {
  const p = await createPublication(randomUUID(), snapshots, 1);
  assert.equal(p.drawingVersion, 1);
  assert.deepEqual(await createPublication(p.id, snapshots, 1), p);
  await assert.rejects(createPublication(p.id, snapshots), { status: 409 });
  assert.equal(editPublicationSchema.safeParse({ ...edit(p), drawingVersion: 1 }).success, false);
  const published = await editPublication(p.id, edit(p), true);
  assert.equal(published.drawingVersion, 1);
  assert.equal((await getPublicPublication(p.id)).drawingVersion, 1);
  const legacy = await createPublication(randomUUID(), snapshots);
  assert.equal(legacy.drawingVersion, undefined);
  assert.equal(createPublicationSchema.safeParse({ id: randomUUID(), snapshots, drawingVersion: 999 }).success, false);
});

test("deleting a published brief revokes its link and blocks recreation and stale writes", async () => {
  const { deletePublication } = await import("../lib/publication-store");
  const p = await createPublication(randomUUID(), snapshots, 1);
  const publicationInput = edit(p);
  const published = await editPublication(p.id, publicationInput, true);
  await assert.rejects(deletePublication(p.id, p.version), { status: 409 });
  await deletePublication(p.id, published.version);
  await deletePublication(p.id, published.version);
  await assert.rejects(getPublicPublication(p.id), { status: 404 });
  await assert.rejects(getPublication(p.id), { status: 404 });
  await assert.rejects(createPublication(p.id, snapshots, 1), { status: 410 });
  await assert.rejects(editPublication(p.id, publicationInput, true), { status: 404 });
  assert.equal((await listPublications()).some((item) => item.id === p.id), false);
  const next = await createPublication(randomUUID(), snapshots, 1);
  assert.ok(next.number! > published.number!);
});

test("deletion and draft saving use CAS and cannot restore a deleted brief", async () => {
  const { deletePublication } = await import("../lib/publication-store");
  const p = await createPublication(randomUUID(), snapshots, 1);
  const results = await Promise.allSettled([
    editPublication(p.id, edit(p)),
    deletePublication(p.id, p.version),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  const surviving = (await listPublications()).find((item) => item.id === p.id);
  if (surviving) await deletePublication(p.id, surviving.version);
  await assert.rejects(getPublication(p.id), { status: 404 });
});

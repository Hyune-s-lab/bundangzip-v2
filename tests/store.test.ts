import { test, after } from "node:test";
import assert from "node:assert/strict";
import { rm, readFile, writeFile } from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import {
  addComment,
  addFeedback,
  listComments,
  deleteComment,
} from "../lib/store";
import {
  containsPoint,
  createCommentSchema,
  floorplanVersion,
  rooms,
  wholeHouseId,
  type NewComment,
} from "../lib/model";
import { createSession, validSession, passwordMatches } from "../lib/auth";
const directory = mkdtempSync(`${tmpdir()}/bundangzip-test-`);
process.env.COMMENT_DATA_DIR = directory;
delete process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.VERCEL;
process.env.APP_PASSWORD = "test-password";
process.env.SESSION_SECRET =
  "test-secret-that-is-longer-than-thirty-two-characters";
after(() => rm(directory, { recursive: true, force: true }));
const input = (): NewComment => ({
  id: randomUUID(),
  authorId: "member-test",
  roomId: "bedroom-nw",
  floorplanVersion,
  x: 305 / 923,
  y: 207 / 676,
  content: "창가에 콘센트를 추가해주세요.",
});
test("all keyboard room anchors fall inside their selectable room", () => {
  for (const room of rooms)
    assert.equal(containsPoint(room, ...room.label), true, room.id);
  assert.equal(
    createCommentSchema.safeParse({ ...input(), x: 0.99, y: 0.99 }).success,
    false,
  );
  assert.equal(
    createCommentSchema.safeParse({ ...input(), content: "   " }).success,
    false,
  );
});
test("sessions reject tampering, expiry and old-password signatures", () => {
  assert.equal(passwordMatches("test-password"), true);
  assert.equal(passwordMatches("different"), false);
  const token = createSession(1000);
  assert.equal(validSession(token, 2000), true);
  assert.equal(validSession(token + "x", 2000), false);
  assert.equal(validSession(token, 2000000000000), false);
  process.env.APP_PASSWORD = "changed";
  assert.equal(validSession(token, 2000), false);
  process.env.APP_PASSWORD = "test-password";
});
test("concurrent creates and retries retain every distinct opinion exactly once", async () => {
  const a = input(),
    b = input();
  await Promise.all([addComment(a), addComment(b), addComment(a)]);
  const saved = await listComments();
  assert.equal(saved.filter((c) => c.id === a.id).length, 1);
  assert.equal(saved.filter((c) => c.id === b.id).length, 1);
  await assert.rejects(addComment({ ...a, content: "같은 ID에 다른 내용" }), {
    status: 409,
  });
});
test("feedback changes original status, preserves original content and rejects stale writes", async () => {
  const original = await addComment(input());
  const accepted = {
    id: randomUUID(),
    authorId: "reviewer-1",
    status: "accepted" as const,
    reason: "좋은 의견이에요.",
    expectedVersion: 1,
  };
  const rejected = {
    ...accepted,
    id: randomUUID(),
    authorId: "reviewer-2",
    status: "rejected" as const,
  };
  const results = await Promise.allSettled([
    addFeedback(original.id, accepted),
    addFeedback(original.id, rejected),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.filter((r) => r.status === "rejected").length, 1);
  const winner = results.find((r) => r.status === "fulfilled")!;
  assert.equal(winner.status, "fulfilled");
  if (winner.status !== "fulfilled") return;
  const updated = winner.value;
  assert.equal(updated.content, original.content);
  assert.equal(updated.authorId, original.authorId);
  assert.equal(updated.createdAt, original.createdAt);
  assert.equal(updated.feedback.length, 1);
  assert.equal(updated.version, 2);
  const winningInput = updated.status === "accepted" ? accepted : rejected;
  const retry = await addFeedback(original.id, winningInput);
  assert.equal(retry.feedback.length, 1);
  const reopened = await addFeedback(original.id, {
    id: randomUUID(),
    authorId: "reviewer-3",
    status: "pending",
    reason: "다시 상의해요.",
    expectedVersion: 2,
  });
  assert.equal(reopened.feedback.length, 2);
  assert.equal(reopened.status, "pending");
  assert.equal(reopened.feedback[1].from, updated.status);
});

test("whole-house opinions have no coordinate while room opinions require an in-room anchor", () => {
  const general = { ...input(), roomId: wholeHouseId, x: null, y: null };
  assert.equal(createCommentSchema.safeParse(general).success, true);
  assert.equal(
    createCommentSchema.safeParse({ ...general, x: 0.5 }).success,
    false,
  );
  assert.equal(
    createCommentSchema.safeParse({ ...general, roomId: "bedroom-nw" }).success,
    false,
  );
  assert.equal(
    createCommentSchema.safeParse({ ...general, roomId: "unknown" }).success,
    false,
  );
});

test("kitchen and dining partition the old space without overlap and validate their anchors", () => {
  const kitchen = rooms.find((r) => r.id === "kitchen")!;
  const dining = rooms.find((r) => r.id === "dining")!;
  const old = {
    ...kitchen,
    points: "441,74 581,74 581,198 508,198 508,289 380,289 380,146 441,146",
  };
  for (let x = 380; x < 581; x += 7)
    for (let y = 74; y < 289; y += 7) {
      const matches =
        Number(containsPoint(kitchen, x, y)) +
        Number(containsPoint(dining, x, y));
      assert.equal(matches, Number(containsPoint(old, x, y)), `${x},${y}`);
    }
  for (const room of [kitchen, dining]) {
    const draft = {
      ...input(),
      roomId: room.id,
      x: room.label[0] / 923,
      y: room.label[1] / 676,
    };
    assert.equal(createCommentSchema.safeParse(draft).success, true);
    assert.equal(
      createCommentSchema.safeParse({
        ...draft,
        roomId: room.id === "kitchen" ? "dining" : "kitchen",
      }).success,
      false,
    );
  }
  assert.equal(
    createCommentSchema.parse({
      ...input(),
      roomId: "kitchen-dining",
      floorplanVersion: "measured-v1",
      x: 444 / 923,
      y: 198 / 676,
    }).roomId,
    "dining",
  );
});

test("legacy kitchen-dining records keep content and history when mapped, retried and given feedback", async () => {
  for (const [y, expectedRoom] of [
    [160, "kitchen"],
    [240, "dining"],
  ] as const) {
    const legacyDraft = {
      ...input(),
      roomId: "kitchen-dining",
      floorplanVersion: "measured-v1",
      x: 496 / 923,
      y: y / 676,
    };
    const old = {
      ...legacyDraft,
      status: "accepted",
      version: 2,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-02T00:00:00Z",
      feedback: [
        {
          id: randomUUID(),
          authorId: "reviewer-1",
          from: "pending",
          to: "accepted",
          reason: "기존 피드백",
          createdAt: "2026-01-02T00:00:00Z",
        },
      ],
    };
    const filename = `${directory}/${old.id}.json`;
    await writeFile(filename, JSON.stringify(old));
    const mapped = (await listComments()).find((c) => c.id === old.id)!;
    assert.deepEqual(mapped, { ...old, roomId: expectedRoom });
    assert.deepEqual(JSON.parse(await readFile(filename, "utf8")), old);
    const retry = await addComment(createCommentSchema.parse(legacyDraft));
    assert.equal(retry.roomId, expectedRoom);
    await assert.rejects(
      addFeedback(old.id, {
        id: randomUUID(),
        authorId: "reviewer-2",
        status: "rejected",
        reason: "",
        expectedVersion: 2,
      }),
      { status: 400 },
    );
    const undone = await addFeedback(old.id, {
      id: randomUUID(),
      authorId: "reviewer-2",
      status: "pending",
      reason: "",
      expectedVersion: 2,
    });
    assert.equal(undone.status, "pending");
    assert.deepEqual(undone.feedback[0], old.feedback[0]);
    const updated = await addFeedback(old.id, {
      id: randomUUID(),
      authorId: "reviewer-2",
      status: "rejected",
      reason: "새 피드백",
      expectedVersion: 3,
    });
    assert.equal(updated.feedback.length, 3);
    assert.equal(updated.roomId, expectedRoom);
    assert.equal(updated.version, 4);
    assert.equal(updated.content, old.content);
    assert.equal(updated.createdAt, old.createdAt);
    assert.equal(updated.x, old.x);
    assert.equal(updated.y, old.y);
    assert.deepEqual(updated.feedback[0], old.feedback[0]);
    assert.equal(
      (await addComment(createCommentSchema.parse(legacyDraft))).id,
      old.id,
    );
  }
});

test("deletion is idempotent, excludes counts, preserves history and prevents resurrection", async () => {
  const draft = input();
  const original = await addComment(draft);
  const accepted = await addFeedback(original.id, {
    id: randomUUID(),
    authorId: "reviewer",
    status: "accepted",
    reason: "보존할 내용",
    expectedVersion: 1,
  });
  const deletion = {
    id: randomUUID(),
    authorId: "family-member",
    expectedVersion: 2,
  };
  await assert.rejects(
    deleteComment(original.id, { ...deletion, expectedVersion: 1 }),
    { status: 409 },
  );
  await deleteComment(original.id, deletion);
  await deleteComment(original.id, deletion);
  assert.equal(
    (await listComments()).some((c) => c.id === original.id),
    false,
  );
  const stored = JSON.parse(
    await readFile(`${directory}/${original.id}.json`, "utf8"),
  );
  assert.deepEqual(stored.feedback, accepted.feedback);
  assert.equal(stored.content, original.content);
  assert.equal(stored.createdAt, original.createdAt);
  assert.equal(stored.deletion.authorId, deletion.authorId);
  await assert.rejects(addComment(draft), { status: 410 });
  await assert.rejects(
    addFeedback(original.id, {
      id: randomUUID(),
      authorId: "reviewer",
      status: "pending",
      reason: "",
      expectedVersion: 3,
    }),
    { status: 404 },
  );
});
test("concurrent deletion and feedback cannot overwrite one another", async () => {
  const original = await addComment(input());
  const results = await Promise.allSettled([
    deleteComment(original.id, {
      id: randomUUID(),
      authorId: "family-member",
      expectedVersion: 1,
    }),
    addFeedback(original.id, {
      id: randomUUID(),
      authorId: "reviewer",
      status: "accepted",
      reason: "",
      expectedVersion: 1,
    }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.filter((r) => r.status === "rejected").length, 1);
  const stored = JSON.parse(
    await readFile(`${directory}/${original.id}.json`, "utf8"),
  );
  assert.equal(stored.version, 2);
  assert.equal(Boolean(stored.deletion), stored.feedback.length === 0);
});

test("v3 room corrections preserve old comments and retries while validating the new rectangle", async () => {
  const original = {
    ...input(),
    roomId: "kitchen",
    floorplanVersion: "measured-v2",
    x: 395 / 923,
    y: 165 / 676,
  };
  const parsed = createCommentSchema.parse(original);
  const saved = await addComment(parsed);
  assert.equal(saved.roomId, "kitchen");
  assert.equal(saved.floorplanVersion, "measured-v2");
  assert.deepEqual(
    await addComment(createCommentSchema.parse(original)),
    saved,
  );
  assert.deepEqual(
    (await listComments()).find((c) => c.id === saved.id),
    saved,
  );
  assert.equal(
    createCommentSchema.safeParse({ ...original, floorplanVersion }).success,
    false,
  );
  assert.equal(
    createCommentSchema.safeParse({
      ...original,
      floorplanVersion,
      roomId: "dining",
    }).success,
    true,
  );
  const oldCombined = createCommentSchema.parse({
    ...original,
    roomId: "kitchen-dining",
    floorplanVersion: "measured-v1",
    x: 496 / 923,
    y: 180 / 676,
  });
  assert.equal(oldCombined.roomId, "kitchen");
  assert.equal(
    createCommentSchema.safeParse({
      ...original,
      floorplanVersion,
      x: 496 / 923,
      y: 180 / 676,
    }).success,
    false,
  );
});

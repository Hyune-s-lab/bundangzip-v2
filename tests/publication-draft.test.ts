import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createSummarizedPublication } from "../lib/publication-draft";
import {
  createPublication,
  editPublication,
  getPublication,
} from "../lib/publication-store";
import {
  reservePublicationNumber,
  publicationDay,
} from "../lib/publication-number";
import { emptyBrief, type Snapshots } from "../lib/publication";
const directory = mkdtempSync(path.join(tmpdir(), "bundang-auto-brief-"));
process.env.PUBLICATION_DATA_DIR = path.join(directory, "publications");
process.env.COMMENT_DATA_DIR = path.join(directory, "comments");
delete process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.VERCEL;
after(() => rm(directory, { recursive: true, force: true }));
const snapshots: Snapshots = {
  "as-is-2d": "data:image/jpeg;base64,/9j/AA==",
  "as-is-3d": "data:image/jpeg;base64,/9j/AA==",
  "to-be-2d": "data:image/jpeg;base64,/9j/AA==",
  "to-be-3d": "data:image/jpeg;base64,/9j/AA==",
};
const summary = { ...emptyBrief(), overview: "공통 공사 요청" };

test("creation persists the AI summary, number and snapshot timestamp before returning, and retries do not regenerate", async () => {
  let calls = 0;
  const id = randomUUID();
  const generate = async () => {
    calls++;
    return summary;
  };
  const p = await createSummarizedPublication(id, snapshots, generate);
  assert.deepEqual(p.brief, summary);
  assert.equal(p.version, 2);
  assert.ok(p.number! > 0);
  assert.deepEqual(await getPublication(id), p);
  assert.deepEqual(
    await createSummarizedPublication(id, snapshots, generate),
    p,
  );
  assert.equal(calls, 1);
});

test("AI failure preserves the frozen draft and retry reuses its number and original timestamp", async () => {
  const id = randomUUID();
  await assert.rejects(
    createSummarizedPublication(id, snapshots, async () => {
      throw new Error("provider unavailable");
    }),
  );
  const frozen = await getPublication(id);
  const retried = await createSummarizedPublication(
    id,
    snapshots,
    async () => summary,
  );
  assert.equal(retried.number, frozen.number);
  assert.equal(retried.snapshotAt, frozen.snapshotAt);
  assert.deepEqual(retried.snapshots, frozen.snapshots);
});

test("automatic summary cannot overwrite a manual edit made while generation is running", async () => {
  const id = randomUUID();
  const p = await createPublication(id, snapshots);
  const result = await createSummarizedPublication(id, snapshots, async () => {
    await editPublication(id, {
      requestId: randomUUID(),
      expectedVersion: p.version,
      title: p.title,
      introduction: p.introduction,
      decisions: [],
      brief: { ...emptyBrief(), overview: "직접 수정한 요청" },
    });
    return summary;
  });
  assert.equal(result.brief.overview, "직접 수정한 요청");
});

test("concurrent daily reservations are unique, retries stable, and numbering follows Korean midnight", async () => {
  const time = "2030-01-01T14:59:59.000Z";
  const ids = Array.from({ length: 8 }, () => randomUUID());
  const numbers = await Promise.all(
    ids.map((id) => reservePublicationNumber(id, time)),
  );
  assert.equal(new Set(numbers).size, ids.length);
  assert.deepEqual(
    [...numbers].sort((a, b) => a - b),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
  for (let i = 0; i < ids.length; i++)
    assert.equal(await reservePublicationNumber(ids[i], time), numbers[i]);
  const sameId = randomUUID();
  const same = await Promise.all(
    Array.from({ length: 4 }, () => reservePublicationNumber(sameId, time)),
  );
  assert.equal(new Set(same).size, 1);
  assert.equal(publicationDay(time), "2030-01-01");
  assert.equal(publicationDay("2030-01-01T15:00:00Z"), "2030-01-02");
  assert.equal(
    await reservePublicationNumber(randomUUID(), "2030-01-01T15:00:00Z"),
    1,
  );
});

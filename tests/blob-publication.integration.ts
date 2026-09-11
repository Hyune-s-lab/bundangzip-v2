// Run explicitly with a test Blob token: node --import tsx tests/blob-publication.integration.ts
// Every record is isolated under a fresh namespace and removed on completion.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { del, list } from "@vercel/blob";
import { reservePublicationNumber } from "../lib/publication-number";
import { addComment, addFeedback } from "../lib/store";
import {
  createPublication,
  editPublication,
  getPublication,
  getPublicPublication,
} from "../lib/publication-store";
import {
  snapshotKeys,
  type Publication,
  type Snapshots,
} from "../lib/publication";

async function main() {
  assert.ok(process.env.BLOB_READ_WRITE_TOKEN, "A Blob test token is required");
  const ns = `qa_publications_${randomUUID().replaceAll("-", "")}`;
  process.env.COMMENT_NAMESPACE = ns;
  try {
    const c = await addComment({
      id: randomUUID(),
      authorId: "test-author",
      roomId: "whole-house",
      x: null,
      y: null,
      floorplanVersion: "measured-v3",
      content: "실제 저장소 압축 검증 ".repeat(150),
    });
    await addFeedback(c.id, {
      id: randomUUID(),
      authorId: "test-reviewer",
      expectedVersion: 1,
      status: "accepted",
      reason: "",
    });
    // The large body exercises the CDN compression threshold; rendering is tested in-browser.
    const snapshots = Object.fromEntries(
      snapshotKeys.map((key) => [
        key,
        "data:image/jpeg;base64,/9j/" + "A".repeat(100000),
      ]),
    ) as Snapshots;
    const p = await createPublication(randomUUID(), snapshots);
    assert.equal(p.decisions.length, 1);
    assert.equal(p.number, 1);
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    const numbers = await Promise.all(ids.map(id => reservePublicationNumber(id, p.snapshotAt)));
    assert.deepEqual([...numbers].sort((a, b) => a - b), [2, 3, 4]);
    assert.equal(await reservePublicationNumber(ids[0], p.snapshotAt), numbers[0]);
    const edit = (p: Publication) => ({
      requestId: randomUUID(),
      expectedVersion: p.version,
      title: p.title,
      introduction: p.introduction,
      brief: {
        overview: "업체 전달용 요약",
        common: "",
        spaces: [],
        questions: "",
      },
      decisions: p.decisions.map(({ id, content }) => ({ id, content })),
    });
    const saved = await editPublication(p.id, edit(p));
    assert.equal(saved.version, 2);
    const results = await Promise.allSettled([
      editPublication(p.id, edit(saved)),
      editPublication(p.id, edit(saved)),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.filter((r) => r.status === "rejected").length, 1);
    const latest = await getPublication(p.id);
    const request = edit(latest);
    const published = await editPublication(p.id, request, true);
    assert.equal(published.state, "published");
    assert.deepEqual(await editPublication(p.id, request, true), published);
    assert.equal(
      (await getPublicPublication(p.id)).brief.overview,
      "업체 전달용 요약",
    );
    await assert.rejects(editPublication(p.id, edit(published)), {
      status: 409,
    });
    console.log(
      "Blob: large snapshots, comment feedback, CAS, retry and immutable publication passed",
    );
  } finally {
    const records = await list({ prefix: `bundangzip/${ns}/` });
    for (const b of records.blobs) await del(b.url);
    console.log("Isolated Blob fixtures removed");
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

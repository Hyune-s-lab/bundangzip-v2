import { test } from "node:test";
import assert from "node:assert/strict";
import { commentDayKey, groupCommentsByDay } from "../lib/comment-timeline";

test("timeline groups follow Korean midnight and retain comment ordering", () => {
  const comments = [
    { id: "new", createdAt: "2026-09-11T16:00:00Z" },
    { id: "midnight", createdAt: "2026-09-11T15:00:00Z" },
    { id: "before", createdAt: "2026-09-11T14:59:59Z" },
  ];
  const groups = groupCommentsByDay(comments);
  assert.deepEqual(groups.map((g) => [g.key, g.comments.map((c) => c.id)]), [
    ["2026-09-12", ["new", "midnight"]], ["2026-09-11", ["before"]],
  ]);
  assert.equal(commentDayKey(comments[1].createdAt), "2026-09-12");
});

test("date groups remain distinct across years and handle filtered or empty lists", () => {
  const comments = [
    { id: "next-year", createdAt: "2027-09-11T01:00:00Z" },
    { id: "this-year", createdAt: "2026-09-11T01:00:00Z" },
  ];
  assert.equal(groupCommentsByDay(comments).length, 2);
  assert.equal(groupCommentsByDay(comments.slice(1))[0].comments.length, 1);
  assert.deepEqual(groupCommentsByDay([]), []);
});

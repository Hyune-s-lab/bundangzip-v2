import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const ids = [];
async function call(route, method = "GET", body, token = "") {
  const response = await fetch(base + route, {
    method,
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      ...(token ? { Cookie: token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  return { response, data };
}
try {
  assert.equal((await call("/api/comments")).response.status, 401);
  assert.equal((await call("/api/bootstrap")).response.status, 401);
  assert.equal(
    (await call("/api/session", "POST", { password: "wrong-test-value" }))
      .response.status,
    401,
  );
  const login = await call("/api/session", "POST", {
    password: process.env.APP_PASSWORD,
  });
  assert.equal(login.response.status, 200);
  const token = login.response.headers.get("set-cookie").split(";")[0];
  assert.match(login.response.headers.get("set-cookie"), /HttpOnly/i);
  const { data: config } = await call("/api/bootstrap", "GET", null, token);
  assert.ok(config.members.length > 0);
  assert.equal(config.rooms.length, 13);
  assert.ok(config.rooms.some((r) => r.id === "kitchen"));
  assert.ok(config.rooms.some((r) => r.id === "dining"));
  const input = {
    id: randomUUID(),
    authorId: config.members[0].id,
    roomId: "bedroom-nw",
    floorplanVersion: config.floorplanVersion,
    x: 305 / 923,
    y: 207 / 676,
    content: "API 검증용 의견",
  };
  ids.push(input.id);
  const cross = await fetch(base + "/api/comments", {
    method: "POST",
    headers: {
      Origin: "https://invalid.example",
      "Content-Type": "application/json",
      Cookie: token,
    },
    body: JSON.stringify(input),
  });
  assert.equal(cross.status, 403);
  assert.equal(
    (
      await call(
        "/api/comments",
        "POST",
        { ...input, authorId: "invalid" },
        token,
      )
    ).response.status,
    400,
  );
  assert.equal(
    (await call("/api/comments", "POST", { ...input, x: 0.99 }, token)).response
      .status,
    400,
  );
  const created = await call("/api/comments", "POST", input, token);
  assert.equal(created.response.status, 201);
  const retried = await call("/api/comments", "POST", input, token);
  assert.equal(retried.response.status, 201);
  const general = {
    ...input,
    id: randomUUID(),
    roomId: "whole-house",
    x: null,
    y: null,
    content: "API 검증용 집 전체 의견",
  };
  ids.push(general.id);
  assert.equal(
    (await call("/api/comments", "POST", { ...general, x: 0.5 }, token))
      .response.status,
    400,
  );
  assert.equal(
    (await call("/api/comments", "POST", { ...input, x: null, y: null }, token))
      .response.status,
    400,
  );
  const generalCreated = await call("/api/comments", "POST", general, token);
  assert.equal(generalCreated.response.status, 201);
  assert.equal(generalCreated.data.comment.x, null);
  assert.equal(generalCreated.data.comment.y, null);
  const feedback = {
    id: randomUUID(),
    authorId: config.members.at(-1).id,
    status: "accepted",
    reason: "API 검증용 피드백",
    expectedVersion: 1,
  };
  const changed = await call(
    `/api/comments/${input.id}/feedback`,
    "POST",
    feedback,
    token,
  );
  assert.equal(changed.response.status, 200);
  assert.equal(changed.data.comment.status, "accepted");
  assert.equal(changed.data.comment.authorId, input.authorId);
  assert.equal(changed.data.comment.feedback[0].authorId, feedback.authorId);
  assert.equal(
    (
      await call(
        `/api/comments/${general.id}/feedback`,
        "POST",
        { ...feedback, id: randomUUID() },
        token,
      )
    ).data.comment.status,
    "accepted",
  );
  const stale = await call(
    `/api/comments/${input.id}/feedback`,
    "POST",
    { ...feedback, id: randomUUID(), status: "rejected" },
    token,
  );
  assert.equal(stale.response.status, 409);
  assert.equal(
    (await call(`/api/comments/${input.id}/feedback`, "POST", feedback, token))
      .data.comment.feedback.length,
    1,
  );
  const anotherLogin = await call("/api/session", "POST", {
    password: process.env.APP_PASSWORD,
  });
  const secondToken = anotherLogin.response.headers
    .get("set-cookie")
    .split(";")[0];
  const reread = await call("/api/comments", "GET", null, secondToken);
  assert.equal(reread.data.comments.filter((c) => c.id === input.id).length, 1);
  assert.equal(
    reread.data.comments.find((c) => c.id === input.id).status,
    "accepted",
  );
  const generalSaved = reread.data.comments.find((c) => c.id === general.id);
  assert.equal(generalSaved.roomId, "whole-house");
  assert.equal(generalSaved.x, null);
  assert.equal(generalSaved.y, null);
  assert.equal(generalSaved.status, "accepted");
  assert.equal(
    (
      await call(
        `/api/comments/${general.id}/feedback`,
        "POST",
        {
          ...feedback,
          id: randomUUID(),
          status: "rejected",
          expectedVersion: 2,
        },
        token,
      )
    ).response.status,
    400,
  );
  const undo = await call(
    `/api/comments/${general.id}/feedback`,
    "POST",
    {
      ...feedback,
      id: randomUUID(),
      status: "pending",
      reason: "",
      expectedVersion: 2,
    },
    token,
  );
  assert.equal(undo.data.comment.status, "pending");
  assert.equal(undo.data.comment.feedback.length, 2);
  assert.equal(undo.data.comment.feedback[0].reason, feedback.reason);
  const deletion = {
    id: randomUUID(),
    authorId: config.members[0].id,
    expectedVersion: 3,
  };
  assert.equal(
    (await call(`/api/comments/${general.id}`, "DELETE", deletion)).response
      .status,
    401,
  );
  assert.equal(
    (
      await call(
        `/api/comments/${general.id}`,
        "DELETE",
        { ...deletion, authorId: "unknown" },
        token,
      )
    ).response.status,
    400,
  );
  assert.equal(
    (
      await call(
        `/api/comments/${general.id}`,
        "DELETE",
        { ...deletion, expectedVersion: 2 },
        token,
      )
    ).response.status,
    409,
  );
  const deleteCross = await fetch(base + `/api/comments/${general.id}`, {
    method: "DELETE",
    headers: {
      Origin: "https://invalid.example",
      "Content-Type": "application/json",
      Cookie: token,
    },
    body: JSON.stringify(deletion),
  });
  assert.equal(deleteCross.status, 403);
  assert.equal(
    (await call(`/api/comments/${general.id}`, "DELETE", deletion, token))
      .response.status,
    200,
  );
  assert.equal(
    (await call(`/api/comments/${general.id}`, "DELETE", deletion, token))
      .response.status,
    200,
  );
  assert.equal(
    (await call("/api/comments", "GET", null, secondToken)).data.comments.some(
      (c) => c.id === general.id,
    ),
    false,
  );
  assert.equal(
    (
      await call(
        `/api/comments/${general.id}/feedback`,
        "POST",
        { ...feedback, id: randomUUID(), expectedVersion: 4 },
        token,
      )
    ).response.status,
    404,
  );
  assert.equal(
    (await call("/api/session", "DELETE", null, token)).response.status,
    200,
  );
  console.log(
    "API checks passed: auth, CSRF, member/coordinate validation, persistent comments, feedback, stale write protection, retry deduplication, second session, logout.",
  );
} finally {
  if (base === "http://localhost:3000")
    for (const id of ids)
      await unlink(`.data/comments/${id}.json`).catch(() => {});
  else if (ids.length) console.log("Verification record IDs:", ids.join(", "));
}

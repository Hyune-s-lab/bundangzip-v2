import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { parseSummary, summaryInput } from "../lib/contractor-summary";
import { generateSummary } from "../lib/summary-provider";
const decisions = [
  { id: "one", roomId: "living", roomName: "거실", content: "흰 벽지로 교체" },
  { id: "two", roomId: "living", roomName: "거실", content: "벽지는 흰색" },
];
const output = {
  brief: {
    overview: "거실 벽지 교체",
    common: "",
    spaces: [{ roomName: "거실", work: "흰색 벽지로 교체해주세요." }],
    questions: "",
  },
  evidence: [
    { sourceId: "one", section: "spaces" },
    { sourceId: "two", section: "spaces" },
  ],
};
const originalFetch = globalThis.fetch;
const originalKey = process.env.OPENROUTER_API_KEY;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey) process.env.OPENROUTER_API_KEY = originalKey;
  else delete process.env.OPENROUTER_API_KEY;
});
test("summary evidence covers merged requests and rejects omitted or invented sources and rooms", () => {
  assert.deepEqual(
    parseSummary(JSON.stringify(output), decisions),
    output.brief,
  );
  assert.throws(
    () =>
      parseSummary(
        JSON.stringify({ ...output, evidence: output.evidence.slice(0, 1) }),
        decisions,
      ),
    { status: 502 },
  );
  assert.throws(
    () =>
      parseSummary(
        JSON.stringify({
          ...output,
          evidence: [
            ...output.evidence,
            { sourceId: "invented", section: "spaces" },
          ],
        }),
        decisions,
      ),
    { status: 502 },
  );
  assert.throws(
    () =>
      parseSummary(
        JSON.stringify({
          ...output,
          brief: {
            ...output.brief,
            spaces: [{ roomName: "없는 방", work: "추가 공사" }],
          },
        }),
        decisions,
      ),
    { status: 502 },
  );
  assert.throws(() => parseSummary("{broken", decisions), { status: 502 });
});
test("summary input is an allowlist with bounded source data", () => {
  const source = {
    ...decisions[0],
    authorId: "private",
    feedback: "private",
    snapshot: "private",
  };
  assert.deepEqual(JSON.parse(summaryInput([source])), [
    { id: "one", roomName: "거실", content: "흰 벽지로 교체" },
  ]);
  assert.throws(() => summaryInput([]), { status: 400 });
  assert.throws(
    () => summaryInput([{ ...source, content: "a".repeat(80001) }]),
    { status: 413 },
  );
});
test("provider uses only free pricing and returns validated summary", async () => {
  process.env.OPENROUTER_API_KEY = "test-key";
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
    const body = JSON.parse(String(init?.body));
    assert.ok(body.model.endsWith(":free"));
    assert.deepEqual(body.provider.max_price, { prompt: 0, completion: 0 });
    assert.equal(body.messages[1].content, summaryInput(decisions));
    return Response.json({
      choices: [
        { finish_reason: "stop", message: { content: JSON.stringify(output) } },
      ],
    });
  };
  assert.deepEqual(await generateSummary(decisions), output.brief);
});
test("provider failure is explicit and has no paid or repeated fallback", async () => {
  process.env.OPENROUTER_API_KEY = "test-key";
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response("rate limited", { status: 429 });
  };
  await assert.rejects(generateSummary(decisions), { status: 429 });
  assert.equal(calls, 1);
  globalThis.fetch = async () =>
    Response.json({
      choices: [
        {
          finish_reason: "length",
          message: { content: JSON.stringify(output) },
        },
      ],
    });
  await assert.rejects(generateSummary(decisions), { status: 502 });
  delete process.env.OPENROUTER_API_KEY;
  await assert.rejects(generateSummary(decisions), { status: 503 });
});

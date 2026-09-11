import { NextResponse } from "next/server";
import { ZodError } from "zod";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export function errorResponse(error: unknown) {
  if (error instanceof HttpError)
    return json({ error: error.message }, error.status);
  if (error instanceof ZodError)
    return json(
      { error: error.issues[0]?.message ?? "입력값을 확인해주세요." },
      400,
    );
  if (error instanceof SyntaxError)
    return json({ error: "입력 형식을 확인해주세요." }, 400);
  console.error(
    "Request failed:",
    error instanceof Error ? error.name : "UnknownError",
  );
  return json(
    { error: "저장소에 연결하지 못했어요. 잠시 후 다시 시도해주세요." },
    503,
  );
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = new URL(request.url);
  expected.host = request.headers.get("host") ?? expected.host;
  if (process.env.VERCEL) expected.protocol = "https:";
  if (!origin || origin !== expected.origin)
    throw new HttpError(403, "허용되지 않은 요청입니다.");
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new HttpError(403, "허용되지 않은 요청입니다.");
}
export async function readJson(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "JSON 요청이 필요합니다.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "입력값을 확인해주세요.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16000) {
      await reader.cancel();
      throw new HttpError(413, "입력 내용이 너무 길어요.");
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

import { HttpError } from "./http";
import {
  summaryInput,
  summaryInstructions,
  parseSummary,
} from "./contractor-summary";
import type { Decision } from "./publication";

export async function generateSummary(decisions: Decision[]) {
  const content = summaryInput(decisions);
  const key = process.env.OPENROUTER_API_KEY;
  if (!key)
    throw new HttpError(
      503,
      "요약 AI 연결이 필요해요. 지금은 직접 작성하고 저장할 수 있습니다.",
    );
  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "nex-agi/nex-n2.5-pro:free",
          messages: [
            { role: "system", content: summaryInstructions },
            { role: "user", content },
          ],
          max_tokens: 7000,
          temperature: 0.2,
          response_format: { type: "json_object" },
          provider: { max_price: { prompt: 0, completion: 0 } },
        }),
        signal: AbortSignal.timeout(100_000),
        cache: "no-store",
      },
    );
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 429)
        throw new HttpError(
          429,
          "AI 사용량 제한에 도달했어요. 잠시 후 다시 시도하거나 직접 편집해주세요.",
        );
      if ([401, 402, 403].includes(response.status))
        throw new HttpError(
          503,
          "AI 인증 또는 크레딧 설정을 확인해주세요. 직접 작성과 저장은 가능합니다.",
        );
      throw new HttpError(
        502,
        "AI가 응답하지 못했어요. 잠시 후 다시 시도해주세요.",
      );
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Empty response");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 500_000) {
        await reader.cancel();
        throw new Error("Response too large");
      }
      chunks.push(value);
    }
    const result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const choice = result.choices?.[0];
    if (
      choice?.finish_reason === "length" ||
      typeof choice?.message?.content !== "string"
    )
      throw new Error("Incomplete output");
    return parseSummary(choice.message.content, decisions);
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(
      502,
      "요약을 완성하지 못했어요. 기존 편집 내용은 유지됩니다. 잠시 후 다시 시도해주세요.",
    );
  }
}

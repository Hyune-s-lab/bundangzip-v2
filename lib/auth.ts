import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { HttpError } from "./http";
import type { Member } from "./model";
export const cookieName = "bundangzip-session";
export const sessionDuration = 60 * 60 * 24 * 180;
function secret() {
  const key = process.env.SESSION_SECRET;
  if (!key || key.length < 32 || !process.env.APP_PASSWORD)
    throw new HttpError(503, "로그인 설정이 아직 준비되지 않았어요.");
  return key + ":" + process.env.APP_PASSWORD;
}
function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}
export function createSession(now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({ expires: now + sessionDuration * 1000 }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}
export function validSession(token: string | undefined, now = Date.now()) {
  if (!token || token.length > 1024) return false;
  const [payload, signature, ...rest] = token.split(".");
  if (!payload || !signature || rest.length) return false;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof data.expires === "number" && data.expires > now;
  } catch {
    return false;
  }
}
export async function authenticated() {
  return validSession((await cookies()).get(cookieName)?.value);
}
export async function requireAuth() {
  if (!(await authenticated()))
    throw new HttpError(401, "다시 로그인해주세요.");
}
export function passwordMatches(value: string) {
  secret();
  const hash = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(hash(value), hash(process.env.APP_PASSWORD!));
}
export function getMembers(): Member[] {
  const result = z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        name: z.string().min(1).max(40),
        emoji: z.string().max(20).default("🧑"),
      }),
    )
    .min(1)
    .max(30)
    .safeParse(JSON.parse(process.env.FAMILY_MEMBERS ?? "[]"));
  if (
    !result.success ||
    new Set(result.data.map((m) => m.id)).size !== result.data.length
  )
    throw new HttpError(503, "구성원 설정이 아직 준비되지 않았어요.");
  return result.data;
}
export function requireMember(id: string) {
  if (!getMembers().some((m) => m.id === id))
    throw new HttpError(400, "구성원을 다시 선택해주세요.");
}
// Best-effort per-instance throttling. This is not a deployment-wide rate limit.
const attempts = new Map<string, { count: number; reset: number }>();
export function checkLoginRate(request: Request) {
  const ip =
    request.headers.get("x-vercel-forwarded-for") ??
    (process.env.VERCEL
      ? "unknown"
      : (request.headers.get("x-forwarded-for") ?? "local"));
  const now = Date.now();
  if (attempts.size > 5000)
    for (const [key, v] of attempts) if (v.reset < now) attempts.delete(key);
  const record = attempts.get(ip);
  if (record && record.reset > now) {
    if (record.count >= 15)
      throw new HttpError(429, "잠시 쉬었다가 10분 뒤 다시 시도해주세요.");
    record.count++;
  } else attempts.set(ip, { count: 1, reset: now + 600000 });
}

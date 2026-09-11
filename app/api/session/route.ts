import { cookies } from "next/headers";
import { z } from "zod";
import {
  authenticated,
  checkLoginRate,
  cookieName,
  createSession,
  passwordMatches,
  sessionDuration,
} from "@/lib/auth";
import {
  errorResponse,
  HttpError,
  json,
  readJson,
  sameOrigin,
} from "@/lib/http";
export const runtime = "nodejs";
export async function GET() {
  try {
    return json({ authenticated: await authenticated() });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    checkLoginRate(request);
    const { password } = z
      .object({ password: z.string().max(256) })
      .parse(await readJson(request));
    if (!passwordMatches(password))
      throw new HttpError(401, "비밀번호가 맞지 않아요. 다시 확인해주세요.");
    (await cookies()).set(cookieName, createSession(), {
      httpOnly: true,
      secure: !!process.env.VERCEL,
      sameSite: "lax",
      path: "/",
      maxAge: sessionDuration,
    });
    return json({ authenticated: true });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    (await cookies()).delete(cookieName);
    return json({ authenticated: false });
  } catch (e) {
    return errorResponse(e);
  }
}

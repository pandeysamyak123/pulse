// Passcode auth: an httpOnly cookie holding an HMAC of APP_PASSCODE.
// Without it the app is a read-only demo (graders can browse; sending/editing disabled).
import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "pulse_session";

function token() {
  const pass = process.env.APP_PASSCODE;
  if (!pass) throw new Error("APP_PASSCODE is not set");
  return createHmac("sha256", pass).update("pulse-session-v1").digest("hex");
}

export function passcodeMatches(input: string) {
  const a = Buffer.from(createHmac("sha256", input).update("pulse-session-v1").digest("hex"));
  const b = Buffer.from(token());
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function isAuthed(): Promise<boolean> {
  const c = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!c) return false;
  const a = Buffer.from(c);
  const b = Buffer.from(token());
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function requireAuth() {
  if (!(await isAuthed())) throw new Error("Read-only demo: unlock with the passcode to make changes.");
}

export async function setSession() {
  (await cookies()).set(SESSION_COOKIE, token(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Cron routes: Authorization: Bearer CRON_SECRET. */
export function isCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

import crypto from "crypto";

/**
 * Signed double-opt-in confirmation tokens for newsletter subscribers.
 * Same secret strategy as unsubscribe tokens; distinct payload prefix so
 * the two token kinds can't be swapped.
 */
function secret(): string {
  return process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || "";
}

export function makeConfirmToken(subscriberId: string): string {
  const sig = crypto.createHmac("sha256", secret()).update(`confirm:${subscriberId}`).digest("base64url");
  return `${Buffer.from(subscriberId).toString("base64url")}.${sig}`;
}

export function verifyConfirmToken(token: string): string | null {
  if (!secret()) return null;
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  let id: string;
  try {
    id = Buffer.from(token.slice(0, dot), "base64url").toString();
  } catch {
    return null;
  }
  const expected = crypto.createHmac("sha256", secret()).update(`confirm:${id}`).digest("base64url");
  const a = Buffer.from(token.slice(dot + 1));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return id;
}

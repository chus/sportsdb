import crypto from "crypto";

/**
 * Signed unsubscribe tokens — one-click unsubscribe without login.
 *
 * Every list email links a tokenized unsubscribe URL (and carries it in
 * List-Unsubscribe headers per Gmail/Yahoo bulk-sender rules). The token is
 * HMAC-signed so it can't be forged to unsubscribe other people, and carries
 * a typed subject so the same route serves registered users ("u:<userId>")
 * and anonymous newsletter subscribers ("s:<subscriberId>").
 */
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export type UnsubscribeSubject =
  | { kind: "user"; id: string }
  | { kind: "subscriber"; id: string };

function secret(): string {
  // Dedicated secret preferred; CRON_SECRET is an acceptable fallback so the
  // feature works without new env plumbing.
  return process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || "";
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function makeUnsubscribeToken(subject: UnsubscribeSubject): string {
  const payload = `${subject.kind === "user" ? "u" : "s"}:${subject.id}`;
  const encoded = Buffer.from(payload).toString("base64url");
  return `${encoded}.${sign(payload)}`;
}

export function verifyUnsubscribeToken(token: string): UnsubscribeSubject | null {
  if (!secret()) return null;
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let payload: string;
  try {
    payload = Buffer.from(encoded, "base64url").toString();
  } catch {
    return null;
  }
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const [kind, id] = payload.split(":");
  if (!id) return null;
  if (kind === "u") return { kind: "user", id };
  if (kind === "s") return { kind: "subscriber", id };
  return null;
}

export function unsubscribeUrl(subject: UnsubscribeSubject): string {
  return `${BASE_URL}/api/email/unsubscribe?token=${encodeURIComponent(makeUnsubscribeToken(subject))}`;
}

/** Standard List-Unsubscribe headers (RFC 8058 one-click). */
export function unsubscribeHeaders(subject: UnsubscribeSubject): Record<string, string> {
  const url = unsubscribeUrl(subject);
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/** Footer snippet for list-email templates: visible unsubscribe without login. */
export function unsubscribeFooter(subject: UnsubscribeSubject): string {
  return `<p style="font-size:12px;color:#94a3b8;margin-top:16px;">
    <a href="${unsubscribeUrl(subject)}" style="color:#94a3b8;">Unsubscribe</a> ·
    <a href="${BASE_URL}/account" style="color:#94a3b8;">Manage preferences</a>
  </p>`;
}

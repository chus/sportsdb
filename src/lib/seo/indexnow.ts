/**
 * Search engine indexing integrations.
 *
 * ACTIVE:
 *   submitUrlsToIndexNow — pings Bing/Yandex/Naver/Seznam when pages change.
 *   (Google has never adopted IndexNow, so this helps non-Google engines only.)
 *
 * DEPRECATED — do not use for regular pages (kept only for a possible future
 * JobPosting/BroadcastEvent feed):
 *   pingGoogleSitemap   — Google removed the sitemap-ping endpoint in 2023; no-op.
 *   submitUrlsToGoogle  — the Indexing API is officially JobPosting/BroadcastEvent
 *                         ONLY. Using it for entity/article/comparison pages is
 *                         "misuse": Google ignores it and runs spam detection
 *                         (access can be revoked). Google finds those pages via
 *                         the sitemap, internal links, and earned backlinks.
 *
 * Usage:
 *   await submitUrlsToIndexNow(["/news/some-article", "/players/messi"]);
 */

import crypto from "crypto";

const INDEXNOW_KEY = "f0cd0abe449e475ca730a6f2930bd0ef";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export async function submitUrlsToIndexNow(paths: string[]): Promise<void> {
  if (!paths.length) return;

  const urlList = paths.map((p) =>
    p.startsWith("http") ? p : `${BASE_URL}${p.startsWith("/") ? "" : "/"}${p}`
  );

  try {
    const res = await fetch("https://api.indexnow.org/IndexNow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: new URL(BASE_URL).hostname,
        key: INDEXNOW_KEY,
        keyLocation: `${BASE_URL}/${INDEXNOW_KEY}.txt`,
        urlList,
      }),
    });

    if (!res.ok) {
      console.warn(`[IndexNow] ${res.status} ${res.statusText}`);
    }
  } catch (err) {
    // Non-critical — log and move on
    console.warn("[IndexNow] ping failed:", err);
  }
}

/**
 * @deprecated Google removed the sitemap-ping endpoint in 2023 — this is a no-op.
 * Submit the sitemap once in Search Console instead. Kept to avoid breaking callers.
 */
export async function pingGoogleSitemap(): Promise<void> {
  try {
    await fetch(
      `https://www.google.com/ping?sitemap=${encodeURIComponent(`${BASE_URL}/sitemap.xml`)}`
    );
  } catch {
    // Non-critical
  }
}

// ============================================================
// Google Indexing API
// ============================================================

const GOOGLE_INDEXING_ENDPOINT =
  "https://indexing.googleapis.com/v3/urlNotifications:publish";
const GOOGLE_BATCH_ENDPOINT =
  "https://indexing.googleapis.com/batch";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/indexing";

let cachedGoogleToken: { token: string; expiresAt: number } | null = null;

function getServiceAccount(): { client_email: string; private_key: string } | null {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (!parsed.client_email || !parsed.private_key) return null;
    return parsed;
  } catch {
    return null;
  }
}

function createJwt(sa: { client_email: string; private_key: string }): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  ).toString("base64url");

  const unsigned = `${header}.${payload}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(unsigned);
  const signature = sign.sign(sa.private_key, "base64url");

  return `${unsigned}.${signature}`;
}

async function getGoogleAccessToken(): Promise<string | null> {
  if (cachedGoogleToken && Date.now() < cachedGoogleToken.expiresAt) {
    return cachedGoogleToken.token;
  }

  const sa = getServiceAccount();
  if (!sa) return null;

  const jwt = createJwt(sa);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    console.warn(`[Google Indexing] Token error ${res.status}: ${await res.text()}`);
    return null;
  }

  const data = await res.json();
  cachedGoogleToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedGoogleToken.token;
}

/**
 * @deprecated Google's Indexing API is officially JobPosting/BroadcastEvent ONLY.
 * Do NOT call this for entity/article/comparison pages — it's "misuse" Google
 * ignores and spam-checks (access can be revoked). Kept for a possible future
 * JobPosting/BroadcastEvent feed only. Requires GOOGLE_SERVICE_ACCOUNT_JSON.
 *
 * @param paths - Array of paths like ["/news/slug", "/teams/slug"]
 * @param type - "URL_UPDATED" (default) or "URL_DELETED"
 */
export async function submitUrlsToGoogle(
  paths: string[],
  type: "URL_UPDATED" | "URL_DELETED" = "URL_UPDATED"
): Promise<{ submitted: number; errors: string[] }> {
  const result = { submitted: 0, errors: [] as string[] };
  if (!paths.length) return result;

  const token = await getGoogleAccessToken();
  if (!token) {
    console.log("[Google Indexing] No service account configured, skipping");
    return result;
  }

  const urls = paths.map((p) =>
    p.startsWith("http") ? p : `${BASE_URL}${p.startsWith("/") ? "" : "/"}${p}`
  );

  // Use individual requests (batch API is more complex and quota is 200/day anyway)
  for (const url of urls) {
    try {
      const res = await fetch(GOOGLE_INDEXING_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, type }),
      });

      if (res.ok) {
        result.submitted++;
      } else {
        const body = await res.text();
        result.errors.push(`${url}: ${res.status} ${body}`);
      }
    } catch (err) {
      result.errors.push(`${url}: ${err}`);
    }
  }

  if (result.submitted > 0) {
    console.log(`[Google Indexing] Submitted ${result.submitted}/${urls.length} URLs`);
  }
  if (result.errors.length > 0) {
    console.warn(`[Google Indexing] ${result.errors.length} errors:`, result.errors.slice(0, 3));
  }

  return result;
}

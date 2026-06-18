/**
 * Bluesky (AT Protocol) posting via an app password.
 *
 * Bluesky is the only social channel where a labeled bot can post links
 * without ban risk (official API, bots welcome) AND it has the highest
 * outbound click-rate of any platform — the best referral bet for a small
 * site. Auth is a simple app password (no OAuth dance).
 *
 * SETUP: set BLUESKY_HANDLE (e.g. "datasports.bsky.social") and
 * BLUESKY_APP_PASSWORD (Settings → App Passwords — NOT your account password).
 * Returns null (no-op) when unset.
 */
const SERVICE = "https://bsky.social";

interface Facet {
  index: { byteStart: number; byteEnd: number };
  features: { $type: "app.bsky.richtext.facet#link"; uri: string }[];
}

/** A clickable-link facet for a URL that appears verbatim in `text`. */
function linkFacets(text: string, url: string): Facet[] | undefined {
  const idx = text.indexOf(url);
  if (idx === -1) return undefined;
  const enc = new TextEncoder();
  const byteStart = enc.encode(text.slice(0, idx)).length;
  const byteEnd = byteStart + enc.encode(url).length;
  return [{ index: { byteStart, byteEnd }, features: [{ $type: "app.bsky.richtext.facet#link", uri: url }] }];
}

export async function postToBluesky(text: string, linkUrl?: string): Promise<{ uri: string } | null> {
  const identifier = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_APP_PASSWORD;
  if (!identifier || !password) return null;

  // 1) Create a session (access token + DID).
  const sessRes = await fetch(`${SERVICE}/xrpc/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  if (!sessRes.ok) {
    console.warn(`[Bluesky] session ${sessRes.status}: ${await sessRes.text()}`);
    return null;
  }
  const { accessJwt, did } = await sessRes.json();

  // 2) Create the post record.
  const facets = linkUrl ? linkFacets(text, linkUrl) : undefined;
  const res = await fetch(`${SERVICE}/xrpc/com.atproto.repo.createRecord`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessJwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      repo: did,
      collection: "app.bsky.feed.post",
      record: {
        $type: "app.bsky.feed.post",
        text,
        createdAt: new Date().toISOString(),
        ...(facets ? { facets } : {}),
      },
    }),
  });
  if (!res.ok) {
    console.warn(`[Bluesky] createRecord ${res.status}: ${await res.text()}`);
    return null;
  }
  const data = await res.json();
  return { uri: data.uri };
}

export function blueskyConfigured(): boolean {
  return Boolean(process.env.BLUESKY_HANDLE && process.env.BLUESKY_APP_PASSWORD);
}

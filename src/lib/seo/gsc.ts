/**
 * Google Search Console (Search Analytics) read-only client.
 *
 * Reuses the same service account as the (now-deprecated) Indexing API
 * (GOOGLE_SERVICE_ACCOUNT_JSON) but with the read-only Search Console scope.
 *
 * SETUP REQUIRED (one-time): the service account email must be added as a user
 * on the datasports.co property in Search Console (Settings → Users and
 * permissions → Add user → the service account's client_email, "Restricted" is
 * enough). Until then the API returns 403 and this client reports notAuthorized.
 *
 * Property type: set GSC_SITE_URL. Domain property → "sc-domain:datasports.co"
 * (default). URL-prefix property → "https://datasports.co/".
 */
import crypto from "crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const SITE_URL = process.env.GSC_SITE_URL || "sc-domain:datasports.co";

let cachedToken: { token: string; expiresAt: number } | null = null;

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
    JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 })
  ).toString("base64url");
  const unsigned = `${header}.${payload}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(unsigned);
  return `${unsigned}.${sign.sign(sa.private_key, "base64url")}`;
}

async function getAccessToken(): Promise<string | null> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;
  const sa = getServiceAccount();
  if (!sa) return null;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: createJwt(sa),
    }),
  });
  if (!res.ok) {
    console.warn(`[GSC] token error ${res.status}: ${await res.text()}`);
    return null;
  }
  const data = await res.json();
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.token;
}

export interface GscRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscTotals {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export type GscStatus = "ok" | "no_credentials" | "not_authorized" | "api_disabled" | "error";

/** Low-level Search Analytics query. Returns null on any failure. */
export async function gscQuery(params: {
  startDate: string;
  endDate: string;
  dimensions?: string[];
  rowLimit?: number;
}): Promise<{ rows: GscRow[]; status: GscStatus }> {
  const token = await getAccessToken();
  if (!token) return { rows: [], status: "no_credentials" };

  try {
    const res = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: params.startDate,
          endDate: params.endDate,
          dimensions: params.dimensions ?? [],
          rowLimit: params.rowLimit ?? 25000,
        }),
      }
    );
    if (!res.ok) {
      const body = await res.text();
      if (/SERVICE_DISABLED|accessNotConfigured|has not been used/i.test(body)) {
        console.warn("[GSC] Search Console API is not enabled in the Cloud project");
        return { rows: [], status: "api_disabled" };
      }
      if (res.status === 403) {
        console.warn("[GSC] 403 — service account lacks access to the property");
        return { rows: [], status: "not_authorized" };
      }
      console.warn(`[GSC] query error ${res.status}: ${body}`);
      return { rows: [], status: "error" };
    }
    const data = await res.json();
    return { rows: (data.rows ?? []) as GscRow[], status: "ok" };
  } catch (err) {
    console.warn("[GSC] query failed:", err);
    return { rows: [], status: "error" };
  }
}

function sumTotals(rows: GscRow[]): GscTotals {
  const clicks = rows.reduce((s, r) => s + r.clicks, 0);
  const impressions = rows.reduce((s, r) => s + r.impressions, 0);
  // Weighted average position by impressions; CTR = clicks/impressions.
  const weightedPos = rows.reduce((s, r) => s + r.position * r.impressions, 0);
  return {
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : 0,
    position: impressions ? weightedPos / impressions : 0,
  };
}

function isoDaysAgo(n: number): string {
  const d = new Date(Date.now() - n * 86400000);
  return d.toISOString().slice(0, 10);
}

export interface WeekOverWeek {
  status: GscStatus;
  window: { current: [string, string]; prior: [string, string] };
  current: GscTotals;
  prior: GscTotals;
  topQueries: GscRow[];
  topPages: GscRow[];
  /** Queries that lost the most clicks vs prior week (movers worth a look). */
  decliningQueries: { query: string; current: number; prior: number; delta: number }[];
}

/**
 * Week-over-week snapshot. GSC data lags ~2-3 days, so the current window ends
 * 3 days ago. Stateless — compares two date ranges in one run (GSC stores the
 * history), so no local snapshot table is needed.
 */
export async function getWeekOverWeek(): Promise<WeekOverWeek> {
  const curEnd = isoDaysAgo(3);
  const curStart = isoDaysAgo(9);
  const priEnd = isoDaysAgo(10);
  const priStart = isoDaysAgo(16);

  const [cur, pri, curQ, topPages] = await Promise.all([
    gscQuery({ startDate: curStart, endDate: curEnd }),
    gscQuery({ startDate: priStart, endDate: priEnd }),
    gscQuery({ startDate: curStart, endDate: curEnd, dimensions: ["query"], rowLimit: 100 }),
    gscQuery({ startDate: curStart, endDate: curEnd, dimensions: ["page"], rowLimit: 25 }),
  ]);

  const status = cur.status;

  // Decliners: join current & prior query rows on the query key.
  let decliningQueries: WeekOverWeek["decliningQueries"] = [];
  if (status === "ok") {
    const priQ = await gscQuery({ startDate: priStart, endDate: priEnd, dimensions: ["query"], rowLimit: 100 });
    const priMap = new Map(priQ.rows.map((r) => [r.keys[0], r.clicks]));
    decliningQueries = curQ.rows
      .map((r) => ({ query: r.keys[0], current: r.clicks, prior: priMap.get(r.keys[0]) ?? 0 }))
      .map((x) => ({ ...x, delta: x.current - x.prior }))
      .filter((x) => x.delta < 0)
      .sort((a, b) => a.delta - b.delta)
      .slice(0, 10);
  }

  return {
    status,
    window: { current: [curStart, curEnd], prior: [priStart, priEnd] },
    current: sumTotals(cur.rows),
    prior: sumTotals(pri.rows),
    topQueries: curQ.rows.sort((a, b) => b.clicks - a.clicks).slice(0, 15),
    topPages: topPages.rows.sort((a, b) => b.clicks - a.clicks).slice(0, 15),
    decliningQueries,
  };
}

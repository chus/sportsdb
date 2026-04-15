/**
 * IndexNow integration — pings Bing/Yandex when pages are created or updated.
 * Google doesn't officially support IndexNow yet but discovering the key file
 * doesn't hurt. Bing indexes within minutes of a successful ping.
 *
 * Usage:
 *   await submitUrlsToIndexNow(["/news/some-article", "/players/messi"]);
 */

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
 * Ping Google's sitemap refresh endpoint.
 * Google rate-limits this, so call at most once per cron run.
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

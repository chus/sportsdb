/**
 * GEO (Generative Engine Optimization) citation tracking.
 *
 * Asks an AI answer engine a set of football questions and checks whether
 * datasports.co appears in the cited sources. AI engines are the most
 * asymmetric upside for a small niche site, and our stat tables / comparison
 * pages are ideal citation bait — so tracking "are we cited yet?" is the
 * leading indicator for that channel.
 *
 * Uses Perplexity's Sonar API (returns explicit citations) when
 * PERPLEXITY_API_KEY is set; degrades to skipped otherwise. (ChatGPT web
 * citations and Google AI Overviews have no clean citation API, so Perplexity
 * is the practical, scriptable proxy for "do AI engines cite us?".)
 */
const TARGET_HOST = "datasports.co";

export interface CitationResult {
  query: string;
  cited: boolean;
  /** URLs from our domain that were cited, if any. */
  ourUrls: string[];
  /** All cited domains, for context on who's winning the answer. */
  citedDomains: string[];
}

export type GeoStatus = "ok" | "no_credentials" | "error";

/** Default questions a football fan would ask an AI — tuned to our formats. */
export function defaultGeoQueries(): string[] {
  return [
    "Compare Erling Haaland and Kylian Mbappé career stats",
    "Who has more goals this season, Mohamed Salah or Harry Kane?",
    "Premier League top scorers 2025/26",
    "Lamine Yamal stats and profile",
    "Real Madrid vs Barcelona head to head record",
    "Best players in La Liga this season by goals and assists",
  ];
}

async function queryPerplexity(apiKey: string, q: string): Promise<{ urls: string[] } | null> {
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        messages: [{ role: "user", content: q }],
      }),
    });
    if (!res.ok) {
      console.warn(`[GEO] Perplexity ${res.status}: ${await res.text()}`);
      return null;
    }
    const data = await res.json();
    // Sonar returns citations as `citations` (string[]) and/or `search_results` ({url}[]).
    const fromCitations: string[] = Array.isArray(data.citations) ? data.citations : [];
    const fromResults: string[] = Array.isArray(data.search_results)
      ? data.search_results.map((r: { url?: string }) => r.url).filter(Boolean)
      : [];
    return { urls: [...fromCitations, ...fromResults] };
  } catch (err) {
    console.warn("[GEO] Perplexity call failed:", err);
    return null;
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export async function checkCitations(
  queries: string[] = defaultGeoQueries()
): Promise<{ status: GeoStatus; results: CitationResult[]; citedCount: number }> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return { status: "no_credentials", results: [], citedCount: 0 };

  const results: CitationResult[] = [];
  for (const q of queries) {
    const resp = await queryPerplexity(apiKey, q);
    if (!resp) {
      results.push({ query: q, cited: false, ourUrls: [], citedDomains: [] });
      continue;
    }
    const ourUrls = resp.urls.filter((u) => hostOf(u).endsWith(TARGET_HOST));
    const citedDomains = [...new Set(resp.urls.map(hostOf).filter(Boolean))];
    results.push({ query: q, cited: ourUrls.length > 0, ourUrls, citedDomains });
  }

  return { status: "ok", results, citedCount: results.filter((r) => r.cited).length };
}

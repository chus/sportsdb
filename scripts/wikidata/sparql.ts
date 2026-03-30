/**
 * Shared SPARQL query helper for Wikidata endpoint
 *
 * Features:
 * - Rate limiting (~55 req/min)
 * - Retry with exponential backoff on 429/5xx
 * - Required User-Agent header
 */

const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";
const RATE_LIMIT_MS = 1100; // ~55 req/min (under 60 limit)
const MAX_RETRIES = 3;
const USER_AGENT = "SportsDB/1.0 (https://datasports.co; data-enrichment)";

let lastRequestTime = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

export interface SparqlBinding {
  [key: string]: { type: string; value: string } | undefined;
}

export interface SparqlResults {
  results: {
    bindings: SparqlBinding[];
  };
}

export async function sparqlQuery(query: string): Promise<SparqlBinding[]> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    await rateLimit();

    try {
      const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;
      const res = await fetch(url, {
        headers: {
          Accept: "application/sparql-results+json",
          "User-Agent": USER_AGENT,
        },
      });

      if (res.status === 429 || res.status >= 500) {
        const wait = Math.pow(2, attempt + 1) * 1000;
        console.warn(`  SPARQL ${res.status}, retrying in ${wait}ms...`);
        await new Promise((r) => setTimeout(r, wait));
        lastError = new Error(`SPARQL HTTP ${res.status}`);
        continue;
      }

      if (!res.ok) {
        throw new Error(`SPARQL HTTP ${res.status}: ${await res.text()}`);
      }

      const data: SparqlResults = await res.json();
      return data.results.bindings;
    } catch (err) {
      lastError = err as Error;
      if (attempt < MAX_RETRIES - 1) {
        const wait = Math.pow(2, attempt + 1) * 1000;
        console.warn(`  SPARQL error: ${(err as Error).message}, retrying in ${wait}ms...`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }

  throw lastError || new Error("SPARQL query failed after retries");
}

/** Extract a simple string value from a SPARQL binding */
export function val(binding: SparqlBinding, key: string): string | null {
  return binding[key]?.value ?? null;
}

/** Extract Q-ID from a Wikidata entity URI */
export function qid(uri: string): string {
  return uri.replace("http://www.wikidata.org/entity/", "");
}

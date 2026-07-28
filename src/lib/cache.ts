import { unstable_cache } from "next/cache";

// unstable_cache stores results as JSON, so Date fields come back as ISO
// strings on cache hits — which breaks date-fns formatting downstream.
// This wrapper revives full ISO timestamp strings back into Dates.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function reviveDates(value: unknown): unknown {
  if (typeof value === "string" && ISO_DATE_RE.test(value)) return new Date(value);
  if (Array.isArray(value)) return value.map(reviveDates);
  if (value && typeof value === "object" && value.constructor === Object) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = reviveDates(v);
    return out;
  }
  return value;
}

/**
 * Wrap a query function in Vercel's data cache so request-time dynamic pages
 * (cookies()/searchParams readers) stop hitting the DB per anonymous request.
 * The cache key includes the serialized arguments, so each distinct call
 * signature is cached separately.
 */
export function cachedQuery<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  keyParts: string[],
  revalidate: number
): (...args: A) => Promise<R> {
  const cached = unstable_cache(async (...args: A) => fn(...args), keyParts, {
    revalidate,
  });
  return async (...args: A): Promise<R> => reviveDates(await cached(...args)) as R;
}

"use client";

import Link from "next/link";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-20">
      <div className="mx-auto max-w-2xl rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-600">
          Something broke
        </p>
        <h1 className="mt-3 text-3xl font-bold text-neutral-900">
          We couldn&apos;t load this page right now.
        </h1>
        <p className="mt-4 text-neutral-600">
          Try again or head back to the homepage. If the problem persists, the route may be missing data or an upstream request may have failed.
        </p>
        {error.digest && (
          <p className="mt-4 text-xs text-neutral-400">Reference: {error.digest}</p>
        )}
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="rounded-full border border-neutral-300 px-5 py-3 text-sm font-semibold text-neutral-800 transition-colors hover:border-blue-300 hover:text-blue-600"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}

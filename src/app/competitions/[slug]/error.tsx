"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";

export default function CompetitionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-20">
      <div className="mx-auto max-w-2xl rounded-xl border border-neutral-200 bg-white p-8 text-center">
        <Trophy className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">
          Competition data unavailable
        </h1>
        <p className="text-neutral-600 mb-6">
          We couldn&apos;t load this competition right now. The data may still be syncing.
        </p>
        {error.digest && (
          <p className="text-xs text-neutral-400 mb-4">Reference: {error.digest}</p>
        )}
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
          <Link
            href="/search?type=competition"
            className="rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-800 hover:border-blue-300 hover:text-blue-600 transition-colors"
          >
            All Competitions
          </Link>
        </div>
      </div>
    </div>
  );
}

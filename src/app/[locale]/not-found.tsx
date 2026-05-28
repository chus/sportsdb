import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page Not Found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-20">
      <div className="mx-auto max-w-2xl rounded-xl border border-neutral-200 bg-white p-8 text-center">
        <p className="text-6xl font-black text-neutral-200 mb-4">404</p>
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">
          Page not found
        </h1>
        <p className="text-neutral-600 mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex justify-center gap-3">
          <Link
            href="/"
            className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Go Home
          </Link>
          <Link
            href="/competitions"
            className="rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-800 hover:border-blue-300 hover:text-blue-600 transition-colors"
          >
            Competitions
          </Link>
        </div>
      </div>
    </div>
  );
}

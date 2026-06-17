import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page Not Found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface-2 px-4 py-20">
      <div className="mx-auto max-w-2xl rounded-xl border border-line bg-surface p-8 text-center">
        <p className="text-6xl font-black text-neutral-200 mb-4">404</p>
        <h1 className="text-2xl font-bold text-ink mb-2">
          Page not found
        </h1>
        <p className="text-muted mb-6">
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
            className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink hover:border-blue-300 hover:text-blue-600 transition-colors"
          >
            Competitions
          </Link>
        </div>
      </div>
    </div>
  );
}

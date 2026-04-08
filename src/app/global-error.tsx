"use client";

/**
 * Last-resort error boundary for failures in the root layout itself.
 * Next.js only renders this when a `src/app/error.tsx` is not available
 * (i.e. when the error happens inside the root layout or its children).
 *
 * Must render its own <html> and <body> because it replaces the layout.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", fontFamily: "system-ui, sans-serif", background: "#fafafa", color: "#171717" }}>
          <div style={{ maxWidth: "32rem", textAlign: "center" }}>
            <p style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: "#dc2626" }}>
              Something broke
            </p>
            <h1 style={{ marginTop: "0.75rem", fontSize: "1.875rem", fontWeight: 700 }}>
              We couldn&apos;t load this page.
            </h1>
            <p style={{ marginTop: "1rem", color: "#525252" }}>
              An unexpected error occurred. Please try again or head back to the homepage.
            </p>
            {error.digest && (
              <p style={{ marginTop: "1rem", fontSize: "0.75rem", color: "#a3a3a3" }}>
                Reference: {error.digest}
              </p>
            )}
            <div style={{ marginTop: "2rem", display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={reset}
                style={{ borderRadius: "9999px", background: "#2563eb", color: "white", padding: "0.75rem 1.25rem", fontSize: "0.875rem", fontWeight: 600, border: "none", cursor: "pointer" }}
              >
                Try Again
              </button>
              <a
                href="/"
                style={{ borderRadius: "9999px", border: "1px solid #d4d4d4", padding: "0.75rem 1.25rem", fontSize: "0.875rem", fontWeight: 600, color: "#262626", textDecoration: "none" }}
              >
                Go Home
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}

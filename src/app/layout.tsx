import type { Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#171717",
};

// Root layout intentionally minimal. Locale-aware layout, providers, navbar,
// and footer live in app/[locale]/layout.tsx. Next.js requires <html>/<body>
// in the root layout; the `lang` attribute is overridden per locale by the
// nested layout's setRequestLocale call.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://pagead2.googlesyndication.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.google-analytics.com" />
        <link rel="dns-prefetch" href="https://media.api-sports.io" />
        <link rel="dns-prefetch" href="https://crests.football-data.org" />
        <link rel="dns-prefetch" href="https://flagcdn.com" />
        <link rel="alternate" type="application/rss+xml" title="DataSports RSS Feed" href="/feed.xml" />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}

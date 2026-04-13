import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AdSenseScript } from "@/components/ads/adsense-script";
import { GoogleAnalytics } from "@/components/analytics/ga-script";
import { WebsiteJsonLd, OrganizationJsonLd } from "@/components/seo/json-ld";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ScoreStrip } from "@/components/live/score-strip";
import { AuthProvider } from "@/components/auth/auth-provider";
import { AuthModalProvider } from "@/components/auth/auth-modal";
import { SubscriptionProvider } from "@/components/subscription/subscription-provider";
import { OnboardingProvider } from "@/components/onboarding/onboarding-provider";
import { UpgradeModalProvider } from "@/components/subscription/upgrade-modal";
import { CookieConsentProvider } from "@/components/cookie-consent/cookie-consent-provider";
import { CookieConsentBanner } from "@/components/cookie-consent/cookie-consent-banner";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#171717",
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "DataSports – The International Sports Database",
    template: "%s | DataSports",
  },
  description:
    "The comprehensive, structured database for football. Search players, teams, competitions, and matches with time-aware data.",
  openGraph: {
    type: "website",
    siteName: "DataSports",
    title: "DataSports – The International Sports Database",
    description:
      "The comprehensive, structured database for football. Search players, teams, competitions, and matches with time-aware data.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: "@datasports_co",
    creator: "@datasports_co",
    title: "DataSports – The International Sports Database",
    description:
      "The comprehensive, structured database for football. Search players, teams, and competitions.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: { url: "/favicon.svg", type: "image/svg+xml" },
  },
  alternates: {
    canonical: BASE_URL,
    languages: {
      en: BASE_URL,
    },
    types: {
      "application/rss+xml": [
        { url: "/feed.xml", title: "DataSports – All News" },
        { url: "/feed/premier-league.xml", title: "Premier League News" },
        { url: "/feed/la-liga.xml", title: "La Liga News" },
        { url: "/feed/bundesliga.xml", title: "Bundesliga News" },
        { url: "/feed/serie-a.xml", title: "Serie A News" },
        { url: "/feed/ligue-1.xml", title: "Ligue 1 News" },
        { url: "/feed/liga-profesional-argentina.xml", title: "Liga Argentina News" },
        { url: "/feed/mls.xml", title: "MLS News" },
        { url: "/feed/liga-mx.xml", title: "Liga MX News" },
      ],
    },
  },
  verification: {
    google: "hUS5tZ-8jRrr64sNU_Ybeizth2ZH-4uo_6qVQJ7vz4w",
  },
  other: {
    "google-adsense-account": "ca-pub-7616433745494289",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://pagead2.googlesyndication.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.google-analytics.com" />
        <link rel="dns-prefetch" href="https://media.api-sports.io" />
        <link rel="dns-prefetch" href="https://crests.football-data.org" />
        <link rel="dns-prefetch" href="https://flagcdn.com" />
        <link rel="alternate" type="application/rss+xml" title="DataSports RSS Feed" href="/feed.xml" />
      </head>
      <body className="font-sans antialiased">
        <NextIntlClientProvider messages={messages}>
          <CookieConsentProvider>
            <AuthProvider>
              <SubscriptionProvider>
                <AuthModalProvider>
                  <UpgradeModalProvider>
                  <OnboardingProvider>
                    <WebsiteJsonLd
                      url={BASE_URL}
                      name="DataSports"
                      description="The comprehensive, structured database for football. Search players, teams, competitions, and matches with time-aware data."
                      searchUrl={`${BASE_URL}/search?q={search_term_string}`}
                    />
                    <OrganizationJsonLd
                      name="DataSports"
                      url={BASE_URL}
                      logo={`${BASE_URL}/favicon.svg`}
                      description="The comprehensive, structured database for football. Search players, teams, competitions, and matches with time-aware data."
                    />
                    <GoogleAnalytics />
                    <AdSenseScript />
                    <Navbar />
                    <ScoreStrip />
                    <main className="min-h-screen">{children}</main>
                    <Footer />
                    <CookieConsentBanner />
                    <SpeedInsights />
                  </OnboardingProvider>
                  </UpgradeModalProvider>
                </AuthModalProvider>
              </SubscriptionProvider>
            </AuthProvider>
          </CookieConsentProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AdSenseScript } from "@/components/ads/adsense-script";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { AuthProvider } from "@/components/auth/auth-provider";
import { SubscriptionProvider } from "@/components/subscription/subscription-provider";
import { OnboardingProvider } from "@/components/onboarding/onboarding-provider";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://sportsdb-nine.vercel.app";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2563eb",
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "SportsDB – The International Sports Database",
    template: "%s | SportsDB",
  },
  description:
    "The comprehensive, structured database for football. Search players, teams, competitions, and matches with time-aware data.",
  openGraph: {
    type: "website",
    siteName: "SportsDB",
    title: "SportsDB – The International Sports Database",
    description:
      "The comprehensive, structured database for football. Search players, teams, competitions, and matches with time-aware data.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "SportsDB – The International Sports Database",
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
    icon: "/favicon.ico",
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
      <body className="font-sans antialiased">
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            <SubscriptionProvider>
              <OnboardingProvider>
                <Navbar />
                <main className="min-h-screen">{children}</main>
                <Footer />
                <SpeedInsights />
                <AdSenseScript />
              </OnboardingProvider>
            </SubscriptionProvider>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

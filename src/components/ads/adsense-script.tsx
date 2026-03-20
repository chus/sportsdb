"use client";

import Script from "next/script";
import { useCookieConsent } from "@/components/cookie-consent/cookie-consent-provider";

const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

export function AdSenseScript() {
  const { consent } = useCookieConsent();

  if (!ADSENSE_CLIENT_ID || consent !== "accepted") return null;

  return (
    <Script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}

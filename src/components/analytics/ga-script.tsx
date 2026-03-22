"use client";

import { useEffect } from "react";
import Script from "next/script";
import { useCookieConsent } from "@/components/cookie-consent/cookie-consent-provider";

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export function GoogleAnalytics() {
  const { consent } = useCookieConsent();

  // Update consent mode whenever user preferences change
  useEffect(() => {
    if (!GA_ID || typeof window === "undefined") return;
    const w = window as typeof window & { gtag?: (...args: unknown[]) => void };
    if (!w.gtag) return;

    const granted = consent?.analytics ? "granted" : "denied";
    w.gtag("consent", "update", {
      analytics_storage: granted,
      ad_storage: consent?.ads ? "granted" : "denied",
      ad_user_data: consent?.ads ? "granted" : "denied",
      ad_personalization: consent?.ads ? "granted" : "denied",
    });
  }, [consent]);

  if (!GA_ID) return null;

  return (
    <>
      <Script id="ga4-consent-default" strategy="beforeInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('consent', 'default', {
            analytics_storage: 'denied',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            wait_for_update: 500
          });
        `}
      </Script>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-config" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  );
}

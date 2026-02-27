"use client";

import { useEffect, useRef } from "react";
import { useSubscription } from "@/components/subscription/subscription-provider";

declare global {
  interface Window {
    adsbygoogle: Record<string, unknown>[];
  }
}

interface AdUnitProps {
  slot: string;
  format?: string;
  responsive?: boolean;
  layout?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function AdUnit({
  slot,
  format = "auto",
  responsive = true,
  layout,
  className,
  style,
}: AdUnitProps) {
  const { canAccess, isLoading } = useSubscription();
  const adRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  const isAdFree = canAccess("adFree");
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

  useEffect(() => {
    if (pushed.current || !adRef.current || !clientId || isAdFree || isLoading) {
      return;
    }

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // AdSense not loaded yet — safe to ignore
    }
  }, [clientId, isAdFree, isLoading]);

  if (isLoading || isAdFree || !clientId) return null;

  return (
    <ins
      ref={adRef}
      className={`adsbygoogle ${className ?? ""}`}
      style={{ display: "block", ...style }}
      data-ad-client={clientId}
      data-ad-slot={slot}
      data-ad-format={format}
      {...(responsive && { "data-full-width-responsive": "true" })}
      {...(layout && { "data-ad-layout": layout })}
    />
  );
}

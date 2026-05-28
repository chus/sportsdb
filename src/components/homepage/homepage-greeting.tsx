"use client";

import { useAuth } from "@/components/auth/auth-provider";

/**
 * Client island that personalizes the homepage H1 for logged-in users.
 *
 * The server renders the public version of the page (so the response is
 * ISR-cacheable for Google), and this component hydrates on the client
 * with the user context already populated by AuthProvider. While auth is
 * loading, we show the public fallback to avoid a layout shift.
 */
export function HomepageGreeting({ fallback }: { fallback: string }) {
  const { user, isLoading } = useAuth();

  if (isLoading || !user) {
    return <>{fallback}</>;
  }

  const name = user.name?.trim() || user.email?.split("@")[0];
  return <>Welcome back, {name}</>;
}

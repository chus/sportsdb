"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { usePostHog } from "posthog-js/react";

export function PostHogIdentify() {
  const { user } = useAuth();
  const posthog = usePostHog();

  useEffect(() => {
    if (!posthog) return;

    if (user) {
      posthog.identify(user.id, {
        email: user.email,
        name: user.name,
      });
    } else {
      posthog.reset();
    }
  }, [user, posthog]);

  return null;
}

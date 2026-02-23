"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { OnboardingWizard } from "./onboarding-wizard";

interface OnboardingContextType {
  isOnboardingComplete: boolean;
  showOnboarding: () => void;
}

const OnboardingContext = createContext<OnboardingContextType>({
  isOnboardingComplete: true,
  showOnboarding: () => {},
});

export function useOnboarding() {
  return useContext(OnboardingContext);
}

interface OnboardingProviderProps {
  children: ReactNode;
}

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const { user, isLoading } = useAuth();
  const [showWizard, setShowWizard] = useState(false);
  const [isComplete, setIsComplete] = useState(true);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    if (!isLoading && user && !hasChecked) {
      checkOnboardingStatus();
    }
  }, [user, isLoading, hasChecked]);

  const checkOnboardingStatus = async () => {
    try {
      const res = await fetch("/api/user/me");
      if (res.ok) {
        const data = await res.json();
        const complete = data.onboardingCompleted ?? true;
        setIsComplete(complete);
        if (!complete) {
          setShowWizard(true);
        }
      }
    } catch (error) {
      console.error("Failed to check onboarding status:", error);
    } finally {
      setHasChecked(true);
    }
  };

  const handleComplete = () => {
    setShowWizard(false);
    setIsComplete(true);
  };

  const handleSkip = async () => {
    setShowWizard(false);
    setIsComplete(true);
    // Also mark as complete on skip
    try {
      await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ players: [], teams: [], competitions: [] }),
      });
    } catch {
      // Ignore errors on skip
    }
  };

  return (
    <OnboardingContext.Provider
      value={{
        isOnboardingComplete: isComplete,
        showOnboarding: () => setShowWizard(true),
      }}
    >
      {children}
      {showWizard && (
        <OnboardingWizard onComplete={handleComplete} onSkip={handleSkip} />
      )}
    </OnboardingContext.Provider>
  );
}

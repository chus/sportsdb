"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";

export interface CookieConsentPreferences {
  essential: true;
  analytics: boolean;
  ads: boolean;
}

interface CookieConsentContextType {
  consent: CookieConsentPreferences | null;
  acceptAll: () => void;
  rejectNonEssential: () => void;
  savePreferences: (prefs: CookieConsentPreferences) => void;
  showSettings: boolean;
  openSettings: () => void;
  closeSettings: () => void;
}

const CookieConsentContext = createContext<CookieConsentContextType | undefined>(
  undefined
);

const COOKIE_NAME = "cookie_consent";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)")
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function parseConsent(raw: string | null): CookieConsentPreferences | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.essential === true &&
      typeof parsed.analytics === "boolean" &&
      typeof parsed.ads === "boolean"
    ) {
      return parsed as CookieConsentPreferences;
    }
  } catch {
    // Invalid cookie value
  }
  return null;
}

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<CookieConsentPreferences | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const stored = parseConsent(getCookie(COOKIE_NAME));
    if (stored) {
      setConsent(stored);
    }
    setMounted(true);
  }, []);

  const persistConsent = useCallback((prefs: CookieConsentPreferences) => {
    setCookie(COOKIE_NAME, JSON.stringify(prefs), COOKIE_MAX_AGE);
    setConsent(prefs);
    setShowSettings(false);
  }, []);

  const acceptAll = useCallback(() => {
    persistConsent({ essential: true, analytics: true, ads: true });
  }, [persistConsent]);

  const rejectNonEssential = useCallback(() => {
    persistConsent({ essential: true, analytics: false, ads: false });
  }, [persistConsent]);

  const savePreferences = useCallback(
    (prefs: CookieConsentPreferences) => {
      persistConsent(prefs);
    },
    [persistConsent]
  );

  const openSettings = useCallback(() => {
    setShowSettings(true);
  }, []);

  const closeSettings = useCallback(() => {
    setShowSettings(false);
  }, []);

  const resolvedConsent = mounted ? consent : null;

  return (
    <CookieConsentContext.Provider
      value={{
        consent: resolvedConsent,
        acceptAll,
        rejectNonEssential,
        savePreferences,
        showSettings,
        openSettings,
        closeSettings,
      }}
    >
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const context = useContext(CookieConsentContext);
  if (context === undefined) {
    throw new Error(
      "useCookieConsent must be used within a CookieConsentProvider"
    );
  }
  return context;
}

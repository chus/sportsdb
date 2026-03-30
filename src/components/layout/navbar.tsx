"use client";

import { Search, Menu, X, LogOut, User, CreditCard, ChevronDown, LayoutDashboard, Zap } from "lucide-react";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { Logo } from "@/components/layout/logo";
import { SearchBar } from "@/components/search/search-bar";
import { useAuth } from "@/components/auth/auth-provider";
import { useAuthModal } from "@/components/auth/auth-modal";
import { useSubscription } from "@/components/subscription/subscription-provider";

export function Navbar() {
  const t = useTranslations();
  const pathname = usePathname();
  const { user, isLoading: authLoading } = useAuth();
  const { openModal } = useAuthModal();
  const { tier, isLoading: subLoading } = useSubscription();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [userMenuOpen]);

  const navLinks = [
    { label: t("common.players"), href: "/players", path: "/players" },
    { label: t("common.teams"), href: "/teams", path: "/teams" },
    { label: t("common.competitions"), href: "/competitions", path: "/competitions" },
    { label: t("common.matches"), href: "/matches", path: "/matches" },
    { label: t("common.news"), href: "/news", path: "/news" },
    { label: "Games", href: "/games", path: "/games" },
  ];

  const userInitial = user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "?";

  return (
    <nav className="sticky top-0 z-50 bg-neutral-900 border-b border-neutral-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Logo size="md" showText variant="dark" />

          {/* Desktop Nav Links */}
          <div className="hidden lg:flex items-center gap-0.5">
            {navLinks.map((link) => {
              const isActive = pathname === link.path || pathname.startsWith(link.path + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 ${
                    isActive
                      ? "border-blue-500 text-white"
                      : "border-transparent text-neutral-400 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Desktop Inline Search */}
          <div className="hidden md:block flex-1 max-w-sm mx-4">
            <SearchBar size="default" placeholder="Search players, teams..." variant="dark" />
          </div>

          {/* Upgrade pill for free users */}
          {!authLoading && !subLoading && user && tier === "free" && (
            <Link
              href="/pricing"
              className="hidden md:inline-flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-semibold rounded-full hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              <Zap className="w-3.5 h-3.5" />
              Go Pro
            </Link>
          )}

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Mobile search icon */}
            <Link
              href="/search"
              className="md:hidden p-2 text-neutral-400 hover:text-white rounded-lg transition-colors"
              aria-label={t("common.search")}
            >
              <Search className="w-5 h-5" />
            </Link>

            {/* Auth buttons / User menu */}
            {!authLoading && (
              <>
                {user ? (
                  /* Logged in — user menu */
                  <div className="hidden lg:block relative" ref={userMenuRef}>
                    <button
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      aria-label="Open user menu"
                      aria-haspopup="menu"
                      aria-expanded={userMenuOpen}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">
                        {userInitial}
                      </div>
                      <ChevronDown className="w-4 h-4 text-neutral-500" />
                    </button>

                    {userMenuOpen && (
                      <UserDropdown
                        userName={user.name || user.email}
                        onClose={() => setUserMenuOpen(false)}
                      />
                    )}
                  </div>
                ) : (
                  /* Logged out — auth buttons */
                  <div className="hidden lg:flex items-center gap-2">
                    <button
                      onClick={() => openModal("signin")}
                      className="px-4 py-2 text-sm font-medium text-neutral-400 hover:text-white transition-colors"
                    >
                      Sign In
                    </button>
                    <button
                      onClick={() => openModal("signup")}
                      className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    >
                      Sign Up
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close mobile menu" : "Open mobile menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
              className="lg:hidden p-2 text-neutral-400 hover:text-white rounded-lg"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div id="mobile-navigation" className="lg:hidden mt-3 pt-3 border-t border-neutral-800">
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.path || pathname.startsWith(link.path + "/");
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? "text-white bg-neutral-800"
                        : "text-neutral-400 hover:text-white hover:bg-neutral-800"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}

              {/* Mobile auth items */}
              {!authLoading && (
                <div className="mt-3 pt-3 border-t border-neutral-800">
                  {user ? (
                    <>
                      <div className="px-4 py-2 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">
                          {userInitial}
                        </div>
                        <span className="text-sm font-medium text-white truncate">
                          {user.name || user.email}
                        </span>
                      </div>
                      <MobileAuthLinks onClose={() => setMobileMenuOpen(false)} />
                      {user && tier === "free" && (
                        <Link
                          href="/pricing"
                          onClick={() => setMobileMenuOpen(false)}
                          className="mx-4 mt-2 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-lg"
                        >
                          <Zap className="w-4 h-4" />
                          Go Pro
                        </Link>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col gap-2 px-4">
                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          openModal("signin");
                        }}
                        className="w-full px-4 py-2.5 text-sm font-medium text-neutral-300 border border-neutral-700 rounded-lg hover:bg-neutral-800 transition-colors"
                      >
                        Sign In
                      </button>
                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          openModal("signup");
                        }}
                        className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                      >
                        Sign Up
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

function UserDropdown({
  userName,
  onClose,
}: {
  userName: string;
  onClose: () => void;
}) {
  const { logout } = useAuth();
  const router = useRouter();

  return (
    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-neutral-200 shadow-xl py-1 z-50">
      <div className="px-4 py-3 border-b border-neutral-100">
        <p className="text-sm font-medium text-neutral-900 truncate">{userName}</p>
      </div>
      <Link
        href="/dashboard"
        onClick={onClose}
        className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
      >
        <LayoutDashboard className="w-4 h-4 text-neutral-400" />
        Dashboard
      </Link>
      <Link
        href="/account"
        onClick={onClose}
        className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
      >
        <User className="w-4 h-4 text-neutral-400" />
        Account
      </Link>
      <Link
        href="/pricing"
        onClick={onClose}
        className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
      >
        <CreditCard className="w-4 h-4 text-neutral-400" />
        Pricing
      </Link>
      <button
        onClick={async () => {
          onClose();
          await logout();
          router.refresh();
        }}
        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </button>
    </div>
  );
}

function MobileAuthLinks({ onClose }: { onClose: () => void }) {
  const { logout } = useAuth();
  const router = useRouter();

  return (
    <>
      <Link
        href="/dashboard"
        onClick={onClose}
        className="flex items-center gap-3 px-4 py-3 text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
      >
        <LayoutDashboard className="w-4 h-4 text-neutral-500" />
        Dashboard
      </Link>
      <Link
        href="/account"
        onClick={onClose}
        className="flex items-center gap-3 px-4 py-3 text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
      >
        <User className="w-4 h-4 text-neutral-500" />
        Account
      </Link>
      <Link
        href="/pricing"
        onClick={onClose}
        className="flex items-center gap-3 px-4 py-3 text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
      >
        <CreditCard className="w-4 h-4 text-neutral-500" />
        Pricing
      </Link>
      <button
        onClick={async () => {
          onClose();
          await logout();
          router.refresh();
        }}
        className="flex items-center gap-3 w-full px-4 py-3 text-sm text-red-500 hover:bg-red-950/20 rounded-lg transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </button>
    </>
  );
}

"use client";

import { Search, Menu, X, LogOut, User, CreditCard, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { Logo } from "@/components/layout/logo";
import { SearchBar } from "@/components/search/search-bar";
import { useAuth } from "@/components/auth/auth-provider";
import { useAuthModal } from "@/components/auth/auth-modal";

export function Navbar() {
  const t = useTranslations();
  const pathname = usePathname();
  const { user, isLoading: authLoading } = useAuth();
  const { openModal } = useAuthModal();
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
    { label: t("common.players"), href: "/search?type=player" },
    { label: t("common.teams"), href: "/search?type=team" },
    { label: t("common.competitions"), href: "/search?type=competition" },
    { label: t("common.matches"), href: "/search?type=match" },
    { label: t("common.news"), href: "/news" },
  ];

  const userInitial = user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "?";

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-neutral-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Logo size="md" showText />

          {/* Desktop Nav Links */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || pathname?.startsWith(link.href + "&");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? "text-blue-600 bg-blue-50"
                      : "text-neutral-700 hover:text-blue-600 hover:bg-blue-50"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Desktop Inline Search */}
          <div className="hidden md:block flex-1 max-w-md mx-4">
            <SearchBar size="default" placeholder="Search players, teams..." />
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Mobile search icon */}
            <Link
              href="/search"
              className="md:hidden p-2 text-neutral-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
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
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
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
                      className="px-4 py-2 text-sm font-medium text-neutral-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
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
              className="lg:hidden p-2 text-neutral-600 hover:text-neutral-900 rounded-lg"
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
          <div className="lg:hidden mt-4 pt-4 border-t border-neutral-200">
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href || pathname?.startsWith(link.href + "&");
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? "text-blue-600 bg-blue-50"
                        : "text-neutral-700 hover:text-blue-600 hover:bg-blue-50"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}

              {/* Mobile auth items */}
              {!authLoading && (
                <div className="mt-3 pt-3 border-t border-neutral-200">
                  {user ? (
                    <>
                      <div className="px-4 py-2 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">
                          {userInitial}
                        </div>
                        <span className="text-sm font-medium text-neutral-900 truncate">
                          {user.name || user.email}
                        </span>
                      </div>
                      <MobileAuthLinks onClose={() => setMobileMenuOpen(false)} />
                    </>
                  ) : (
                    <div className="flex flex-col gap-2 px-4">
                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          openModal("signin");
                        }}
                        className="w-full px-4 py-2.5 text-sm font-medium text-neutral-700 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
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
        href="/account"
        onClick={onClose}
        className="flex items-center gap-3 px-4 py-3 text-sm text-neutral-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
      >
        <User className="w-4 h-4 text-neutral-400" />
        Account
      </Link>
      <Link
        href="/pricing"
        onClick={onClose}
        className="flex items-center gap-3 px-4 py-3 text-sm text-neutral-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
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
        className="flex items-center gap-3 w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </button>
    </>
  );
}

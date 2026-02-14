"use client";

import { Trophy, Search, Menu, X, User, LogOut } from "lucide-react";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/auth-provider";
import { LanguageToggle } from "@/components/language-toggle";

export function Navbar() {
  const t = useTranslations();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, isLoading, logout } = useAuth();
  const userMenuRef = useRef<HTMLDivElement>(null);

  const navLinks = [
    { label: t("common.players"), href: "/search?type=player" },
    { label: t("common.teams"), href: "/search?type=team" },
    { label: t("common.competitions"), href: "/search?type=competition" },
    { label: t("common.matches"), href: "/search?type=match" },
  ];

  // Close user menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    setUserMenuOpen(false);
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-neutral-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div className="hidden sm:block">
              <div className="font-bold text-xl bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                SportsDB
              </div>
              <div className="text-xs text-neutral-500 -mt-0.5">
                {t("home.heroTagline")}
              </div>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-4 py-2 text-sm font-medium text-neutral-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Language Toggle */}
            <LanguageToggle />

            <Link
              href="/search"
              className="p-2 text-neutral-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              aria-label={t("common.search")}
            >
              <Search className="w-5 h-5" />
            </Link>

            {/* Auth buttons */}
            {!isLoading && (
              <>
                {user ? (
                  <div className="relative" ref={userMenuRef}>
                    <button
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      className="flex items-center gap-2 p-2 text-neutral-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="hidden sm:block text-sm font-medium">
                        {user.name || user.email.split("@")[0]}
                      </span>
                    </button>

                    {userMenuOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-neutral-200 shadow-lg overflow-hidden">
                        <div className="px-4 py-3 border-b border-neutral-100">
                          <p className="text-sm font-medium text-neutral-900 truncate">
                            {user.name || "User"}
                          </p>
                          <p className="text-xs text-neutral-500 truncate">{user.email}</p>
                        </div>
                        <Link
                          href="/feed"
                          className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          {t("feed.activityFeed")}
                        </Link>
                        <button
                          onClick={handleLogout}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          <LogOut className="w-4 h-4" />
                          {t("common.signOut")}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="hidden sm:flex items-center gap-2">
                    <Link
                      href="/login"
                      className="px-4 py-2 text-sm font-medium text-neutral-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      {t("common.signIn")}
                    </Link>
                    <Link
                      href="/signup"
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    >
                      {t("common.signUp")}
                    </Link>
                  </div>
                )}
              </>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-neutral-600 hover:text-neutral-900 rounded-lg"
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
          <div className="md:hidden mt-4 pt-4 border-t border-neutral-200">
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-4 py-3 text-sm font-medium text-neutral-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  {link.label}
                </Link>
              ))}

              {/* Mobile auth buttons */}
              {!isLoading && !user && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-neutral-200">
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 px-4 py-2 text-sm font-medium text-center text-neutral-700 border border-neutral-300 rounded-lg hover:bg-neutral-50"
                  >
                    {t("common.signIn")}
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 px-4 py-2 text-sm font-medium text-center text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                  >
                    {t("common.signUp")}
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

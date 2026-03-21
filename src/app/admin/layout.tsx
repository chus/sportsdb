"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileText,
  Database,
  Puzzle,
  CreditCard,
  Gift,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const navItems = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Content", href: "/admin/content", icon: FileText },
  { label: "Data", href: "/admin/data", icon: Database },
  { label: "Integrations", href: "/admin/integrations", icon: Puzzle },
  { label: "Subscriptions", href: "/admin/subscriptions", icon: CreditCard },
  { label: "Referrals", href: "/admin/referrals", icon: Gift },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-neutral-900">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="border-b border-neutral-800 px-6 py-5">
            <h1 className="text-lg font-semibold text-white">
              Admin Dashboard
            </h1>
            <Link
              href="/"
              className="mt-2 inline-flex items-center gap-1.5 text-sm text-neutral-400 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to site
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4">
            {navItems.map((item) => {
              const isActive =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-neutral-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-64 min-h-screen bg-neutral-50 p-8">{children}</main>
    </div>
  );
}

"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { ReactNode, useCallback } from "react";
import { cn } from "@/lib/utils/cn";

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabNavigationProps {
  tabs: Tab[];
  defaultTab?: string;
  children: ReactNode;
}

export function TabNavigation({ tabs, defaultTab, children }: TabNavigationProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const activeTab = searchParams.get("tab") || defaultTab || tabs[0]?.id;

  const handleTabClick = useCallback(
    (tabId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tabId === (defaultTab || tabs[0]?.id)) {
        params.delete("tab");
      } else {
        params.set("tab", tabId);
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchParams, router, pathname, defaultTab, tabs]
  );

  return (
    <div>
      {/* Tab bar */}
      <div className="border-b border-neutral-200 bg-white sticky top-[65px] z-30">
        <div className="max-w-7xl mx-auto px-4">
          <nav
            className="flex gap-0 overflow-x-auto scrollbar-hide -mb-px"
            role="tablist"
            aria-label="Page sections"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`tabpanel-${tab.id}`}
                onClick={() => handleTabClick(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors",
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-neutral-500 hover:text-neutral-800 hover:border-neutral-300"
                )}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span
                    className={cn(
                      "text-xs px-1.5 py-0.5 rounded-full",
                      activeTab === tab.id
                        ? "bg-blue-100 text-blue-700"
                        : "bg-neutral-100 text-neutral-500"
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab panels — all rendered, toggled via CSS */}
      {children}
    </div>
  );
}

/**
 * A single tab panel that reads ?tab from the URL to show/hide itself.
 * Can receive server-rendered ReactNode children safely.
 */
export function TabPanel({
  tabId,
  defaultTab,
  children,
}: {
  tabId: string;
  defaultTab: string;
  children: ReactNode;
}) {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || defaultTab;

  return (
    <div
      id={`tabpanel-${tabId}`}
      role="tabpanel"
      aria-labelledby={tabId}
      className={activeTab === tabId ? "block" : "hidden"}
    >
      {children}
    </div>
  );
}

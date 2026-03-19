"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { useSubscription } from "./subscription-provider";
import { cn } from "@/lib/utils/cn";

interface ProTeaserProps {
  children: ReactNode;
  className?: string;
  label?: string;
}

export function ProTeaser({
  children,
  className,
  label = "Unlock with Pro",
}: ProTeaserProps) {
  const { tier, isLoading } = useSubscription();

  if (isLoading || tier !== "free") {
    return <>{children}</>;
  }

  return (
    <div className={cn("relative", className)}>
      <div className="blur-[2px] select-none pointer-events-none">
        {children}
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/60 to-white/90 flex items-end justify-center pb-6">
        <Link
          href="/pricing"
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all"
        >
          <Lock className="w-4 h-4" />
          {label}
        </Link>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  CreditCard,
  Globe,
  Dribbble,
  Chrome,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ServiceStatus {
  name: string;
  description: string;
  configured: boolean;
}

const serviceIcons: Record<string, React.ElementType> = {
  Stripe: CreditCard,
  "Football-Data.org": Globe,
  "API-Football": Dribbble,
  "Google OAuth": Chrome,
  OpenAI: Sparkles,
};

const serviceColors: Record<string, { color: string; bgColor: string }> = {
  Stripe: { color: "text-purple-600", bgColor: "bg-purple-50" },
  "Football-Data.org": { color: "text-green-600", bgColor: "bg-green-50" },
  "API-Football": { color: "text-blue-600", bgColor: "bg-blue-50" },
  "Google OAuth": { color: "text-red-600", bgColor: "bg-red-50" },
  OpenAI: { color: "text-amber-600", bgColor: "bg-amber-50" },
};

export default function AdminIntegrationsPage() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchIntegrations() {
      try {
        const res = await fetch("/api/admin/integrations");
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || "Failed to fetch integrations");
        }
        const data = await res.json();
        setServices(data.services);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch integrations"
        );
      } finally {
        setLoading(false);
      }
    }

    fetchIntegrations();
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-neutral-900">Integrations</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Status of connected third-party services.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-2xl border border-neutral-200 bg-white"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => {
            const Icon = serviceIcons[service.name] || Globe;
            const colors = serviceColors[service.name] || {
              color: "text-neutral-600",
              bgColor: "bg-neutral-50",
            };

            return (
              <div
                key={service.name}
                className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("rounded-lg p-2.5", colors.bgColor)}>
                      <Icon className={cn("h-5 w-5", colors.color)} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-900">
                        {service.name}
                      </h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-block h-2.5 w-2.5 rounded-full",
                        service.configured ? "bg-green-500" : "bg-neutral-300"
                      )}
                    />
                    <span
                      className={cn(
                        "text-xs font-medium",
                        service.configured
                          ? "text-green-700"
                          : "text-neutral-400"
                      )}
                    >
                      {service.configured ? "Configured" : "Not configured"}
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-sm text-neutral-500">
                  {service.description}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

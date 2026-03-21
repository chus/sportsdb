"use client";

import { useState, useEffect } from "react";
import { Gift, Users, CreditCard, Award, ArrowRight } from "lucide-react";

interface FunnelData {
  link_clicked: number;
  signup_completed: number;
  subscription_activated: number;
  reward_applied: number;
}

interface TopReferrer {
  userId: string;
  name: string | null;
  email: string;
  signups: number;
  subscriptions: number;
  rewards: number;
}

interface RecentEvent {
  id: string;
  eventType: string;
  createdAt: string;
  referrerName: string | null;
  referrerEmail: string;
  referredName: string | null;
  referredEmail: string | null;
}

export default function AdminReferralsPage() {
  const [data, setData] = useState<{
    funnel: FunnelData;
    topReferrers: TopReferrer[];
    recentEvents: RecentEvent[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/referrals")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-300 border-t-blue-600" />
      </div>
    );
  }

  if (!data) return <p className="py-10 text-center text-neutral-500">Failed to load data</p>;

  const { funnel, topReferrers, recentEvents } = data;

  const funnelStages = [
    { label: "Link Clicked", value: funnel.link_clicked, icon: Gift, color: "bg-blue-500" },
    { label: "Signed Up", value: funnel.signup_completed, icon: Users, color: "bg-indigo-500" },
    { label: "Subscribed", value: funnel.subscription_activated, icon: CreditCard, color: "bg-purple-500" },
    { label: "Reward Applied", value: funnel.reward_applied, icon: Award, color: "bg-green-500" },
  ];

  const eventTypeLabels: Record<string, string> = {
    link_clicked: "Link Clicked",
    signup_completed: "Signed Up",
    subscription_activated: "Subscribed",
    reward_applied: "Reward Applied",
  };

  return (
    <div>
      <h1 className="mb-8 text-2xl font-bold text-neutral-900">Referral Analytics</h1>

      {/* Funnel */}
      <div className="mb-8 rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">Referral Funnel</h2>
        <div className="flex items-center gap-2">
          {funnelStages.map((stage, i) => (
            <div key={stage.label} className="flex items-center gap-2 flex-1">
              <div className="flex-1 rounded-lg border border-neutral-200 p-4 text-center">
                <div className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg ${stage.color}`}>
                  <stage.icon className="h-5 w-5 text-white" />
                </div>
                <p className="text-2xl font-bold text-neutral-900">{stage.value}</p>
                <p className="text-xs text-neutral-500">{stage.label}</p>
                {i > 0 && funnelStages[i - 1].value > 0 && (
                  <p className="mt-1 text-xs font-medium text-neutral-400">
                    {((stage.value / funnelStages[i - 1].value) * 100).toFixed(1)}%
                  </p>
                )}
              </div>
              {i < funnelStages.length - 1 && (
                <ArrowRight className="h-4 w-4 flex-shrink-0 text-neutral-300" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Top Referrers */}
      <div className="mb-8 rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">Top Referrers</h2>
        {topReferrers.length === 0 ? (
          <p className="text-sm text-neutral-500">No referrals yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left">
                  <th className="pb-3 font-medium text-neutral-500">User</th>
                  <th className="pb-3 text-center font-medium text-neutral-500">Signups</th>
                  <th className="pb-3 text-center font-medium text-neutral-500">Subscriptions</th>
                  <th className="pb-3 text-center font-medium text-neutral-500">Rewards</th>
                </tr>
              </thead>
              <tbody>
                {topReferrers.map((r) => (
                  <tr key={r.userId} className="border-b border-neutral-100">
                    <td className="py-3">
                      <p className="font-medium text-neutral-900">{r.name || "—"}</p>
                      <p className="text-xs text-neutral-500">{r.email}</p>
                    </td>
                    <td className="py-3 text-center font-semibold text-neutral-900">{r.signups}</td>
                    <td className="py-3 text-center font-semibold text-neutral-900">{r.subscriptions}</td>
                    <td className="py-3 text-center font-semibold text-neutral-900">{r.rewards}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Events */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">Recent Events</h2>
        {recentEvents.length === 0 ? (
          <p className="text-sm text-neutral-500">No events yet</p>
        ) : (
          <div className="space-y-3">
            {recentEvents.slice(0, 20).map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between rounded-lg border border-neutral-100 px-4 py-3"
              >
                <div>
                  <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
                    {eventTypeLabels[event.eventType] || event.eventType}
                  </span>
                  <p className="mt-1 text-sm text-neutral-700">
                    <span className="font-medium">{event.referrerName || event.referrerEmail}</span>
                    {event.referredName || event.referredEmail
                      ? ` → ${event.referredName || event.referredEmail}`
                      : ""}
                  </p>
                </div>
                <p className="text-xs text-neutral-400">
                  {new Date(event.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

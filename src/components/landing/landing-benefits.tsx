"use client";

import Link from "next/link";
import { Check, Sparkles, ArrowRight } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useSubscription } from "@/components/subscription/subscription-provider";

export function LandingBenefits() {
  const { user, isLoading } = useAuth();
  const { subscription } = useSubscription();
  const isPro = subscription?.tier === "pro" || subscription?.tier === "ultimate";

  const benefits = [
    {
      title: "Entity-Driven",
      description:
        "Not a news site. Focus on players, teams, and competitions with deep internal linking.",
    },
    {
      title: "Time-Aware",
      description:
        "View current stats or travel back in time to any season in history.",
    },
    {
      title: "Personalized Feed",
      description:
        "Your activity feed shows only what matters to you based on who you follow.",
    },
    {
      title: "No Betting, No Fantasy",
      description:
        "Pure sports knowledge. No gambling, no fantasy leagues, just information.",
    },
  ];

  return (
    <section className="py-20 bg-gradient-to-b from-neutral-50 to-white">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-4xl font-bold text-neutral-900 mb-6">
              Why SportsDB?
            </h2>
            <div className="space-y-4">
              {benefits.map((benefit) => (
                <div key={benefit.title} className="flex items-start gap-4">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-neutral-900 mb-1">
                      {benefit.title}
                    </h3>
                    <p className="text-neutral-700">{benefit.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 p-8">
            {!isLoading && user ? (
              // Logged in user - show upgrade CTA or exploration prompt
              isPro ? (
                <>
                  <div className="text-center mb-6">
                    <div className="text-6xl mb-4">⭐</div>
                    <h3 className="text-2xl font-bold text-neutral-900 mb-2">
                      Welcome back, {user.name || "Champion"}!
                    </h3>
                    <p className="text-neutral-600">
                      You have full access to all SportsDB features
                    </p>
                  </div>
                  <Link
                    href="/predictions"
                    className="block w-full px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-lg font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl text-center"
                  >
                    Make Predictions
                  </Link>
                  <Link
                    href="/stats"
                    className="block w-full px-8 py-4 mt-3 bg-white border-2 border-neutral-200 text-neutral-900 text-lg font-semibold rounded-xl hover:border-blue-600 hover:text-blue-600 transition-all text-center"
                  >
                    View Advanced Stats
                  </Link>
                </>
              ) : (
                <>
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full mb-4">
                      <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-neutral-900 mb-2">
                      Unlock Pro Features
                    </h3>
                    <p className="text-neutral-600">
                      Advanced stats, unlimited follows, and more
                    </p>
                  </div>
                  <Link
                    href="/pricing"
                    className="block w-full px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-lg font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl text-center flex items-center justify-center gap-2"
                  >
                    Upgrade to Pro
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                  <p className="text-center text-sm text-neutral-500 mt-4">
                    Starting at $4.99/month
                  </p>
                </>
              )
            ) : (
              // Not logged in - show signup CTA
              <>
                <div className="text-center mb-6">
                  <div className="text-6xl mb-4">🏆</div>
                  <h3 className="text-2xl font-bold text-neutral-900 mb-2">
                    Ready to get started?
                  </h3>
                  <p className="text-neutral-600">
                    Join thousands of sports fans already using SportsDB
                  </p>
                </div>
                <Link
                  href="/signup"
                  className="block w-full px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-lg font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl text-center"
                >
                  Create Free Account
                </Link>
                <p className="text-center text-sm text-neutral-500 mt-4">
                  Free forever. No credit card required.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

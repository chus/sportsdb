import Link from "next/link";
import { Check } from "lucide-react";

export function LandingBenefits() {
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
          </div>
        </div>
      </div>
    </section>
  );
}

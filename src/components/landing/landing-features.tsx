import { Users, Activity, TrendingUp } from "lucide-react";

export function LandingFeatures() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-neutral-900 mb-4">
            Everything You Need to Follow Sports
          </h2>
          <p className="text-xl text-neutral-600">
            A personalized sports experience, powered by the world's largest
            database
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-100">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center mb-6 shadow-lg">
              <Users className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-neutral-900 mb-3">
              Follow Entities
            </h3>
            <p className="text-neutral-700 leading-relaxed">
              Follow players, teams, and competitions to build your
              personalized sports universe.
            </p>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8 border border-green-100">
            <div className="w-14 h-14 bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl flex items-center justify-center mb-6 shadow-lg">
              <Activity className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-neutral-900 mb-3">
              Live Updates
            </h3>
            <p className="text-neutral-700 leading-relaxed">
              Get real-time notifications about goals, match results, and
              milestones from your followed entities.
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-8 border border-purple-100">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center mb-6 shadow-lg">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-neutral-900 mb-3">
              Deep Analysis
            </h3>
            <p className="text-neutral-700 leading-relaxed">
              Compare players, explore career timelines, and dive deep into
              stats and history.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

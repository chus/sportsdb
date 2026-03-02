import { Gamepad2, Bell, BarChart3, Crown, GitCompareArrows, Bookmark } from "lucide-react";

const features = [
  {
    title: "Prediction Game",
    description: "Test your football knowledge by predicting match outcomes and compete with friends.",
    icon: Gamepad2,
    gradient: "from-blue-600 to-indigo-600",
    bg: "from-blue-50 to-indigo-50",
    border: "border-blue-100",
  },
  {
    title: "Smart Notifications",
    description: "Get real-time alerts for goals, results, and milestones from your followed entities.",
    icon: Bell,
    gradient: "from-green-600 to-emerald-600",
    bg: "from-green-50 to-emerald-50",
    border: "border-green-100",
  },
  {
    title: "Advanced Stats",
    description: "Deep dive into player and team analytics with season comparisons and career trends.",
    icon: BarChart3,
    gradient: "from-purple-600 to-pink-600",
    bg: "from-purple-50 to-pink-50",
    border: "border-purple-100",
  },
  {
    title: "Upgrade to Pro",
    description: "Unlock premium features, ad-free experience, and exclusive data insights.",
    icon: Crown,
    gradient: "from-orange-600 to-amber-600",
    bg: "from-orange-50 to-amber-50",
    border: "border-orange-100",
  },
  {
    title: "Player Comparison",
    description: "Compare players side by side across stats, careers, and performance metrics.",
    icon: GitCompareArrows,
    gradient: "from-cyan-600 to-blue-600",
    bg: "from-cyan-50 to-blue-50",
    border: "border-cyan-100",
  },
  {
    title: "Bookmarks",
    description: "Save your favorite players, teams, and matches for quick access anytime.",
    icon: Bookmark,
    gradient: "from-rose-600 to-red-600",
    bg: "from-rose-50 to-red-50",
    border: "border-rose-100",
  },
];

export function LandingFeatures() {
  return (
    <section className="py-20 bg-gradient-to-br from-neutral-50 via-blue-50 to-purple-50">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-4">
            Explore & Discover
          </h2>
          <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
            A personalized sports experience, powered by the world&apos;s largest database
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className={`bg-white rounded-2xl p-8 border ${feature.border} hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group`}
            >
              <div className={`w-14 h-14 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform`}>
                <feature.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-3">
                {feature.title}
              </h3>
              <p className="text-neutral-600 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

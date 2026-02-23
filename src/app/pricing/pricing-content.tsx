"use client";

import { PricingCards } from "@/components/subscription/pricing-cards";

export function PricingPageContent() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      {/* Hero Section */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-neutral-900 mb-4">
            Choose Your Plan
          </h1>
          <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
            Unlock advanced stats, unlimited follows, and exclusive features.
            Start free and upgrade anytime.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-16 md:pb-24">
        <div className="max-w-5xl mx-auto px-4">
          <PricingCards />
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-neutral-50 border-t border-neutral-200">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-neutral-900 mb-8 text-center">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <FaqItem
              question="Can I cancel anytime?"
              answer="Yes, you can cancel your subscription at any time. You'll continue to have access to Pro features until the end of your billing period."
            />
            <FaqItem
              question="What happens when I downgrade?"
              answer="When you downgrade to Free, you'll keep access to Pro features until the end of your current billing period. After that, usage limits will apply."
            />
            <FaqItem
              question="Is there a free trial?"
              answer="The Free tier gives you access to core features forever. Upgrade when you need unlimited follows, advanced stats, and more."
            />
            <FaqItem
              question="What payment methods do you accept?"
              answer="We accept all major credit cards, including Visa, Mastercard, and American Express."
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6">
      <h3 className="font-semibold text-neutral-900 mb-2">{question}</h3>
      <p className="text-neutral-600">{answer}</p>
    </div>
  );
}

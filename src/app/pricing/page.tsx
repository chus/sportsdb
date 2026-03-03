"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { PricingCards } from "@/components/subscription/pricing-cards";
import { cn } from "@/lib/utils/cn";

const faqs = [
  {
    question: "Can I cancel my subscription at any time?",
    answer:
      "Yes, you can cancel your subscription at any time. Your access will continue until the end of your current billing period.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit cards (Visa, Mastercard, American Express) and PayPal.",
  },
  {
    question: "Is there a free trial for Pro?",
    answer:
      "The Free tier gives you access to core features. Upgrade to Pro anytime to unlock advanced stats, unlimited comparisons, and more.",
  },
  {
    question: "What happens to my data if I downgrade?",
    answer:
      "Your data is always preserved. If you downgrade, you keep your follows (up to the free tier limit) and can still access basic features.",
  },
  {
    question: "Do you offer team or organization pricing?",
    answer:
      "Not yet, but we're working on it. Contact us if you're interested in a team plan.",
  },
];

export default function PricingPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto">
            Unlock advanced stats, unlimited comparisons, and premium features to take your sports analysis to the next level.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-16 bg-neutral-50">
        <div className="max-w-7xl mx-auto px-4">
          <PricingCards />
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-neutral-900 text-center mb-10">
            Frequently Asked Questions
          </h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <FaqItem key={i} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left"
      >
        <span className="text-sm font-medium text-neutral-900">{question}</span>
        <ChevronDown
          className={cn(
            "w-5 h-5 text-neutral-400 flex-shrink-0 ml-4 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="px-6 pb-4">
          <p className="text-sm text-neutral-600">{answer}</p>
        </div>
      )}
    </div>
  );
}

import { Mail, MessageSquare, Github, Twitter } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://sportsdb-nine.vercel.app";

export const metadata: Metadata = {
  title: "Contact Us – SportsDB",
  description: "Get in touch with the SportsDB team. We welcome feedback, partnership inquiries, and data correction requests.",
  openGraph: {
    title: "Contact SportsDB",
    description: "Get in touch with the SportsDB team for feedback, partnerships, or data corrections.",
    url: `${BASE_URL}/contact`,
    siteName: "SportsDB",
    type: "website",
  },
  alternates: {
    canonical: `${BASE_URL}/contact`,
  },
};

export default function ContactPage() {
  const contactMethods = [
    {
      icon: Mail,
      title: "Email",
      description: "For general inquiries and support",
      value: "hello@sportsdb.com",
      href: "mailto:hello@sportsdb.com",
    },
    {
      icon: Github,
      title: "GitHub",
      description: "Report issues or contribute",
      value: "github.com/sportsdb",
      href: "https://github.com/sportsdb",
    },
    {
      icon: Twitter,
      title: "Twitter / X",
      description: "Follow us for updates",
      value: "@sportsdb",
      href: "https://twitter.com/sportsdb",
    },
  ];

  const faqItems = [
    {
      question: "How can I report incorrect data?",
      answer: "If you find any incorrect information in our database, please email us at hello@sportsdb.com with details about the error and the correct information. We review all submissions and update our database accordingly.",
    },
    {
      question: "Do you offer an API?",
      answer: "We're currently developing a public API for developers. If you're interested in early access, please reach out via email with details about your use case.",
    },
    {
      question: "Can I use SportsDB data for my project?",
      answer: "SportsDB data is available for personal and educational use. For commercial use or large-scale data access, please contact us to discuss licensing options.",
    },
    {
      question: "How often is the data updated?",
      answer: "Our database is updated regularly during active seasons. Match results, standings, and player statistics are typically updated within 24 hours of matches concluding.",
    },
  ];

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-2xl mb-6">
            <MessageSquare className="w-10 h-10" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Contact Us</h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto">
            Have questions, feedback, or found an error? We&apos;d love to hear from you.
          </p>
        </div>
      </section>

      {/* Contact Methods */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-neutral-900 mb-8 text-center">
            Get in Touch
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {contactMethods.map((method) => (
              <a
                key={method.title}
                href={method.href}
                target={method.href.startsWith("http") ? "_blank" : undefined}
                rel={method.href.startsWith("http") ? "noopener noreferrer" : undefined}
                className="bg-white rounded-xl border border-neutral-200 p-6 hover:shadow-lg hover:border-blue-200 transition-all group"
              >
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                  <method.icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-1">
                  {method.title}
                </h3>
                <p className="text-sm text-neutral-500 mb-3">
                  {method.description}
                </p>
                <p className="text-blue-600 font-medium group-hover:underline">
                  {method.value}
                </p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form Placeholder */}
      <section className="py-16 bg-white">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-neutral-900 mb-8 text-center">
            Send Us a Message
          </h2>
          <form className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-neutral-700 mb-2"
                >
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  className="w-full px-4 py-3 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-neutral-700 mb-2"
                >
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  className="w-full px-4 py-3 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                  placeholder="you@example.com"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="subject"
                className="block text-sm font-medium text-neutral-700 mb-2"
              >
                Subject
              </label>
              <select
                id="subject"
                name="subject"
                className="w-full px-4 py-3 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
              >
                <option value="">Select a topic</option>
                <option value="general">General Inquiry</option>
                <option value="data">Data Correction</option>
                <option value="partnership">Partnership</option>
                <option value="api">API Access</option>
                <option value="feedback">Feedback</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="message"
                className="block text-sm font-medium text-neutral-700 mb-2"
              >
                Message
              </label>
              <textarea
                id="message"
                name="message"
                rows={6}
                className="w-full px-4 py-3 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors resize-none"
                placeholder="How can we help you?"
              />
            </div>
            <button
              type="submit"
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Send Message
            </button>
            <p className="text-xs text-neutral-500 text-center">
              By submitting this form, you agree to our{" "}
              <Link href="/privacy" className="text-blue-600 hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </form>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-neutral-900 mb-8 text-center">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {faqItems.map((item, index) => (
              <div
                key={index}
                className="bg-white rounded-xl border border-neutral-200 p-6"
              >
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                  {item.question}
                </h3>
                <p className="text-neutral-600">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

import { Shield } from "lucide-react";
import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://sportsdb-nine.vercel.app";

export const metadata: Metadata = {
  title: "Privacy Policy – SportsDB",
  description: "Learn how SportsDB collects, uses, and protects your personal information. Our commitment to your privacy.",
  openGraph: {
    title: "Privacy Policy – SportsDB",
    description: "Learn how SportsDB handles your personal information.",
    url: `${BASE_URL}/privacy`,
    siteName: "SportsDB",
    type: "website",
  },
  alternates: {
    canonical: `${BASE_URL}/privacy`,
  },
};

export default function PrivacyPage() {
  const lastUpdated = "February 2026";

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-neutral-800 to-neutral-900 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl mb-6">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-neutral-400">Last updated: {lastUpdated}</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-white rounded-xl border border-neutral-200 p-8 md:p-12">
            <div className="prose prose-neutral max-w-none">
              <h2>Introduction</h2>
              <p>
                SportsDB (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website sportsdb.com (the &quot;Site&quot;).
              </p>
              <p>
                Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the site.
              </p>

              <h2>Information We Collect</h2>

              <h3>Information You Provide</h3>
              <p>We may collect information that you voluntarily provide when you:</p>
              <ul>
                <li>Create an account on our Site</li>
                <li>Subscribe to our newsletter</li>
                <li>Contact us through our contact form</li>
                <li>Participate in surveys or promotions</li>
              </ul>
              <p>
                This information may include your name, email address, and any other information you choose to provide.
              </p>

              <h3>Automatically Collected Information</h3>
              <p>
                When you visit our Site, we may automatically collect certain information about your device and usage, including:
              </p>
              <ul>
                <li>IP address and location data</li>
                <li>Browser type and version</li>
                <li>Operating system</li>
                <li>Pages visited and time spent on pages</li>
                <li>Referring website addresses</li>
              </ul>

              <h2>How We Use Your Information</h2>
              <p>We may use the information we collect to:</p>
              <ul>
                <li>Provide, maintain, and improve our services</li>
                <li>Send you technical notices and support messages</li>
                <li>Respond to your comments and questions</li>
                <li>Send promotional communications (with your consent)</li>
                <li>Monitor and analyze usage patterns and trends</li>
                <li>Detect, prevent, and address technical issues</li>
              </ul>

              <h2>Cookies and Tracking Technologies</h2>
              <p>
                We use cookies and similar tracking technologies to track activity on our Site and hold certain information. Cookies are files with a small amount of data that are sent to your browser from a website and stored on your device.
              </p>
              <p>
                You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our Site.
              </p>

              <h2>Third-Party Services</h2>
              <p>
                We may use third-party services that collect, monitor, and analyze usage data:
              </p>
              <ul>
                <li><strong>Analytics:</strong> We use analytics services to understand how visitors use our Site.</li>
                <li><strong>Hosting:</strong> Our Site is hosted on Vercel, which may collect technical information.</li>
              </ul>

              <h2>Data Security</h2>
              <p>
                We use administrative, technical, and physical security measures to protect your personal information. While we have taken reasonable steps to secure the information you provide, please be aware that no security measures are perfect or impenetrable.
              </p>

              <h2>Data Retention</h2>
              <p>
                We will retain your personal information only for as long as is necessary for the purposes set out in this Privacy Policy. We will retain and use your information to the extent necessary to comply with our legal obligations, resolve disputes, and enforce our policies.
              </p>

              <h2>Your Rights</h2>
              <p>Depending on your location, you may have certain rights regarding your personal information:</p>
              <ul>
                <li>The right to access the personal information we hold about you</li>
                <li>The right to request correction of inaccurate information</li>
                <li>The right to request deletion of your information</li>
                <li>The right to opt out of marketing communications</li>
                <li>The right to data portability</li>
              </ul>
              <p>
                To exercise these rights, please contact us using the information provided below.
              </p>

              <h2>Children&apos;s Privacy</h2>
              <p>
                Our Site is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If we learn we have collected personal information from a child under 13, we will delete that information.
              </p>

              <h2>Changes to This Privacy Policy</h2>
              <p>
                We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the &quot;Last updated&quot; date.
              </p>

              <h2>Contact Us</h2>
              <p>
                If you have questions or concerns about this Privacy Policy, please contact us at:
              </p>
              <ul>
                <li>Email: privacy@sportsdb.com</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

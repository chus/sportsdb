import { FileText } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const metadata: Metadata = {
  title: "Terms of Service – SportsDB",
  description: "Read the terms and conditions for using SportsDB. Understand your rights and responsibilities when using our platform.",
  openGraph: {
    title: "Terms of Service – SportsDB",
    description: "Terms and conditions for using SportsDB.",
    url: `${BASE_URL}/terms`,
    siteName: "SportsDB",
    type: "website",
  },
  alternates: {
    canonical: `${BASE_URL}/terms`,
  },
};

export default function TermsPage() {
  const lastUpdated = "February 2026";

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-neutral-800 to-neutral-900 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl mb-6">
            <FileText className="w-8 h-8" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
          <p className="text-neutral-400">Last updated: {lastUpdated}</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-white rounded-xl border border-neutral-200 p-8 md:p-12">
            <div className="prose prose-neutral max-w-none">
              <h2>1. Acceptance of Terms</h2>
              <p>
                By accessing and using SportsDB (&quot;the Site&quot;), you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our Site.
              </p>

              <h2>2. Description of Service</h2>
              <p>
                SportsDB provides a database of football (soccer) information including player profiles, team information, match results, standings, and related statistics. The service is provided &quot;as is&quot; and we make no guarantees regarding the accuracy, completeness, or timeliness of the information.
              </p>

              <h2>3. User Accounts</h2>
              <p>
                Some features of our Site may require you to create an account. When you create an account, you agree to:
              </p>
              <ul>
                <li>Provide accurate and complete information</li>
                <li>Maintain the security of your account credentials</li>
                <li>Accept responsibility for all activities under your account</li>
                <li>Notify us immediately of any unauthorized use</li>
              </ul>

              <h2>4. Acceptable Use</h2>
              <p>You agree not to:</p>
              <ul>
                <li>Use the Site for any unlawful purpose</li>
                <li>Attempt to gain unauthorized access to any part of the Site</li>
                <li>Interfere with or disrupt the Site or servers</li>
                <li>Scrape, crawl, or use automated means to access the Site without permission</li>
                <li>Use the Site to transmit malware or harmful code</li>
                <li>Impersonate any person or entity</li>
                <li>Collect user information without consent</li>
              </ul>

              <h2>5. Intellectual Property</h2>
              <p>
                The Site and its original content, features, and functionality are owned by SportsDB and are protected by international copyright, trademark, and other intellectual property laws.
              </p>
              <p>
                Sports data displayed on the Site may be subject to third-party rights. Team names, logos, and player likenesses are trademarks of their respective owners.
              </p>

              <h2>6. User Content</h2>
              <p>
                If you submit content to our Site (such as comments or corrections), you grant us a non-exclusive, worldwide, royalty-free license to use, modify, and display that content in connection with our services.
              </p>
              <p>
                You represent that you own or have the necessary rights to submit such content and that it does not violate any third-party rights.
              </p>

              <h2>7. Data Usage</h2>
              <p>
                The data provided on SportsDB is intended for personal, non-commercial use. Commercial use of our data requires explicit written permission. Please <Link href="/contact" className="text-blue-600 hover:underline">contact us</Link> for licensing inquiries.
              </p>
              <p>
                Automated access to our data (including scraping, crawling, or API access) requires prior authorization.
              </p>

              <h2>8. Disclaimer of Warranties</h2>
              <p>
                THE SITE IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS. WE MAKE NO WARRANTIES, EXPRESS OR IMPLIED, REGARDING THE SITE&apos;S OPERATION OR THE INFORMATION, CONTENT, OR MATERIALS INCLUDED.
              </p>
              <p>
                We do not warrant that:
              </p>
              <ul>
                <li>The Site will be uninterrupted or error-free</li>
                <li>Defects will be corrected</li>
                <li>The Site is free of viruses or harmful components</li>
                <li>The information on the Site is accurate or complete</li>
              </ul>

              <h2>9. Limitation of Liability</h2>
              <p>
                TO THE FULLEST EXTENT PERMITTED BY LAW, SPORTSDB SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO YOUR USE OF THE SITE.
              </p>

              <h2>10. Indemnification</h2>
              <p>
                You agree to indemnify and hold harmless SportsDB and its officers, directors, employees, and agents from any claims, damages, losses, or expenses arising from your use of the Site or violation of these Terms.
              </p>

              <h2>11. Third-Party Links</h2>
              <p>
                Our Site may contain links to third-party websites. We are not responsible for the content or practices of these external sites. We encourage you to review their terms and privacy policies.
              </p>

              <h2>12. Modifications to Terms</h2>
              <p>
                We reserve the right to modify these Terms at any time. Changes will be effective immediately upon posting. Your continued use of the Site constitutes acceptance of the modified Terms.
              </p>

              <h2>13. Termination</h2>
              <p>
                We may terminate or suspend your access to the Site immediately, without prior notice, for any reason, including breach of these Terms. Upon termination, your right to use the Site will cease immediately.
              </p>

              <h2>14. Governing Law</h2>
              <p>
                These Terms shall be governed by and construed in accordance with applicable laws, without regard to conflict of law principles.
              </p>

              <h2>15. Contact Information</h2>
              <p>
                If you have any questions about these Terms, please contact us:
              </p>
              <ul>
                <li>Email: legal@sportsdb.com</li>
                <li>Contact form: <Link href="/contact" className="text-blue-600 hover:underline">sportsdb.com/contact</Link></li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

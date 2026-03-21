import { Shield } from "lucide-react";
import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

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
  const lastUpdated = "March 2026";

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

              {/* 1. Introduction */}
              <h2>1. Introduction</h2>
              <p>
                SportsDB (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website {BASE_URL} (the &quot;Site&quot;).
              </p>
              <p>
                Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the site.
              </p>
              <p>
                This policy is designed to comply with the General Data Protection Regulation (GDPR), the ePrivacy Directive, and other applicable data protection laws. The data controller responsible for your personal data is SportsDB, reachable at privacy@datasports.co.
              </p>

              {/* 2. Information We Collect */}
              <h2>2. Information We Collect</h2>

              <h3>2.1 Account Information</h3>
              <p>
                When you create an account on our Site, we collect information that you voluntarily provide, including:
              </p>
              <ul>
                <li>Name and email address</li>
                <li>Authentication credentials (password or OAuth tokens via Google)</li>
                <li>League and team preferences you select during onboarding</li>
                <li>Subscription and billing details (processed by Stripe; we store only a reference identifier, never full payment card numbers)</li>
              </ul>

              <h3>2.2 Usage Data</h3>
              <p>
                When you visit our Site, we automatically collect certain technical and behavioural information, including:
              </p>
              <ul>
                <li>IP address and approximate geolocation</li>
                <li>Browser type, version, and language</li>
                <li>Operating system and device type</li>
                <li>Pages visited, time spent on each page, and navigation paths</li>
                <li>Referring and exit URLs</li>
                <li>Timestamps and frequency of visits</li>
              </ul>

              <h3>2.3 Cookies</h3>
              <p>
                We use cookies and similar technologies (pixels, local storage) to collect and store information when you interact with our Site. For full details on the categories of cookies we use and how to manage your preferences, see Section 5 below.
              </p>

              {/* 3. Why We Collect Data */}
              <h2>3. Why We Collect Data</h2>
              <p>We process your personal data for the following purposes:</p>

              <h3>3.1 Service Delivery</h3>
              <ul>
                <li>Providing, operating, and maintaining the Site and your account</li>
                <li>Authenticating your identity and managing sessions</li>
                <li>Processing subscription payments and managing billing</li>
                <li>Delivering personalised content based on your league and team preferences</li>
                <li>Responding to your enquiries and providing customer support</li>
              </ul>

              <h3>3.2 Analytics</h3>
              <ul>
                <li>Understanding how visitors use our Site so we can improve the user experience</li>
                <li>Monitoring aggregate traffic patterns, page popularity, and feature adoption</li>
                <li>Diagnosing technical issues and improving Site performance</li>
              </ul>

              <h3>3.3 Advertising</h3>
              <ul>
                <li>Displaying relevant advertisements through Google AdSense</li>
                <li>Measuring advertising performance and attribution</li>
                <li>Limiting the number of times you see a particular ad</li>
              </ul>

              {/* 4. Legal Basis for Processing */}
              <h2>4. Legal Basis for Processing</h2>
              <p>
                Under the GDPR, we rely on the following legal bases when processing your personal data:
              </p>

              <h3>4.1 Consent (Article 6(1)(a) GDPR)</h3>
              <p>We rely on your freely given, specific, informed, and unambiguous consent for:</p>
              <ul>
                <li><strong>Analytics cookies:</strong> Placing and reading non-essential analytics cookies (e.g., Google Analytics) to understand Site usage</li>
                <li><strong>Advertising cookies:</strong> Placing and reading advertising cookies (e.g., Google AdSense) to deliver personalised advertisements</li>
              </ul>
              <p>
                You may withdraw your consent at any time via the Cookie Settings panel accessible from the cookie consent banner or from the footer of our Site. Withdrawal of consent does not affect the lawfulness of processing carried out before the withdrawal.
              </p>

              <h3>4.2 Legitimate Interest (Article 6(1)(f) GDPR)</h3>
              <p>We rely on our legitimate interests for:</p>
              <ul>
                <li><strong>Service delivery:</strong> Ensuring the Site functions correctly, loading content efficiently, and maintaining uptime</li>
                <li><strong>Security:</strong> Detecting and preventing fraud, abuse, and unauthorised access to our systems</li>
                <li><strong>Internal analytics:</strong> Aggregated, non-identifying analysis of usage patterns to improve the Site</li>
              </ul>
              <p>
                We have conducted balancing tests to ensure that our legitimate interests do not override your fundamental rights and freedoms.
              </p>

              <h3>4.3 Performance of a Contract (Article 6(1)(b) GDPR)</h3>
              <p>We process data as necessary to perform our contract with you for:</p>
              <ul>
                <li><strong>Subscription billing:</strong> Processing payments, issuing invoices, and managing your subscription status</li>
                <li><strong>Account management:</strong> Creating, maintaining, and deleting your account at your request</li>
              </ul>

              {/* 5. Cookies and Tracking */}
              <h2>5. Cookies and Tracking Technologies</h2>
              <p>
                Cookies are small text files placed on your device by our Site. We categorise the cookies we use as follows:
              </p>

              <h3>5.1 Essential Cookies</h3>
              <p>
                These cookies are strictly necessary for the Site to function and cannot be switched off. They include session identifiers, authentication tokens, cookie consent preferences, and CSRF protection tokens. Because they are essential, no consent is required under the ePrivacy Directive.
              </p>

              <h3>5.2 Analytics Cookies (Google Analytics 4)</h3>
              <p>
                We use Google Analytics 4 (GA4) to collect anonymised usage statistics. GA4 cookies (e.g., <code>_ga</code>, <code>_ga_*</code>) measure page views, session duration, bounce rates, and user journeys. IP anonymisation is enabled by default in GA4. These cookies are only set after you provide consent via our cookie consent banner.
              </p>

              <h3>5.3 Advertising Cookies (Google AdSense)</h3>
              <p>
                Google AdSense places cookies to serve advertisements relevant to your interests and to limit the number of times you see an ad. These cookies may track your browsing activity across other websites that also use Google&apos;s advertising network. Advertising cookies are only set after you provide consent via our cookie consent banner.
              </p>

              <p>
                You can manage your cookie preferences at any time by clicking the &quot;Cookie Settings&quot; link in our cookie consent banner or in the Site footer. You can also configure your browser to block or delete cookies, although this may affect Site functionality.
              </p>

              {/* 6. Third-Party Data Processors */}
              <h2>6. Third-Party Data Processors</h2>
              <p>
                We share personal data with the following third-party processors, each of whom processes data on our behalf under a Data Processing Agreement (DPA):
              </p>

              <table>
                <thead>
                  <tr>
                    <th>Processor</th>
                    <th>Purpose</th>
                    <th>Privacy Policy</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Stripe</strong></td>
                    <td>Payment processing and subscription billing</td>
                    <td><a href="https://stripe.com/privacy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">stripe.com/privacy</a></td>
                  </tr>
                  <tr>
                    <td><strong>Google Analytics</strong></td>
                    <td>Website analytics and usage measurement</td>
                    <td><a href="https://policies.google.com/privacy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">policies.google.com/privacy</a></td>
                  </tr>
                  <tr>
                    <td><strong>Google AdSense</strong></td>
                    <td>Advertising and ad personalisation</td>
                    <td><a href="https://policies.google.com/privacy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">policies.google.com/privacy</a></td>
                  </tr>
                  <tr>
                    <td><strong>Vercel</strong></td>
                    <td>Website hosting and edge delivery</td>
                    <td><a href="https://vercel.com/legal/privacy-policy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">vercel.com/legal/privacy-policy</a></td>
                  </tr>
                  <tr>
                    <td><strong>Neon</strong></td>
                    <td>Serverless PostgreSQL database hosting</td>
                    <td><a href="https://neon.tech/privacy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">neon.tech/privacy</a></td>
                  </tr>
                  <tr>
                    <td><strong>OpenAI</strong></td>
                    <td>AI-assisted content generation (articles and entity descriptions)</td>
                    <td><a href="https://openai.com/policies/privacy-policy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">openai.com/policies/privacy-policy</a></td>
                  </tr>
                </tbody>
              </table>

              {/* 7. International Data Transfers */}
              <h2>7. International Data Transfers</h2>
              <p>
                Some of our third-party processors are based in the United States, including Neon (database hosting) and Vercel (website hosting). When personal data is transferred from the European Economic Area (EEA) or the United Kingdom to the United States, we ensure appropriate safeguards are in place.
              </p>
              <p>
                These transfers are protected by EU Standard Contractual Clauses (SCCs) as approved by the European Commission, or by the EU-U.S. Data Privacy Framework where the recipient is certified. We review these safeguards regularly to ensure continued compliance.
              </p>

              {/* 8. Data Retention Periods */}
              <h2>8. Data Retention Periods</h2>
              <p>
                We retain your personal data only for as long as necessary to fulfil the purposes described in this policy. Specific retention periods are as follows:
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Data Category</th>
                    <th>Retention Period</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Account data (name, email, preferences)</td>
                    <td>Until you delete your account</td>
                  </tr>
                  <tr>
                    <td>Analytics data (GA4)</td>
                    <td>26 months from collection</td>
                  </tr>
                  <tr>
                    <td>Session data (authentication tokens)</td>
                    <td>30 days after session expiry</td>
                  </tr>
                  <tr>
                    <td>Cookie consent records</td>
                    <td>1 year from the date consent is given</td>
                  </tr>
                </tbody>
              </table>
              <p>
                After the applicable retention period expires, data is securely deleted or anonymised so that it can no longer be associated with you.
              </p>

              {/* 9. Your Rights (GDPR) */}
              <h2>9. Your Rights Under the GDPR</h2>
              <p>
                If you are located in the European Economic Area (EEA) or the United Kingdom, you have the following rights under the GDPR:
              </p>
              <ul>
                <li><strong>Right of access:</strong> You have the right to request a copy of the personal data we hold about you.</li>
                <li><strong>Right to rectification:</strong> You have the right to request that we correct any inaccurate or incomplete personal data.</li>
                <li><strong>Right to erasure:</strong> You have the right to request that we delete your personal data, subject to certain legal exceptions.</li>
                <li><strong>Right to data portability:</strong> You have the right to receive your personal data in a structured, commonly used, and machine-readable format and to transmit it to another controller.</li>
                <li><strong>Right to restriction of processing:</strong> You have the right to request that we restrict the processing of your personal data in certain circumstances.</li>
                <li><strong>Right to object:</strong> You have the right to object to the processing of your personal data where we rely on legitimate interests as our legal basis.</li>
              </ul>
              <p>
                To exercise any of these rights, please email us at{" "}
                <a href="mailto:privacy@datasports.co" className="text-blue-600 hover:underline">privacy@datasports.co</a>.
                We will respond to your request within 30 days.
              </p>
              <p>
                You also have the <strong>right to withdraw consent</strong> at any time for any processing based on consent (such as analytics and advertising cookies). You can withdraw cookie consent by clicking &quot;Cookie Settings&quot; in the cookie consent banner or in the Site footer. Withdrawal does not affect the lawfulness of processing carried out before the withdrawal.
              </p>
              <p>
                If you believe that our processing of your personal data infringes the GDPR, you have the <strong>right to lodge a complaint</strong> with a supervisory authority in the EU/EEA Member State of your habitual residence, place of work, or place of the alleged infringement.
              </p>

              {/* 10. Data Security */}
              <h2>10. Data Security</h2>
              <p>
                We use administrative, technical, and physical security measures to protect your personal information. These include encryption of data in transit (TLS/SSL), encryption of data at rest, access controls, and regular security reviews. While we have taken reasonable steps to secure the information you provide, please be aware that no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against interception or misuse.
              </p>

              {/* 11. Children's Privacy */}
              <h2>11. Children&apos;s Privacy</h2>
              <p>
                Our Site is not intended for children under 16 years of age, in accordance with the GDPR&apos;s requirements for children&apos;s consent. We do not knowingly collect personal information from children under 16. If we learn that we have collected personal information from a child under 16, we will take steps to delete that information as promptly as possible. If you believe a child under 16 has provided us with personal data, please contact us at{" "}
                <a href="mailto:privacy@datasports.co" className="text-blue-600 hover:underline">privacy@datasports.co</a>.
              </p>

              {/* 12. Changes to This Privacy Policy */}
              <h2>12. Changes to This Privacy Policy</h2>
              <p>
                We may update our Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors. We will notify you of any material changes by posting the new Privacy Policy on this page and updating the &quot;Last updated&quot; date at the top. For significant changes, we may also notify you by email or through a prominent notice on the Site. We encourage you to review this page periodically.
              </p>

              {/* 13. Contact Us */}
              <h2>13. Contact Us</h2>
              <p>
                If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us at:
              </p>
              <ul>
                <li>
                  Email:{" "}
                  <a href="mailto:privacy@datasports.co" className="text-blue-600 hover:underline">privacy@datasports.co</a>
                </li>
              </ul>

            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

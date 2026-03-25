import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How TaskRight collects, uses, and protects your data. We will never sell your information.',
  alternates: { canonical: 'https://taskright.com/privacy/' },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = 'March 2026';

export default function PrivacyPolicyPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-bg">

        {/* Header */}
        <section className="bg-brand py-14 px-6">
          <div className="max-w-3xl mx-auto">
            <p className="text-blue-200 text-sm font-semibold uppercase tracking-widest mb-3">Legal</p>
            <h1 className="text-4xl font-bold text-white mb-3">Privacy Policy</h1>
            <p className="text-blue-200 text-sm">Last updated: {LAST_UPDATED}</p>
          </div>
        </section>

        {/* Content */}
        <section className="max-w-3xl mx-auto px-6 py-14">
          <div className="bg-white rounded-2xl border border-border p-8 md:p-12 space-y-10 text-text-muted leading-relaxed">

            <div>
              <p>
                TaskRight (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to protecting your privacy.
                This Privacy Policy explains what information we collect, how we use it, and your rights
                regarding that information. By using TaskRight — including our website, mobile application,
                and beta program — you agree to the practices described here.
              </p>
              <p className="mt-4">
                If you have questions at any time, contact us at{' '}
                <a href="mailto:hello@taskright.com" className="text-brand hover:underline">
                  hello@taskright.com
                </a>.
              </p>
            </div>

            <Section title="1. Information We Collect">
              <Subsection title="Information you provide directly">
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong className="text-text">Business account information:</strong> Business name and phone number provided at signup.</li>
                  <li><strong className="text-text">Customer information:</strong> Names, phone numbers, addresses, and service preferences entered by business account holders on behalf of their customers.</li>
                  <li><strong className="text-text">Service data:</strong> Task selections, service cycle configurations, scheduling preferences, team assignments, and service completion records.</li>
                  <li><strong className="text-text">Feedback:</strong> Customer feedback submitted through the app, including text and any attached photos.</li>
                  <li><strong className="text-text">Beta program applications:</strong> Name, email, business type, state, and customer count submitted through our early access form.</li>
                </ul>
              </Subsection>
              <Subsection title="Information collected automatically">
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong className="text-text">Usage data:</strong> Pages visited, features used, and interactions with the app and website — collected through Google Analytics.</li>
                  <li><strong className="text-text">Device information:</strong> Device type, operating system, and app version for diagnostic purposes.</li>
                  <li><strong className="text-text">Log data:</strong> IP address, browser type, and timestamps for security and troubleshooting purposes.</li>
                </ul>
              </Subsection>
            </Section>

            <Section title="2. How We Use Your Information">
              <ul className="list-disc pl-5 space-y-2">
                <li>To provide and operate the TaskRight service — including scheduling, task management, team assignments, and customer communication.</li>
                <li>To send SMS notifications to customers about upcoming service dates, selection reminders, and confirmations (via Twilio).</li>
                <li>To process and review beta program applications.</li>
                <li>To improve the product based on usage patterns and user feedback.</li>
                <li>To communicate product updates, changes, and important service notices.</li>
                <li>To ensure the security and integrity of the platform.</li>
              </ul>
            </Section>

            <Section title="3. How We Share Your Information">
              <p>
                We do not sell, rent, or trade your personal information to third parties.
                We share data only in the following limited circumstances:
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-4">
                <li><strong className="text-text">Service providers:</strong> We use trusted third-party services to operate TaskRight, including Twilio (SMS delivery) and Google Analytics (usage analytics). These providers process data only as necessary to deliver their services and are contractually prohibited from using it for other purposes.</li>
                <li><strong className="text-text">Legal requirements:</strong> We may disclose information if required by law or in response to valid legal process (e.g., court order or subpoena).</li>
                <li><strong className="text-text">Business transfers:</strong> If TaskRight is acquired or merges with another company, your data may be transferred as part of that transaction. We will notify you before your data is subject to a different privacy policy.</li>
              </ul>
            </Section>

            <Section title="4. Data Retention">
              <p>
                We retain your data for as long as your account is active or as needed to provide the service.
                If you request account deletion, we will remove your personal information within 30 days,
                except where retention is required by law or for legitimate business purposes (e.g., resolving disputes).
              </p>
              <p className="mt-4">
                <strong className="text-text">Beta program note:</strong> During the beta period, data may be reset,
                migrated, or removed as we develop and improve the platform. We will provide reasonable advance
                notice before any such action.
              </p>
            </Section>

            <Section title="5. Data Security">
              <p>
                We use industry-standard security measures to protect your data, including encrypted data
                transmission (HTTPS), secure database storage, and access controls that limit who within
                our team can view your information.
              </p>
              <p className="mt-4">
                No method of transmission or storage is 100% secure. While we take the protection of
                your data seriously, we cannot guarantee absolute security. If we become aware of a
                security breach affecting your data, we will notify you promptly.
              </p>
            </Section>

            <Section title="6. SMS Communications">
              <p>
                By adding a customer to TaskRight with their phone number, business account holders confirm
                they have obtained appropriate consent from that customer to receive SMS notifications
                related to their service appointments. Customers may opt out of SMS notifications at any
                time by replying STOP to any message.
              </p>
              <p className="mt-4">
                Standard message and data rates may apply. Message frequency varies based on service schedule.
              </p>
            </Section>

            <Section title="7. Your Rights">
              <ul className="list-disc pl-5 space-y-2">
                <li><strong className="text-text">Access:</strong> You may request a copy of the personal information we hold about you.</li>
                <li><strong className="text-text">Correction:</strong> You may request that we correct inaccurate or incomplete information.</li>
                <li><strong className="text-text">Deletion:</strong> You may request deletion of your account and associated data.</li>
                <li><strong className="text-text">Opt-out:</strong> You may opt out of marketing communications at any time by contacting us or using the unsubscribe link in any email.</li>
              </ul>
              <p className="mt-4">
                To exercise any of these rights, contact us at{' '}
                <a href="mailto:hello@taskright.com" className="text-brand hover:underline">hello@taskright.com</a>.
                We will respond within 30 days.
              </p>
            </Section>

            <Section title="8. Children's Privacy">
              <p>
                TaskRight is not directed at children under 13. We do not knowingly collect personal
                information from anyone under 13 years of age. If you believe we have inadvertently
                collected such information, contact us and we will delete it promptly.
              </p>
            </Section>

            <Section title="9. Changes to This Policy">
              <p>
                We may update this Privacy Policy from time to time. When we do, we will update the
                &quot;Last updated&quot; date at the top of this page. If changes are material, we will
                notify active users by email or in-app notice. Continued use of TaskRight after changes
                are posted constitutes acceptance of the updated policy.
              </p>
            </Section>

            <Section title="10. Contact Us">
              <p>
                Questions, concerns, or requests regarding this Privacy Policy can be directed to:
              </p>
              <div className="mt-4 bg-bg rounded-xl p-5 text-sm">
                <p className="font-semibold text-text">TaskRight</p>
                <p className="mt-1">
                  <a href="mailto:hello@taskright.com" className="text-brand hover:underline">
                    hello@taskright.com
                  </a>
                </p>
              </div>
            </Section>

          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-text mb-4">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="text-base font-semibold text-text mb-2">{title}</h3>
      {children}
    </div>
  );
}

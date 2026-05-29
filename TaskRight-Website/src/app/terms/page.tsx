import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms and conditions governing your use of TaskRight, including our beta program, service limitations, and acceptable use policy.',
  alternates: { canonical: 'https://taskrightpro.com/terms/' },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = 'March 2026';

export default function TermsOfServicePage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-bg">

        {/* Header */}
        <section className="bg-brand py-14 px-6">
          <div className="max-w-3xl mx-auto">
            <p className="text-blue-200 text-sm font-semibold uppercase tracking-widest mb-3">Legal</p>
            <h1 className="text-4xl font-bold text-white mb-3">Terms of Service</h1>
            <p className="text-blue-200 text-sm">Last updated: {LAST_UPDATED}</p>
          </div>
        </section>

        {/* Content */}
        <section className="max-w-3xl mx-auto px-6 py-14">
          <div className="bg-white rounded-2xl border border-border p-8 md:p-12 space-y-10 text-text-muted leading-relaxed">

            <div>
              <p>
                These Terms of Service (&quot;Terms&quot;) govern your access to and use of TaskRight,
                including our website at taskrightpro.com, our iOS mobile application, and our beta program
                (collectively, the &quot;Service&quot;). By creating an account or using the Service,
                you agree to be bound by these Terms.
              </p>
              <p className="mt-4">
                If you do not agree to these Terms, do not use the Service. If you have questions,
                contact us at{' '}
                <a href="mailto:support@taskrightpro.com" className="text-brand hover:underline">
                  support@taskrightpro.com
                </a>.
              </p>
            </div>

            <Section title="1. Beta Program">
              <p>
                TaskRight is currently in beta. By participating, you acknowledge and accept the following:
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-4">
                <li>The Service is provided &quot;as is&quot; during the beta period. Features may be incomplete, changed, or removed without notice.</li>
                <li>Data — including customer records, service cycles, and selections — may be reset, migrated, or lost during the beta period. We will make reasonable efforts to notify you in advance of any data-affecting changes.</li>
                <li>Beta access is free. Pricing for public availability will be announced before the general launch. Founding beta members will receive advance notice and preferential pricing.</li>
                <li>We may discontinue the beta program or the Service at any time with reasonable notice.</li>
              </ul>
            </Section>

            <Section title="2. Eligibility and Accounts">
              <ul className="list-disc pl-5 space-y-2">
                <li>You must be at least 18 years old and legally capable of entering into a binding contract to use the Service.</li>
                <li>You are responsible for maintaining the security of your account credentials. Notify us immediately at support@taskrightpro.com if you suspect unauthorized access.</li>
                <li>One business account per business entity. You may not create accounts on behalf of others without their express authorization.</li>
                <li>We reserve the right to suspend or terminate accounts that violate these Terms.</li>
              </ul>
            </Section>

            <Section title="3. Acceptable Use">
              <p>You agree to use the Service only for its intended purpose — managing service business operations, customer communication, and scheduling. You may not:</p>
              <ul className="list-disc pl-5 space-y-2 mt-4">
                <li>Use the Service for any unlawful purpose or in violation of any applicable law or regulation.</li>
                <li>Add customer information to TaskRight without appropriate authorization or consent from those customers.</li>
                <li>Send unsolicited or harassing communications through any Service feature.</li>
                <li>Attempt to gain unauthorized access to any part of the Service or its underlying systems.</li>
                <li>Reverse engineer, decompile, or otherwise attempt to extract the source code of the Service.</li>
                <li>Use the Service to compete with TaskRight or to build a similar product.</li>
              </ul>
            </Section>

            <Section title="4. Customer Data Responsibility">
              <p>
                Business account holders are responsible for the customer data they enter into TaskRight.
                By adding a customer&apos;s information, you represent that:
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-4">
                <li>You have a legitimate business relationship with that customer.</li>
                <li>You have obtained any necessary consent to collect and process their information, including consent to receive SMS notifications related to their service appointments.</li>
                <li>The information you enter is accurate to the best of your knowledge.</li>
              </ul>
              <p className="mt-4">
                TaskRight is a tool to help you manage your business relationships — we are not responsible
                for how you communicate with your customers or the quality of services you provide.
              </p>
            </Section>

            <Section title="5. SMS Notifications">
              <p>
                TaskRight uses Twilio to deliver SMS notifications to customers on behalf of business
                account holders. By using the SMS notification feature, you and your customers agree that:
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-4">
                <li>Messages are sent for service-related purposes only (reminders, confirmations, scheduling).</li>
                <li>Customers may opt out at any time by replying STOP to any message.</li>
                <li>Standard message and data rates may apply to message recipients.</li>
                <li>We are not responsible for SMS delivery failures caused by carrier restrictions or recipient device settings.</li>
              </ul>
            </Section>

            <Section title="6. Intellectual Property">
              <p>
                TaskRight and all associated content, features, and functionality — including the software,
                design, logos, and text — are owned by TaskRight and protected by applicable intellectual
                property laws.
              </p>
              <p className="mt-4">
                You retain ownership of all customer data and business data you enter into the Service.
                By using the Service, you grant TaskRight a limited license to store, process, and
                display that data solely to provide the Service to you.
              </p>
            </Section>

            <Section title="7. Disclaimers and Limitation of Liability">
              <p>
                <strong className="text-text">THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot;
                WITHOUT WARRANTIES OF ANY KIND,</strong> either express or implied, including but not limited to
                warranties of merchantability, fitness for a particular purpose, or non-infringement.
              </p>
              <p className="mt-4">
                To the maximum extent permitted by law, TaskRight shall not be liable for any indirect,
                incidental, special, consequential, or punitive damages — including loss of data, revenue,
                or business — arising out of your use of or inability to use the Service, even if we have
                been advised of the possibility of such damages.
              </p>
              <p className="mt-4">
                Our total liability to you for any claim arising from these Terms or your use of the
                Service shall not exceed the greater of $100 or the amount you paid us in the 12 months
                preceding the claim.
              </p>
            </Section>

            <Section title="8. Age Requirement">
              <p>
                TaskRight is a business management tool intended exclusively for adults. You must be
                at least 18 years old to create an account or use the Service. We do not knowingly
                collect information from anyone under 18. If we become aware that a user is under 18,
                we will terminate their account and delete their data promptly. If you believe we have
                inadvertently collected information from someone under 18, contact us at{' '}
                <a href="mailto:support@taskrightpro.com" className="text-brand hover:underline">
                  support@taskrightpro.com
                </a>{' '}
                and we will address it immediately.
              </p>
            </Section>

            <Section title="9. Indemnification">
              <p>
                You agree to defend, indemnify, and hold harmless TaskRight and its team members from
                any claims, damages, liabilities, and expenses (including reasonable legal fees) arising
                from your use of the Service, your violation of these Terms, or your violation of any
                third-party rights, including your customers&apos; rights.
              </p>
            </Section>

            <Section title="10. Termination">
              <p>
                Either party may terminate your account at any time. You may delete your account by
                contacting us at support@taskrightpro.com. We may suspend or terminate your access if you
                violate these Terms, with or without prior notice depending on the severity of the
                violation.
              </p>
              <p className="mt-4">
                Upon termination, your right to access the Service ceases immediately. We will retain
                your data for up to 30 days after termination to allow for any final data exports you
                may request, after which it will be deleted per our Privacy Policy.
              </p>
            </Section>

            <Section title="11. Changes to These Terms">
              <p>
                We may update these Terms from time to time. Material changes will be communicated to
                active users via email or in-app notice at least 14 days before they take effect.
                Continued use of the Service after changes are effective constitutes acceptance of the
                updated Terms.
              </p>
            </Section>

            <Section title="12. Governing Law">
              <p>
                These Terms are governed by the laws of the United States. Any disputes arising from
                these Terms or your use of the Service shall be resolved through good-faith negotiation
                first. If unresolved, disputes shall be submitted to binding arbitration rather than
                litigation, except where prohibited by law.
              </p>
            </Section>

            <Section title="13. Contact">
              <p>
                Questions about these Terms should be directed to:
              </p>
              <div className="mt-4 bg-bg rounded-xl p-5 text-sm">
                <p className="font-semibold text-text">TaskRight</p>
                <p className="mt-1">
                  <a href="mailto:support@taskrightpro.com" className="text-brand hover:underline">
                    support@taskrightpro.com
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

// ─── Layout helper ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-text mb-4">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import DemoTabs from '@/components/DemoTabs';

export const metadata: Metadata = {
  title: 'Demo — See TaskRight in Action',
  description: 'Watch full walkthroughs of TaskRight — dashboard, customer management, service and task setup, and team dispatch. Built for small service businesses.',
  alternates: { canonical: 'https://taskrightpro.com/demo/' },
  openGraph: {
    title: 'TaskRight Demo — Full App Walkthrough',
    description: 'See every part of TaskRight working — dashboard, customers, services, and team management.',
    url: 'https://taskrightpro.com/demo/',
  },
};

export default function DemoPage() {
  return (
    <>
      <Navbar />
      <main>

        {/* Header */}
        <section className="bg-brand py-20 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl font-bold text-white mb-4">
              See how TaskRight works
            </h1>
            <p className="text-white/75 text-lg leading-relaxed max-w-xl mx-auto">
              Walkthroughs for every role — business owner, team member, and customer.
              Recorded live, no staging.
            </p>
          </div>
        </section>

        {/* Tabbed demos */}
        <section className="bg-bg py-16 px-6">
          <div className="max-w-3xl mx-auto">
            <DemoTabs />
          </div>
        </section>

        {/* CTA */}
        <section className="bg-text py-16 px-6">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-white mb-3">
              Ready to get started?
            </h2>
            <p className="text-white/60 text-base mb-8 leading-relaxed">
              Early access spots are limited. Reserve yours and we&apos;ll reach out personally when your account is ready.
            </p>
            <Link
              href="/signup"
              className="inline-block bg-orange-600 hover:bg-orange-700 text-white font-semibold px-8 py-3.5 rounded-lg transition-colors text-base"
            >
              Get TaskRight
            </Link>
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}

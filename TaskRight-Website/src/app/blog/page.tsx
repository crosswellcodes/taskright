import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getAllPosts, formatDate } from '@/lib/blog';

export const metadata: Metadata = {
  title: 'Blog — Service Business Tips & Tools',
  description: 'Practical guides for cleaning, lawn care, and home service business owners. Customer communication, retention strategies, and affordable software tips.',
  alternates: { canonical: 'https://taskrightpro.com/blog/' },
  openGraph: {
    title: 'TaskRight Blog — Service Business Tips & Tools',
    description: 'Practical guides for small service business owners on customer communication, retention, and management.',
    url: 'https://taskrightpro.com/blog/',
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  'Customer Communication': 'bg-blue-50 text-blue-700',
  'Customer Management':    'bg-indigo-50 text-indigo-700',
  'Customer Retention':     'bg-emerald-50 text-emerald-700',
  'Software & Tools':       'bg-amber-50 text-amber-700',
};

export default function BlogHubPage() {
  const posts = getAllPosts(true); // only published posts

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-bg">

        {/* Hero */}
        <section className="bg-brand py-16 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-blue-200 text-sm font-semibold uppercase tracking-widest mb-3">
              TaskRight Blog
            </p>
            <h1 className="text-4xl font-bold text-white mb-4">
              Service Business Tips &amp; Tools
            </h1>
            <p className="text-blue-100 text-lg leading-relaxed">
              Practical guides for cleaning, lawn care, and home service business owners
              who want better customer relationships — without enterprise complexity.
            </p>
          </div>
        </section>

        {/* Post grid */}
        <section className="max-w-5xl mx-auto px-6 py-16">
          {posts.length === 0 ? (
            /* Coming soon state — shown until first post is published */
            <div className="text-center py-24">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl">✍️</span>
              </div>
              <h2 className="text-2xl font-bold text-text mb-3">Posts Coming Soon</h2>
              <p className="text-text-muted max-w-md mx-auto mb-8">
                We&apos;re writing practical guides for service business owners.
                The first post drops soon — apply for early access to get notified.
              </p>
              <a
                href="/#early-access"
                className="inline-block bg-brand hover:bg-brand-dark text-white font-semibold px-6 py-3 rounded-lg transition-colors"
              >
                Apply for Beta Access
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {posts.map(post => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}/`}
                  className="group bg-white rounded-2xl border border-border p-6 hover:shadow-md hover:border-brand/30 transition-all"
                >
                  {/* Category pill */}
                  <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full mb-4 ${CATEGORY_COLORS[post.category] ?? 'bg-gray-100 text-gray-600'}`}>
                    {post.category}
                  </span>

                  <h2 className="text-lg font-bold text-text mb-2 group-hover:text-brand transition-colors leading-snug">
                    {post.title}
                  </h2>

                  <p className="text-text-muted text-sm leading-relaxed mb-4">
                    {post.excerpt}
                  </p>

                  <div className="flex items-center justify-between text-xs text-text-muted pt-4 border-t border-border">
                    <span>{formatDate(post.date)}</span>
                    <span>{post.readingTime}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* CTA strip */}
        <section className="bg-white border-t border-border py-16 px-6">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-text mb-3">
              Get Early Access to TaskRight
            </h2>
            <p className="text-text-muted mb-6">
              Join service business owners who are shaping the product.
              Free forever for founding members.
            </p>
            <a
              href="/#early-access"
              className="inline-block bg-brand hover:bg-brand-dark text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              Apply for Early Access
            </a>
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}

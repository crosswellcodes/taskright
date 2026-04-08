import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getAllPosts, getPostBySlug, formatDate } from '@/lib/blog';

// ─── Static params — pre-renders all post routes at build time ───────────────
export function generateStaticParams() {
  return getAllPosts(false).map(post => ({ slug: post.slug }));
}

// ─── Per-page metadata ───────────────────────────────────────────────────────
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `https://taskrightpro.com/blog/${post.slug}/` },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `https://taskrightpro.com/blog/${post.slug}/`,
      type: 'article',
      publishedTime: post.date,
    },
  };
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default async function BlogPostPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) notFound();

  // All other published posts for the "Related" section (exclude current)
  const related = getAllPosts(true).filter(p => p.slug !== post.slug).slice(0, 2);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-bg">

        {/* Post hero */}
        <section className="bg-brand py-14 px-6">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-5">
              <Link
                href="/blog/"
                className="text-blue-200 hover:text-white text-sm transition-colors"
              >
                ← Blog
              </Link>
              <span className="text-blue-300 text-sm">·</span>
              <span className="text-blue-200 text-sm">{post.category}</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-5">
              {post.title}
            </h1>
            <div className="flex items-center gap-4 text-blue-200 text-sm">
              <span>{formatDate(post.date)}</span>
              <span>·</span>
              <span>{post.readingTime}</span>
              <span>·</span>
              <span>By TaskRight Team</span>
            </div>
          </div>
        </section>

        {/* Post body + sidebar */}
        <section className="max-w-5xl mx-auto px-6 py-14">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

            {/* Article body */}
            <article className="lg:col-span-2">
              <div className="bg-white rounded-2xl border border-border p-8 prose prose-blue max-w-none
                              prose-headings:text-text prose-p:text-text-muted prose-p:leading-relaxed
                              prose-a:text-brand prose-a:no-underline hover:prose-a:underline
                              prose-strong:text-text prose-li:text-text-muted">
                {/* Post content — replace post.content with MDX/components when real post lands */}
                {post.content.split('\n').map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>

              {/* Inline CTA */}
              <div className="mt-10 bg-brand/5 border border-brand/20 rounded-2xl p-8 text-center">
                <h3 className="text-xl font-bold text-text mb-2">
                  Ready to simplify your service business?
                </h3>
                <p className="text-text-muted mb-5 text-sm">
                  TaskRight is built for exactly this. Apply for free early access — no credit card required.
                </p>
                <a
                  href="/#early-access"
                  className="inline-block bg-brand hover:bg-brand-dark text-white font-semibold px-6 py-3 rounded-lg transition-colors"
                >
                  Apply for Free Beta Access
                </a>
              </div>
            </article>

            {/* Sidebar */}
            <aside className="space-y-6">

              {/* About TaskRight */}
              <div className="bg-white rounded-2xl border border-border p-6">
                <h3 className="font-bold text-text mb-2">About TaskRight</h3>
                <p className="text-text-muted text-sm leading-relaxed mb-4">
                  TaskRight is a service management app built for small cleaning, lawn care,
                  and home service businesses. We&apos;re in beta — founding members get free access forever.
                </p>
                <a
                  href="/#early-access"
                  className="block text-center bg-brand hover:bg-brand-dark text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
                >
                  Apply for Beta Access
                </a>
              </div>

              {/* Related posts */}
              {related.length > 0 && (
                <div className="bg-white rounded-2xl border border-border p-6">
                  <h3 className="font-bold text-text mb-4">Related Posts</h3>
                  <div className="space-y-4">
                    {related.map(r => (
                      <Link
                        key={r.slug}
                        href={`/blog/${r.slug}/`}
                        className="block group"
                      >
                        <p className="text-sm font-medium text-text group-hover:text-brand transition-colors leading-snug">
                          {r.title}
                        </p>
                        <p className="text-xs text-text-muted mt-1">{r.readingTime}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Back to blog */}
              <Link
                href="/blog/"
                className="block text-center text-brand hover:text-brand-dark text-sm font-medium transition-colors"
              >
                ← View all posts
              </Link>

            </aside>
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}

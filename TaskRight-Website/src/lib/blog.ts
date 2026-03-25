// ─── Blog Post Data Layer ────────────────────────────────────────────────────
//
// Add new posts to the POSTS array below.
// Each post needs: slug, title, description, date, readingTime, category,
//                  excerpt, and content (MDX-style markdown string or JSX).
//
// The slug must exactly match the URL: /blog/[slug]/
// When a real post is ready, replace the placeholder content field.

export type BlogPost = {
  slug: string;
  title: string;
  description: string; // Used for <meta description> — keep under 160 chars
  date: string;        // ISO format: YYYY-MM-DD
  readingTime: string; // e.g. "6 min read"
  category: string;    // e.g. "Customer Communication"
  excerpt: string;     // 1–2 sentences shown on hub page cards
  published: boolean;  // false = route exists but won't appear in hub listing
  content: string;     // Full post body — plain text placeholder until real content added
};

export const POSTS: BlogPost[] = [
  {
    slug: 'why-service-businesses-struggle-customer-communication',
    title: 'Why Service Businesses Struggle with Customer Communication (And How to Fix It)',
    description: 'Poor customer communication is the #1 reason small service businesses lose clients. Learn the common pitfalls and practical fixes for cleaning, lawn care, and home service businesses.',
    date: '2026-04-01',
    readingTime: '6 min read',
    category: 'Customer Communication',
    excerpt: 'Most small service businesses lose customers not because of bad work — but because of bad communication. Here\'s how to fix it.',
    published: false,
    content: `This post is coming soon. Check back after launch for the full article.`,
  },
  {
    slug: 'complete-guide-managing-customer-preferences',
    title: 'The Complete Guide to Managing Customer Preferences for Service Businesses',
    description: 'A step-by-step guide to capturing and managing customer preferences for cleaning, lawn care, and home service businesses — without spreadsheets or group chats.',
    date: '2026-04-08',
    readingTime: '7 min read',
    category: 'Customer Management',
    excerpt: 'Your customers have preferences — specific tasks, access instructions, pet notes. Here\'s a system for capturing and acting on all of it.',
    published: false,
    content: `This post is coming soon. Check back after launch for the full article.`,
  },
  {
    slug: 'how-to-stop-losing-customers-service-business',
    title: 'How to Stop Losing Customers in Your Service Business',
    description: 'Customer churn is expensive. Learn the practical strategies small cleaning and lawn care businesses use to retain customers and build loyalty without a big budget.',
    date: '2026-04-15',
    readingTime: '6 min read',
    category: 'Customer Retention',
    excerpt: 'Acquiring a new customer costs 5x more than keeping one. Here are the retention strategies that actually work for small service businesses.',
    published: false,
    content: `This post is coming soon. Check back after launch for the full article.`,
  },
  {
    slug: 'why-enterprise-service-software-isnt-built-for-you',
    title: 'Why Enterprise Service Software Isn\'t Built for Small Businesses',
    description: 'Enterprise service management tools are powerful — but they\'re designed for large operations, not small service businesses. Here\'s what to look for instead.',
    date: '2026-04-22',
    readingTime: '5 min read',
    category: 'Software & Tools',
    excerpt: 'Paying $100+/month for software built for a 50-person operation? There\'s a better option for growing service businesses.',
    published: false,
    content: `This post is coming soon. Check back after launch for the full article.`,
  },
  {
    slug: '5-questions-service-business-owner-should-ask-customers',
    title: '5 Questions Every Service Business Owner Should Ask Their Customers',
    description: 'The right questions reveal what your customers actually want — and what keeps them coming back. Here are the 5 most important questions for service business owners.',
    date: '2026-04-29',
    readingTime: '5 min read',
    category: 'Customer Communication',
    excerpt: 'Most service businesses never ask these five questions. The ones that do have dramatically better retention and fewer complaints.',
    published: false,
    content: `This post is coming soon. Check back after launch for the full article.`,
  },
  {
    slug: 'midwest-service-business-customer-retention',
    title: 'Customer Retention for Midwest Service Businesses: What Actually Works',
    description: 'Midwest service businesses face unique challenges around seasonal demand, customer loyalty, and local competition. Here\'s what retention strategies actually work in this market.',
    date: '2026-05-06',
    readingTime: '7 min read',
    category: 'Customer Retention',
    excerpt: 'Midwest service businesses deal with seasonal swings, tight-knit communities, and word-of-mouth culture. Your retention strategy needs to account for all of it.',
    published: false,
    content: `This post is coming soon. Check back after launch for the full article.`,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** All posts sorted newest-first, optionally filtered to published only */
export function getAllPosts(publishedOnly = true): BlogPost[] {
  return POSTS
    .filter(p => !publishedOnly || p.published)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/** Single post by slug — returns undefined if not found */
export function getPostBySlug(slug: string): BlogPost | undefined {
  return POSTS.find(p => p.slug === slug);
}

/** Format a YYYY-MM-DD date string for display */
export function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

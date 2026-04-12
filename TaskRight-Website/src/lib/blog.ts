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
    date: '2026-04-11',
    readingTime: '6 min read',
    category: 'Customer Communication',
    excerpt: 'Most small service businesses lose customers not because of bad work — but because of bad communication. Here\'s how to fix it.',
    published: true,
    content: `
<p>Running a service business means managing relationships at scale — and most owners do it without a system.</p>

<p>A study published in the <em>Journal of Strategy and Management</em> found that while 75% of business owners recognize digital communication tools as an opportunity, over 41% haven't adopted any. That gap between knowing and doing is where most communication problems begin.</p>

<p>For cleaning companies, lawn care operators, and home service businesses, the consequences aren't abstract. They show up as customers who quietly cancel, complaints that could have been prevented, and repeat mistakes that erode trust one visit at a time.</p>

<h2>Communication Is the Product</h2>

<p>Most service business owners think of communication as administrative — the texts confirming appointments, the voicemails when something changes, the follow-up after a complaint. It feels like overhead.</p>

<p>Research suggests otherwise. Communication generates value for a business, and at the same time, it is value in itself. For service businesses, this is particularly true. The service itself — the cleaned home, the mowed lawn — is almost expected. What differentiates providers is how they make customers feel throughout the relationship. That feeling is built through communication.</p>

<p>When communication breaks down, customers don't always say something. They just stop booking.</p>

<h2>Where It Goes Wrong</h2>

<p>The most common communication failures in service businesses aren't dramatic. They're quiet and cumulative.</p>

<p>A customer mentions early on that they keep cleaning products under the sink and prefer they not be moved. That note lives in a text thread. Six months later, a new team member handles the job. The products get moved. The customer says nothing — but they start looking for alternatives.</p>

<p>A lawn care client requests that the back gate always be closed after service. It's mentioned verbally at the start of the season. By midsummer, it's been forgotten. The customer's dog gets out. The relationship ends.</p>

<p>These aren't service failures. They're communication failures — specifically, failures to capture, store, and act on the information customers share.</p>

<h2>The Scale Problem</h2>

<p>Early in a service business, communication is manageable. Owners know their customers personally, remember their preferences, and handle problems directly. At 10 or 15 customers, informal systems work.</p>

<p>At 40 or 50 customers, they don't. Customer needs shift over time, and what worked when the business was small — keeping notes in a phone, relying on memory — creates real operational risk as the roster grows. The information exists. Customers share it. The problem is that it's scattered across text messages, handwritten notes, and verbal conversations that no one recorded.</p>

<h2>The Tool Adoption Gap</h2>

<p>The same research that identified the 41% adoption gap also identified why it persists: financial constraints, cultural resistance to change, and a lack of structured planning. For small service businesses, there's an additional barrier — most tools aren't built for them.</p>

<p>Enterprise service management platforms carry enterprise price tags and enterprise complexity. Spreadsheets require manual upkeep that doesn't scale. Group chats are searchable, barely. So owners default to memory and hope, which works until it doesn't.</p>

<h2>What a Working System Looks Like</h2>

<p>The businesses that handle customer communication well tend to do a few things consistently.</p>

<p>They capture preferences at the start of the relationship — not just contact information, but the operational details that affect every visit. Access instructions. Products to avoid. Scheduling sensitivities. Notes about pets, security systems, or anything that affects how the job gets done.</p>

<p>They make that information available to anyone doing the work. A team member handling a route for the first time should have the same customer context as the owner.</p>

<p>They communicate proactively. Customers who receive a confirmation before service and a note after report fewer issues and stay longer. The communication itself signals that the business is organized and attentive.</p>

<p>And they close the loop after problems. A customer whose complaint is handled quickly and professionally is often more loyal than one who never had a problem at all.</p>

<h2>The Underlying Principle</h2>

<p>Effective customer communication isn't complicated. It requires a deep understanding of each customer — knowing that the client in unit 4B keeps a spare key under the mat, that the family on the corner has a dog that barks but doesn't bite, that the customer who books every two weeks actually prefers three. That knowledge, consistently captured and acted on, is what turns a service transaction into a customer relationship.</p>

<p>The challenge isn't understanding this. The challenge is building the habit and the infrastructure to do it at scale, across a team, week after week.</p>

<p>Service businesses that solve that problem retain more customers, generate more referrals, and spend less time managing complaints. The ones that don't tend to keep losing customers to competitors who did.</p>

<p>It doesn't require a large investment or an enterprise software suite. It requires a system — and the discipline to use it.</p>
    `.trim(),
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

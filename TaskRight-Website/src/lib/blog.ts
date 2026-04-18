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
    date: '2026-04-18',
    readingTime: '5 min read',
    category: 'Software & Tools',
    excerpt: 'Enterprise service platforms solve real problems — just not the ones a small service business actually has. Here\'s why the wrong tool costs more than the right one.',
    published: true,
    content: `
<p>Enterprise service management software exists for a reason. For a company managing hundreds of technicians across multiple regions, coordinating complex dispatch schedules, and generating executive-level reporting, these platforms solve real, expensive problems. Tools in this category were built to handle operational complexity at a scale where the investment makes sense.</p>

<p>For a cleaning company with 30 customers or a lawn care operator serving a single zip code, that same software creates more problems than it solves.</p>

<h2>What Enterprise Software Is Actually Designed For</h2>

<p>Enterprise service platforms are engineered around the challenges of large organizations: routing optimization across dozens of vehicles, invoicing at volume, multi-location team coordination, integration with ERP systems, and compliance reporting for stakeholders who will never touch a mop or mow a lawn.</p>

<p>The feature sets reflect this. Advanced workforce management modules, dynamic scheduling algorithms, customer portals with SLA tracking, API integrations with third-party platforms — these are solutions to problems a 15-customer service business simply doesn't have yet.</p>

<p>The pricing reflects it too. Enterprise-level tools carry enterprise-level price structures, often including implementation fees, per-user licensing, and mandatory onboarding packages. For a business where the owner is also the primary technician, that overhead doesn't make financial sense.</p>

<h2>The Complexity Gap</h2>

<p>Beyond cost, there's a practical problem that rarely gets discussed: enterprise software requires dedicated capacity to manage.</p>

<p>Large organizations absorb this through IT departments, operations managers, and software administrators whose job is to configure, maintain, and train staff on these systems. When a field service company with 200 employees rolls out a new platform, there's infrastructure in place to support the transition.</p>

<p>Small service businesses don't have that. The owner is managing customer relationships, handling scheduling, doing the work, and running the business simultaneously. A platform that requires weeks of configuration and ongoing administration isn't a productivity tool — it's another job.</p>

<p>Research on digital tool adoption has consistently found that complexity is one of the primary barriers preventing small businesses from adopting technology that could genuinely help them. The tools that exist are often built for organizations with resources to absorb that complexity. The result is a gap: small businesses either overpay for features they don't use, or default to spreadsheets and text threads that don't scale.</p>

<h2>The Features Small Service Businesses Actually Need</h2>

<p>The operational needs of a 10–75 customer service business are different in kind, not just scale.</p>

<p>What matters at this stage is capturing what customers want and making sure that information is accessible to whoever does the job. It's knowing that the client in unit 4B prefers unscented products, that the back gate needs to be latched, that the dog is friendly but startles easily. It's sending a reminder before service without manually texting every customer. It's collecting feedback after a visit so problems surface before a customer quietly cancels.</p>

<p>None of that requires a routing algorithm or an executive dashboard. It requires a focused tool built around the actual workflow of a small service operation.</p>

<h2>The Build-or-Buy Problem</h2>

<p>Some business owners try to solve this with a combination of free tools — a spreadsheet for customer notes, a group chat for team communication, a calendar for scheduling. This works until it doesn't. As the customer list grows and team members change, the information scattered across these systems becomes a liability rather than an asset.</p>

<p>The choice isn't really between enterprise software and doing nothing. It's between tools built for the scale and complexity of your operation versus tools built for someone else's.</p>

<h2>What to Look For Instead</h2>

<p>For small service businesses evaluating software, a few questions cut through the noise quickly: Does this tool require weeks to set up? Does it charge per user in a way that penalizes a small team? Does it include features you won't use for years, and are you paying for them now?</p>

<p>The right tool for a growing service business is one that handles the core operational needs — customer preferences, communication, scheduling, feedback — without requiring the overhead of an enterprise implementation. It should work on day one and grow with the business, not require the business to grow into it.</p>

<p>That's the gap TaskRight was built to fill. Not a scaled-down version of an enterprise platform, and not a workaround built from spreadsheets — just the tools a small service business actually needs to keep customers informed, organized, and coming back. Nothing more, nothing charged for less.</p>
    `.trim(),
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

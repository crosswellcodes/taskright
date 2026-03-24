import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://taskright.com"),
  // 53 chars — fits Google SERP display without truncation
  title: "TaskRight — Service Management App for Small Business",
  description:
    "TaskRight is the affordable customer communication tool for small cleaning and lawn care businesses. Capture preferences, send reminders, collect feedback. Apply for free beta access.",
  alternates: {
    canonical: "https://taskright.com/",
  },
  // Keywords: Tier 1–3 from SEO Action Plan (Google ignores but documents target keywords)
  keywords: [
    "service management app for small business",
    "customer preference management cleaning business",
    "how to manage customer preferences service business",
    "customer communication tool lawn care business",
    "how to reduce customer churn cleaning business",
    "affordable alternative to service management software",
    "simple service management app",
    "service management software for small business under 50",
  ],
  openGraph: {
    title: "TaskRight — Service Management App for Small Business",
    description:
      "Affordable service management software for growing cleaning and lawn care businesses. Manage customer preferences, send reminders, collect feedback.",
    url: "https://taskright.com/",
    siteName: "TaskRight",
    type: "website",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "TaskRight service management app interface showing customer preferences and scheduling",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TaskRight — Service Management App for Small Business",
    description:
      "Affordable service management software for growing cleaning and lawn care businesses.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

// ─── JSON-LD Schemas ────────────────────────────────────────────────────────

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "TaskRight",
  url: "https://taskright.com",
  logo: "https://taskright.com/logo.png",
  description:
    "Affordable service management software for small cleaning, lawn care, and home service businesses.",
  foundingDate: "2024",
  areaServed: {
    "@type": "AdministrativeArea",
    name: "Midwest United States",
  },
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: "hello@taskright.com",
  },
  sameAs: [],
};

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "TaskRight",
  url: "https://taskright.com",
  description:
    "Service management app built for small cleaning, lawn care, and home service businesses in the Midwest. Manage customer preferences, automate reminders, collect feedback.",
  priceRange: "$$",
  areaServed: [
    { "@type": "State", name: "Illinois" },
    { "@type": "State", name: "Indiana" },
    { "@type": "State", name: "Iowa" },
    { "@type": "State", name: "Kansas" },
    { "@type": "State", name: "Michigan" },
    { "@type": "State", name: "Minnesota" },
    { "@type": "State", name: "Missouri" },
    { "@type": "State", name: "Nebraska" },
    { "@type": "State", name: "Ohio" },
    { "@type": "State", name: "Wisconsin" },
  ],
  knowsAbout: [
    "Service Business Management",
    "Customer Communication",
    "Task Management",
    "Customer Preference Management",
    "Service Scheduling",
  ],
};

const faqPageSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How much does TaskRight cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Early access members get free forever access. Once we launch publicly, pricing will start at $29–99/month depending on business size. Beta participants lock in their free tier — no expiration, no credit card required.",
      },
    },
    {
      "@type": "Question",
      name: "Is TaskRight better than enterprise service tools?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Enterprise service tools are built for large operations — complex scheduling, routing, invoicing, and team management at $99–$199/month. TaskRight is built for something different: helping small service businesses manage customer communication and retention without the enterprise price tag or complexity. If you have 10–75 customers and need smarter communication, TaskRight is designed for you.",
      },
    },
    {
      "@type": "Question",
      name: "What about data security?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Data privacy and security are a priority in our build. Beta testers will be notified of all security features and data handling practices before launch. We will never sell your customer data.",
      },
    },
    {
      "@type": "Question",
      name: "Can I use TaskRight for my type of service business?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "TaskRight works for any service business: cleaning, lawn care, plumbing, electrical, handyman, HVAC, painting, and more. If it involves recurring customer service and scheduled visits, TaskRight works for you.",
      },
    },
    {
      "@type": "Question",
      name: "When is TaskRight launching?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "We're actively building and targeting a public launch in Q3/Q4 2026. Beta testers get first access and will have direct input on the features we prioritize. Apply now to secure your spot.",
      },
    },
  ],
};

/*
 * Phase 2 — BlogPosting schema template (add to individual blog post pages):
 *
 * const blogPostingSchema = {
 *   "@context": "https://schema.org",
 *   "@type": "BlogPosting",
 *   headline: "Blog post title",
 *   description: "Meta description for the post",
 *   image: "https://taskright.com/blog/images/post-featured.jpg",
 *   datePublished: "2026-04-01",
 *   dateModified: "2026-04-01",
 *   author: { "@type": "Person", name: "TaskRight Team" },
 *   publisher: { "@type": "Organization", name: "TaskRight", logo: "https://taskright.com/logo.png" },
 *   mainEntityOfPage: { "@type": "WebPage", "@id": "https://taskright.com/blog/post-slug/" },
 * };
 */

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  const gscVerification = process.env.NEXT_PUBLIC_GSC_VERIFICATION;

  return (
    <html lang="en">
      <head>
        {/* Google Search Console verification */}
        {gscVerification && (
          <meta name="google-site-verification" content={gscVerification} />
        )}

        {/* Google Analytics 4
            Set NEXT_PUBLIC_GA_ID in .env.local (dev) and deployment env (prod)
            Get your GA4 property ID at: https://analytics.google.com */}
        {gaId && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${gaId}', { page_path: window.location.pathname });
                `,
              }}
            />
          </>
        )}

        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageSchema) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

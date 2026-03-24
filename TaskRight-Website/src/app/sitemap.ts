import type { MetadataRoute } from 'next';

// Blog post type — used when Phase 2 blog infrastructure is built
// Each published post should be added to this array
export type BlogPost = {
  slug: string;
  lastModified: Date;
};

// Phase 2: Import blog posts from a data source (e.g. CMS, MDX files) and pass to sitemap()
// Example: import { getAllBlogPosts } from '@/lib/blog';
// const posts: BlogPost[] = await getAllBlogPosts();
const blogPosts: BlogPost[] = [
  // Add blog posts here as they are published:
  // { slug: 'why-service-businesses-struggle-customer-communication', lastModified: new Date('2026-04-01') },
  // { slug: 'how-to-stop-losing-customers-service-business', lastModified: new Date('2026-04-08') },
  // { slug: 'why-enterprise-service-software-isnt-built-for-you', lastModified: new Date('2026-04-15') },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: 'https://taskright.com/',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: 'https://taskright.com/blog/',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
  ];

  // Dynamic blog post entries — populated as posts are published
  const blogPostPages: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `https://taskright.com/blog/${post.slug}/`,
    lastModified: post.lastModified,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  return [...staticPages, ...blogPostPages];
}

import type { MetadataRoute } from 'next';
import { getAllPosts } from '@/lib/blog';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: 'https://taskrightpro.com/',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: 'https://taskrightpro.com/blog/',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
  ];

  // Pulls only published posts from src/lib/blog.ts
  // Set published: true on a post to have it automatically appear here
  const blogPostPages: MetadataRoute.Sitemap = getAllPosts(true).map((post) => ({
    url: `https://taskrightpro.com/blog/${post.slug}/`,
    lastModified: new Date(post.date),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  return [...staticPages, ...blogPostPages];
}

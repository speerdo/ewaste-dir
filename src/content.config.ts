import { glob } from 'astro/loaders';
import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      pubDate: z.date(),
      // Public (/images/...) and remote URLs stay as strings; asset paths use image()
      image: z.union([
        z.string().startsWith('/'),
        z.string().url(),
        image(),
      ]),
      featured: z.boolean().optional(),
      tags: z.array(z.string()).optional(),
      author: z.string().optional(),
    }),
});

export const collections = { blog };

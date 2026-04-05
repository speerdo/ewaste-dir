import { glob } from 'astro/loaders';
import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      pubDate: z.date(),
      image: image(),
      featured: z.boolean().optional(),
      tags: z.array(z.string()).optional(),
      author: z.string().optional(),
    }),
});

export const collections = { blog };

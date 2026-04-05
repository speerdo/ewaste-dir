import type { CollectionEntry } from 'astro:content';

export function getBlogSlug(post: CollectionEntry<'blog'>): string {
  const maybeSlug = (post as CollectionEntry<'blog'> & { slug?: string }).slug;
  const rawSlug = maybeSlug ?? post.id;

  return rawSlug.replace(/\.mdx?$/i, '').replace(/\/index$/i, '');
}

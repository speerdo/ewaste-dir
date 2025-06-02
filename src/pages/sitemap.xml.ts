import { getAllStates, getCitiesByState } from '../lib/supabase';
import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  const states = await getAllStates();

  // Get all blog posts
  const blogPosts = await getCollection('blog');

  let urls = [
    // Add static URLs
    { loc: 'https://www.recycleoldtech.com/' },
    { loc: 'https://www.recycleoldtech.com/about' },
    { loc: 'https://www.recycleoldtech.com/contact' },
    { loc: 'https://www.recycleoldtech.com/privacy' },
    { loc: 'https://www.recycleoldtech.com/thanks' },
    { loc: 'https://www.recycleoldtech.com/blog' },
  ];

  // Add blog post URLs
  for (const post of blogPosts) {
    urls.push({ loc: `https://www.recycleoldtech.com/blog/${post.slug}` });
  }

  // Add dynamic state and city URLs
  for (const state of states) {
    urls.push({ loc: `https://www.recycleoldtech.com/states/${state.id}` });
    const cities = await getCitiesByState(state.id);
    for (const city of cities) {
      urls.push({
        loc: `https://www.recycleoldtech.com/states/${state.id}/${city.id}`,
      });
    }
  }

  // Generate XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${urls.map((url) => `<url><loc>${url.loc}</loc></url>`).join('\n')}
  </urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
};

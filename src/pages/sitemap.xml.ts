import { getAllStates, getCitiesByState } from '../lib/supabase';
import type { APIRoute } from 'astro';

export const get: APIRoute = async () => {
  const states = await getAllStates();
  const today = new Date().toISOString().split('T')[0];

  let urls = [
    // Add static URLs with lastmod dates
    { loc: 'https://www.recycleoldtech.com/', lastmod: today, priority: '1.0' },
    {
      loc: 'https://www.recycleoldtech.com/about',
      lastmod: today,
      priority: '0.8',
    },
    {
      loc: 'https://www.recycleoldtech.com/contact',
      lastmod: today,
      priority: '0.8',
    },
    {
      loc: 'https://www.recycleoldtech.com/privacy',
      lastmod: today,
      priority: '0.6',
    },
    {
      loc: 'https://www.recycleoldtech.com/search',
      lastmod: today,
      priority: '0.8',
    },
    {
      loc: 'https://www.recycleoldtech.com/blog',
      lastmod: today,
      priority: '0.9',
    },
    // Add more static pages as needed
  ];

  // Add dynamic state and city URLs
  for (const state of states) {
    urls.push({
      loc: `https://www.recycleoldtech.com/states/${state.id}`,
      lastmod: today,
      priority: '0.9',
    });

    const cities = await getCitiesByState(state.id);
    for (const city of cities) {
      urls.push({
        loc: `https://www.recycleoldtech.com/states/${state.id}/${city.id}`,
        lastmod: today,
        priority: '0.7',
      });
    }
  }

  // Generate XML with more comprehensive sitemap data
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls
    .map(
      (url) => `
  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${url.priority || '0.5'}</priority>
  </url>`
    )
    .join('')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
};

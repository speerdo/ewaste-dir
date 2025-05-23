import { getAllStates, getCitiesByState } from '../lib/supabase';

export async function get() {
  const states = await getAllStates();
  let urls = [
    // Add static URLs
    { loc: 'https://www.recycleoldtech.com/' },
    { loc: 'https://www.recycleoldtech.com/about' },
    // ...other static pages
  ];

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
}

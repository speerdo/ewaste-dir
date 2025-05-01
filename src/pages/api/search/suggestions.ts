import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get('q')?.toLowerCase() || '';

  if (!query || query.length < 2) {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get unique cities that match the query
    const { data: cities, error } = await supabase
      .from('recycling_centers')
      .select('city, state')
      .ilike('city', `%${query}%`)
      .not('city', 'is', null)
      .not('state', 'is', null);

    if (error) throw error;

    // Create unique city+state combinations with URLs
    const suggestions = cities?.reduce((acc: any[], center) => {
      const key = `${center.city}, ${center.state}`;
      if (!acc.find((item) => item.text === key)) {
        acc.push({
          text: key,
          url: `/states/${center.state.toLowerCase()}/${center.city
            .toLowerCase()
            .replace(/\s+/g, '-')}`,
        });
      }
      return acc;
    }, []);

    // Sort suggestions alphabetically
    suggestions?.sort((a, b) => a.text.localeCompare(b.text));

    return new Response(JSON.stringify(suggestions || []), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Search suggestions error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get suggestions' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

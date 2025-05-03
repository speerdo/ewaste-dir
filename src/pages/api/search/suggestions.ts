import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const GET: APIRoute = async ({ url }): Promise<Response> => {
  const query = url.searchParams.get('q')?.toLowerCase();

  if (!query) {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  try {
    // Get unique cities and states that match the query
    const { data: centers } = await supabase
      .from('recycling_centers')
      .select('city, state')
      .or(`city.ilike.%${query}%,state.ilike.%${query}%`)
      .not('city', 'is', null)
      .not('state', 'is', null);

    if (!centers) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // Get unique combinations
    const uniqueLocations = new Set<string>();
    const suggestions = centers.reduce(
      (acc: Array<{ text: string; url: string }>, center) => {
        const cityKey = `${center.city}, ${center.state}`;
        const stateKey = center.state;

        // Add city suggestion if not already added
        if (
          !uniqueLocations.has(cityKey) &&
          center.city.toLowerCase().includes(query)
        ) {
          uniqueLocations.add(cityKey);
          acc.push({
            text: cityKey,
            url: `/states/${center.state.toLowerCase()}/${center.city
              .toLowerCase()
              .replace(/\s+/g, '-')}`,
          });
        }

        // Add state suggestion if not already added
        if (
          !uniqueLocations.has(stateKey) &&
          center.state.toLowerCase().includes(query)
        ) {
          uniqueLocations.add(stateKey);
          acc.push({
            text: center.state,
            url: `/states/${center.state.toLowerCase()}`,
          });
        }

        return acc;
      },
      []
    );

    // Sort suggestions: exact matches first, then by length
    suggestions.sort((a, b) => {
      const aText = a.text.toLowerCase();
      const bText = b.text.toLowerCase();

      // Exact matches first
      if (aText === query) return -1;
      if (bText === query) return 1;

      // Then by whether it starts with the query
      if (aText.startsWith(query) && !bText.startsWith(query)) return -1;
      if (!aText.startsWith(query) && bText.startsWith(query)) return 1;

      // Then by length
      return aText.length - bText.length;
    });

    return new Response(JSON.stringify(suggestions.slice(0, 10)), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Search error:', error);
    return new Response(JSON.stringify({ error: 'Failed to search' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};

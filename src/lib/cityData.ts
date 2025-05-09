import { supabase, normalizeForUrl } from './supabase';

export interface CityStatePair {
  city: string;
  state: string;
  url: string;
}

let cityDataCache: CityStatePair[] | null = null;

export async function getAllCityStatePairs(): Promise<CityStatePair[]> {
  // Return cached data if available
  if (cityDataCache) {
    return cityDataCache;
  }

  try {
    const { data, error } = await supabase
      .from('recycling_centers')
      .select('city, state')
      .not('city', 'is', null)
      .not('state', 'is', null);

    if (error) {
      console.error(
        'Error fetching city/state pairs from recycling_centers:',
        error
      );
      throw error; // Or return an empty array / handle error as appropriate
    }

    if (!data) {
      cityDataCache = [];
      return [];
    }

    // Create unique pairs and construct the CityStatePair objects
    const uniquePairs = new Map<string, CityStatePair>();
    data.forEach((item) => {
      if (item.city && item.state) {
        // Ensure city and state are not null
        const city = item.city.trim();
        const state = item.state.trim();
        const pairKey = `${city.toLowerCase()}|${state.toLowerCase()}`;

        if (!uniquePairs.has(pairKey)) {
          const stateId = normalizeForUrl(state);
          const cityId = normalizeForUrl(city);
          uniquePairs.set(pairKey, {
            city: city,
            state: state,
            url: `/states/${stateId}/${cityId}`,
          });
        }
      }
    });

    const cityStatePairs = Array.from(uniquePairs.values());

    // Sort for consistency, e.g., by state then by city
    cityStatePairs.sort((a, b) => {
      if (a.state < b.state) return -1;
      if (a.state > b.state) return 1;
      if (a.city < b.city) return -1;
      if (a.city > b.city) return 1;
      return 0;
    });

    // Cache the results
    cityDataCache = cityStatePairs;
    return cityStatePairs;
  } catch (e) {
    console.error('Exception in getAllCityStatePairs:', e);
    // In case of an exception, return empty or previously cached (if any part succeeded)
    return cityDataCache || [];
  }
}

// Cache for search results
const searchCache = new Map<
  string,
  {
    data: Array<{
      text: string;
      type: 'city' | 'zip';
      url?: string;
      zip?: string;
    }>;
    timestamp: number;
  }
>();

const CACHE_DURATION = 1000 * 60 * 5; // 5 minutes

// Function to search through city-state pairs
export function searchLocations(
  query: string,
  cityStatePairs: CityStatePair[]
) {
  query = query.toLowerCase().trim();
  if (!query) return [];

  // Check cache first
  const cacheKey = query;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  // Check if query is a zip code
  const isZipCode = /^\d{5}(-\d{4})?$/.test(query);

  let results;
  if (isZipCode) {
    results = [
      {
        text: `Find recycling centers near ${query}`,
        type: 'zip' as const,
        zip: query,
      },
    ];
  } else {
    // First try exact matches
    const exactMatches = cityStatePairs.filter(({ city, state }) => {
      const cityLower = city.toLowerCase();
      const stateLower = state.toLowerCase();
      return cityLower === query || stateLower === query;
    });

    // Then try partial matches
    const partialMatches = cityStatePairs.filter(({ city, state }) => {
      const cityLower = city.toLowerCase();
      const stateLower = state.toLowerCase();
      return (
        (cityLower.includes(query) || stateLower.includes(query)) &&
        !exactMatches.find((m) => m.city === city && m.state === state)
      );
    });

    // Combine and format results
    results = [...exactMatches, ...partialMatches]
      .slice(0, 8)
      .map(({ city, state, url }) => ({
        text: `${city}, ${state}`,
        url,
        type: 'city' as const,
      }));
  }

  // Cache the results
  searchCache.set(cacheKey, {
    data: results,
    timestamp: Date.now(),
  });

  return results;
}

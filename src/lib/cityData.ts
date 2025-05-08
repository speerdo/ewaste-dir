import { getAllStates, getCitiesByState } from './supabase';

export interface CityStatePair {
  city: string;
  state: string;
  url: string;
  postal_code?: string;
  coordinates?: { lat: number; lng: number };
}

let cityDataCache: CityStatePair[] | null = null;

export async function getAllCityStatePairs(): Promise<CityStatePair[]> {
  // Return cached data if available
  if (cityDataCache) {
    return cityDataCache;
  }

  try {
    // Get all states and their cities
    const states = await getAllStates();
    const cityStatePairs = await Promise.all(
      states.map(async (state) => {
        const cities = await getCitiesByState(state.id);
        return cities.map((city) => ({
          city: city.name,
          state: state.name,
          url: `/states/${state.id}/${city.id}`,
          postal_code: /^\d{5}$/.test(city.id) ? city.id : undefined,
          coordinates:
            city.lat && city.lng
              ? {
                  lat: city.lat,
                  lng: city.lng,
                }
              : undefined,
        }));
      })
    ).then((results) => results.flat());

    // Cache the results
    cityDataCache = cityStatePairs;

    return cityStatePairs;
  } catch (error) {
    console.error('Error loading city data:', error);
    // Return empty array if something goes wrong
    return [];
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
  const zipCode = isZipCode ? query.substring(0, 5) : '';

  let results;
  if (isZipCode) {
    // First check if we have this ZIP code in our data - with more flexible matching
    const cityWithZip = cityStatePairs.find((city) => {
      if (!city.postal_code) return false;

      // Try different postal code formats for comparison
      const cityZip = city.postal_code.toString();
      const queryZip = zipCode.toString();

      return (
        cityZip === queryZip ||
        // Handle leading zeros
        cityZip === queryZip.padStart(5, '0') ||
        // Handle integer conversion
        cityZip === parseInt(queryZip, 10).toString() ||
        parseInt(cityZip, 10) === parseInt(queryZip, 10)
      );
    });

    if (cityWithZip) {
      // We have this ZIP code in our data, add it as a direct match
      results = [
        {
          text: `${cityWithZip.city}, ${cityWithZip.state} (${zipCode})`,
          type: 'city' as const,
          url: cityWithZip.url,
          zip: zipCode,
        },
      ];
    } else {
      // We don't have this ZIP code, still offer it as a search option
      results = [
        {
          text: `Find recycling centers near ${zipCode}`,
          type: 'zip' as const,
          zip: zipCode,
        },
      ];
    }
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

import { getAllStates, getCitiesByState } from './supabase';

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

  // Get all states and their cities
  const states = await getAllStates();
  const cityStatePairs = await Promise.all(
    states.map(async (state) => {
      const cities = await getCitiesByState(state.id);
      return cities.map((city) => ({
        city: city.name,
        state: state.name,
        url: `/states/${state.id}/${city.id}`,
      }));
    })
  ).then((results) => results.flat());

  // Cache the results
  cityDataCache = cityStatePairs;

  return cityStatePairs;
}

// Function to search through city-state pairs
export function searchLocations(
  query: string,
  cityStatePairs: CityStatePair[]
) {
  query = query.toLowerCase().trim();
  if (!query) return [];

  // Check if query is a zip code
  const isZipCode = /^\d{5}(-\d{4})?$/.test(query);

  if (isZipCode) {
    return [
      {
        text: `Find recycling centers near ${query}`,
        type: 'zip' as const,
        zip: query,
      },
    ];
  }

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
  return [...exactMatches, ...partialMatches]
    .slice(0, 8)
    .map(({ city, state, url }) => ({
      text: `${city}, ${state}`,
      url,
      type: 'city' as const,
    }));
}

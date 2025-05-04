import { createClient } from '@supabase/supabase-js';
import type { State, RecyclingCenter, City } from '../types/supabase';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

// Validate Supabase credentials
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase credentials. Make sure PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY are set in your environment variables.'
  );
}

// Initialize Supabase client with retries
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // Don't persist auth state during builds
  },
  global: {
    headers: { 'x-client-info': 'astro-build' },
  },
});

// Verify database connection
export async function verifyConnection() {
  try {
    const { data, error } = await supabase
      .from('states')
      .select('count')
      .limit(1);

    if (error) {
      throw error;
    }
    return true;
  } catch (error) {
    console.error('Failed to connect to Supabase:', error);
    throw new Error(
      'Failed to connect to database. Please check your credentials and try again.'
    );
  }
}

// Enhanced cache configuration
const stateCache = new Map<string, State>();
const cityCache = new Map<string, City[]>();
const recyclingCenterCache = new Map<string, RecyclingCenter[]>();
const centersByCityCache = new Map<string, Record<string, RecyclingCenter[]>>();
const featuredStatesCache = new Map<
  string,
  { data: State[]; timestamp: number }
>();

// Extended cache duration to reduce API calls during build
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes for build process

/**
 * Normalizes a string for use in URLs by:
 * - Converting to lowercase
 * - Replacing non-alphanumeric characters with hyphens
 * - Removing leading/trailing hyphens
 */
export function normalizeForUrl(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// States batch loading for build optimization
let allStatesPromise: Promise<State[]> | null = null;

export async function getAllStates(): Promise<State[]> {
  // Return shared promise to avoid duplicate requests during build
  if (allStatesPromise) {
    return allStatesPromise;
  }

  allStatesPromise = (async () => {
    const cacheKey = 'all-states';

    // Check cache first
    const cached = stateCache.get(cacheKey);
    if (cached) {
      return [cached];
    }

    const { data, error } = await supabase
      .from('states')
      .select('*')
      .order('name');

    if (error) throw error;

    // Convert to State type with proper formatting and cache each state
    const states = (data || []).map((state) => {
      const formattedState = {
        id: normalizeForUrl(state.name),
        name: state.name,
        description:
          state.description ||
          `Find electronics recycling centers in ${state.name}. Safe and responsible disposal of computers, phones, TVs and other electronic devices.`,
        image_url:
          state.image_url ||
          'https://images.unsplash.com/photo-1532601224476-15c79f2f7a51?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80',
        featured: state.featured,
        nearby_states: state.nearby_states,
      };

      // Cache individual state
      stateCache.set(formattedState.id, formattedState);
      stateCache.set(formattedState.name.toLowerCase(), formattedState);

      return formattedState;
    });

    return states;
  })();

  try {
    const result = await allStatesPromise;
    // Clear promise reference after completion to allow future refreshes
    // but keep cache entries
    allStatesPromise = null;
    return result;
  } catch (error) {
    allStatesPromise = null;
    throw error;
  }
}

export async function getState(stateId: string): Promise<State | null> {
  try {
    // Check cache first
    if (stateCache.has(stateId)) {
      return stateCache.get(stateId) || null;
    }

    // Also try with spaces replaced
    const altKey = stateId.replace(/-/g, ' ');
    if (stateCache.has(altKey)) {
      return stateCache.get(altKey) || null;
    }

    // First try exact match
    const { data: exactMatch, error: exactError } = await supabase
      .from('states')
      .select('*')
      .eq('name', stateId.replace(/-/g, ' '))
      .single();

    if (exactMatch) {
      const state = {
        id: normalizeForUrl(exactMatch.name),
        name: exactMatch.name,
        description: exactMatch.description,
        image_url: exactMatch.image_url,
        featured: exactMatch.featured,
        created_at: exactMatch.created_at,
        updated_at: exactMatch.updated_at,
        nearby_states: exactMatch.nearby_states,
      };

      // Cache the result
      stateCache.set(state.id, state);
      stateCache.set(state.name.toLowerCase(), state);

      return state;
    }

    // Try case-insensitive match
    const { data: likeMatch, error: likeError } = await supabase
      .from('states')
      .select('*')
      .ilike('name', stateId.replace(/-/g, ' '))
      .single();

    if (likeMatch) {
      const state = {
        id: normalizeForUrl(likeMatch.name),
        name: likeMatch.name,
        description: likeMatch.description,
        image_url: likeMatch.image_url,
        featured: likeMatch.featured,
        created_at: likeMatch.created_at,
        updated_at: likeMatch.updated_at,
        nearby_states: likeMatch.nearby_states,
      };

      // Cache the result
      stateCache.set(state.id, state);
      stateCache.set(state.name.toLowerCase(), state);

      return state;
    }

    // If not found in states table, try to find in recycling_centers
    const { data: centers, error: centersError } = await supabase
      .from('recycling_centers')
      .select('state')
      .ilike('state', stateId.replace(/-/g, ' '))
      .limit(1);

    if (centers && centers.length > 0) {
      const state = {
        id: normalizeForUrl(centers[0].state),
        name: centers[0].state,
        description: `Find electronics recycling centers in ${centers[0].state}`,
        image_url:
          'https://images.unsplash.com/photo-1532601224476-15c79f2f7a51',
        featured: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Cache the result
      stateCache.set(state.id, state);
      stateCache.set(state.name.toLowerCase(), state);

      return state;
    }

    return null;
  } catch (error) {
    console.error('Error in getState:', error);
    return null;
  }
}

export interface CentersByCity {
  [city: string]: RecyclingCenter[];
}

// Shared promise to prevent duplicate queries during build
const stateRecyclingPromises = new Map<string, Promise<CentersByCity>>();

export async function getRecyclingCentersByState(
  stateId: string
): Promise<CentersByCity> {
  // Return existing promise if this request is already in progress
  if (stateRecyclingPromises.has(stateId)) {
    return stateRecyclingPromises.get(stateId)!;
  }

  // Create a new promise for this request
  const promise = (async () => {
    // Check cache first
    const cacheKey = `state_${stateId}`;
    if (centersByCityCache.has(cacheKey)) {
      return centersByCityCache.get(cacheKey) || {};
    }

    // Also check recycling center cache
    if (recyclingCenterCache.has(cacheKey)) {
      const centers = recyclingCenterCache.get(cacheKey) || [];

      // Group centers by city
      const groupedCenters = centers.reduce(
        (acc: CentersByCity, center: RecyclingCenter) => {
          const city = center.city || 'Unknown';
          if (!acc[city]) {
            acc[city] = [];
          }
          acc[city].push(center);
          return acc;
        },
        {}
      );

      // Cache the grouped result
      centersByCityCache.set(cacheKey, groupedCenters);

      return groupedCenters;
    }

    // First get the state name from the ID
    const state = await getState(stateId);
    if (!state) throw new Error(`State not found: ${stateId}`);

    let allCenters: RecyclingCenter[] = [];
    let page = 0;
    const pageSize = 1000;

    try {
      // Use a more efficient approach with Promise.all to fetch multiple pages in parallel
      const fetchPage = async (pageNum: number): Promise<RecyclingCenter[]> => {
        const { data, error } = await supabase
          .from('recycling_centers')
          .select('*')
          .ilike('state', state.name)
          .order('city')
          .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1);

        if (error) throw error;
        return data || [];
      };

      // First get page 0 to check how many results we have
      const firstPageResults = await fetchPage(0);
      allCenters = [...firstPageResults];

      // If we have a full page, there might be more
      if (firstPageResults.length === pageSize) {
        // First, estimate how many pages we might need
        // Get count first for efficiency (faster than fetching all data to count)
        const { count, error: countError } = await supabase
          .from('recycling_centers')
          .select('*', { count: 'exact', head: true })
          .ilike('state', state.name);

        if (countError) throw countError;

        // Calculate estimated page count
        const estimatedPageCount = Math.ceil((count || 0) / pageSize);

        // Fetch remaining pages in parallel (starting from page 1)
        if (estimatedPageCount > 1) {
          const pagePromises = [];
          for (let p = 1; p < estimatedPageCount; p++) {
            pagePromises.push(fetchPage(p));
          }

          const additionalResults = await Promise.all(pagePromises);
          // Combine all results
          additionalResults.forEach((pageData) => {
            allCenters = [...allCenters, ...pageData];
          });
        }
      }
    } catch (error) {
      console.error(
        `Error fetching recycling centers for ${state.name}:`,
        error
      );
      // If there was an error with parallel fetch, fall back to sequential approach
      allCenters = []; // Reset centers
      // Use original sequential approach as fallback
      let hasMorePages = true;
      page = 0;

      while (hasMorePages) {
        const { data, error } = await supabase
          .from('recycling_centers')
          .select('*')
          .ilike('state', state.name)
          .order('city')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        if (!data || data.length === 0) {
          hasMorePages = false;
        } else {
          allCenters = [...allCenters, ...data];
          hasMorePages = data.length === pageSize;
          page++;
        }
      }
    }

    // Cache the raw results
    recyclingCenterCache.set(cacheKey, allCenters);

    // Group centers by city more efficiently
    const centersByCity: CentersByCity = {};
    for (const center of allCenters) {
      const city = center.city || 'Unknown';
      if (!centersByCity[city]) {
        centersByCity[city] = [];
      }
      centersByCity[city].push(center);
    }

    // Cache the grouped results
    centersByCityCache.set(cacheKey, centersByCity);

    return centersByCity;
  })();

  // Store the promise
  stateRecyclingPromises.set(stateId, promise);

  try {
    // Wait for it to complete
    const result = await promise;
    // Clear the promise but keep the cache
    stateRecyclingPromises.delete(stateId);
    return result;
  } catch (error) {
    // Remove failed promise
    stateRecyclingPromises.delete(stateId);
    throw error;
  }
}

export async function getRecyclingCentersByCity(
  stateId: string,
  city: string
): Promise<RecyclingCenter[]> {
  try {
    console.log(`Fetching centers for ${city}, ${stateId}...`);

    // First get the state name from the ID
    const state = await getState(stateId);
    if (!state) {
      console.error(`State not found: ${stateId}`);
      return [];
    }

    // Handle special cases for major cities first
    const specialCityVariants: Record<string, string[]> = {
      'new york': ['new york', 'new york city', 'nyc', 'manhattan'],
      miami: ['miami', 'miami beach', 'miami-dade', 'north miami'],
      'los angeles': ['los angeles', 'la', 'los angeles city'],
      washington: [
        'washington',
        'washington dc',
        'district of columbia',
        'washington d.c.',
      ],
    };

    // Check if this is a special city case
    const normalizedCity = city.toLowerCase().trim();
    let cityVariantsToTry: string[] = [];

    // Find all matching variants
    for (const [baseCity, variants] of Object.entries(specialCityVariants)) {
      if (
        variants.includes(normalizedCity) ||
        normalizedCity.includes(baseCity)
      ) {
        console.log(
          `Detected special city case: ${city} matches base city ${baseCity}`
        );
        cityVariantsToTry = variants;
        break;
      }
    }

    // If we have variants to try, check all of them and combine results
    if (cityVariantsToTry.length > 0) {
      console.log(
        `Trying ${cityVariantsToTry.length} known variants for ${city}`
      );
      let allResults: RecyclingCenter[] = [];

      for (const variant of cityVariantsToTry) {
        const { data: variantData, error: variantError } = await supabase
          .from('recycling_centers')
          .select('*')
          .ilike('state', state.name)
          .ilike('city', variant)
          .order('name');

        if (variantData && variantData.length > 0) {
          console.log(
            `Found ${variantData.length} centers with city variant: "${variant}"`
          );
          allResults = [...allResults, ...variantData];
        }
      }

      // Deduplicate results by ID
      if (allResults.length > 0) {
        const uniqueResults = allResults.filter(
          (center, index, self) =>
            index === self.findIndex((c) => c.id === center.id)
        );
        console.log(
          `After deduplication: ${uniqueResults.length} unique centers for ${city}, ${state.name}`
        );
        return uniqueResults;
      }
    }

    // Try multiple approaches to find the centers
    // 1. First try direct case-insensitive match
    let { data, error } = await supabase
      .from('recycling_centers')
      .select('*')
      .ilike('state', state.name)
      .ilike('city', city)
      .order('name');

    // 2. If no results, try with words in different order (for cities like "West New York")
    if (!data || data.length === 0) {
      console.log(
        `No exact match found. Trying alternative search for ${city}...`
      );
      const words = city.split(' ');

      if (words.length > 1) {
        const cityAlternatives = [
          // Try different word orders
          [...words].reverse().join(' '),
          // Try with common prefix/suffix alternatives
          city.replace(/^Mount\s/i, 'Mt '),
          city.replace(/^Mt\s/i, 'Mount '),
          city.replace(/^Saint\s/i, 'St '),
          city.replace(/^St\s/i, 'Saint '),
          city.replace(/\sCity$/i, ''),
          city + ' City',
          city.replace(/^North\s/i, 'N '),
          city.replace(/^South\s/i, 'S '),
          city.replace(/^East\s/i, 'E '),
          city.replace(/^West\s/i, 'W '),
          // Add more variations as needed
        ];

        for (const altCity of cityAlternatives) {
          const { data: altData, error: altError } = await supabase
            .from('recycling_centers')
            .select('*')
            .ilike('state', state.name)
            .ilike('city', altCity)
            .order('name');

          if (altData && altData.length > 0) {
            console.log(
              `Found centers using alternative city name: ${altCity}`
            );
            data = altData;
            break;
          }
        }
      }
    }

    // 3. If still no results, try with fuzzy matching (city starts with or contains)
    if (!data || data.length === 0) {
      console.log(`Still no match. Trying fuzzy matching for ${city}...`);

      // Try "starts with" pattern
      const { data: startsWithData, error: startsWithError } = await supabase
        .from('recycling_centers')
        .select('*')
        .ilike('state', state.name)
        .ilike('city', `${city}%`)
        .order('name');

      if (startsWithData && startsWithData.length > 0) {
        console.log(`Found centers with city starting with "${city}"`);
        data = startsWithData;
      } else {
        // Try "contains" pattern as last resort
        const { data: containsData, error: containsError } = await supabase
          .from('recycling_centers')
          .select('*')
          .ilike('state', state.name)
          .ilike('city', `%${city}%`)
          .order('name');

        if (containsData && containsData.length > 0) {
          console.log(`Found centers with city containing "${city}"`);
          data = containsData;
        }
      }
    }

    if (error) {
      console.error('Error fetching recycling centers:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log(`No centers found for ${city}, ${state.name}`);
      return [];
    }

    console.log(`Found ${data.length} centers in ${city}, ${state.name}`);
    return data;
  } catch (error) {
    console.error('Error in getRecyclingCentersByCity:', error);
    return [];
  }
}

export async function getCitiesByState(stateId: string): Promise<City[]> {
  // Check cache first
  if (cityCache.has(stateId)) {
    return cityCache.get(stateId) || [];
  }

  // First get the state name from the ID
  const state = await getState(stateId);
  if (!state) throw new Error('State not found');

  const { data, error } = await supabase
    .from('recycling_centers')
    .select('city')
    .ilike('state', state.name)
    .order('city')
    .not('city', 'is', null);

  if (error) throw error;

  // Get unique cities
  const uniqueCities = [...new Set(data?.map((row) => row.city) || [])];

  // Convert to City type and cache
  const cities = uniqueCities.map((cityName) => ({
    id: cityName.toLowerCase().replace(/\s+/g, '-'),
    state_id: stateId,
    name: cityName,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  cityCache.set(stateId, cities);
  return cities;
}

export interface StateWithCities {
  state: string;
  cities: string[];
}

export async function getAllCities(): Promise<StateWithCities[]> {
  const { data, error } = await supabase
    .from('recycling_centers')
    .select('state, city')
    .not('city', 'is', null);

  if (error) throw error;

  // Group cities by state and remove duplicates
  const citiesByState = (data || []).reduce<Record<string, Set<string>>>(
    (acc, { state, city }) => {
      if (!acc[state]) {
        acc[state] = new Set();
      }
      if (city) {
        acc[state].add(city);
      }
      return acc;
    },
    {}
  );

  // Get all states and shuffle them
  const states = Object.keys(citiesByState);
  for (let i = states.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [states[i], states[j]] = [states[j], states[i]];
  }

  // Take 8 random states and for each state, up to 3 random cities
  return states.slice(0, 8).map((state) => {
    const cities = Array.from(citiesByState[state]);
    // Shuffle cities
    for (let i = cities.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cities[i], cities[j]] = [cities[j], cities[i]];
    }
    return {
      state,
      cities: cities.slice(0, 3),
    };
  });
}

export async function getFeaturedStates(): Promise<State[]> {
  try {
    // Check cache first
    const now = Date.now();
    const cached = featuredStatesCache.get('featured');
    if (cached && now - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }

    const { data, error } = await supabase
      .from('states')
      .select('*')
      .eq('featured', true)
      .order('name');

    if (error) {
      console.error('Error fetching featured states:', error);
      throw error;
    }

    // Convert to State type with proper formatting
    const states = (data || []).map((state) => ({
      id: state.name.toLowerCase().replace(/\s+/g, '-'),
      name: state.name,
      description:
        state.description ||
        `Find electronics recycling centers in ${state.name}. Safe and responsible disposal of computers, phones, TVs and other electronic devices.`,
      image_url:
        state.image_url ||
        'https://images.unsplash.com/photo-1532601224476-15c79f2f7a51?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80',
      featured: true,
      nearby_states: state.nearby_states,
    }));

    // Cache the results
    featuredStatesCache.set('featured', { data: states, timestamp: now });

    return states;
  } catch (err) {
    console.error('Exception in getFeaturedStates:', err);
    throw err;
  }
}

// Add this function to optimize querying recycling centers
export async function getAllCitiesByState(): Promise<Record<string, string[]>> {
  try {
    // This is a more efficient query for static generation
    const { data, error } = await supabase
      .from('recycling_centers')
      .select('state, city')
      .not('city', 'is', null);

    if (error) throw error;

    if (!data || data.length === 0) {
      return {};
    }

    // Group cities by state
    const citiesByState: Record<string, Set<string>> = {};

    data.forEach((item) => {
      if (item.state && item.city) {
        if (!citiesByState[item.state]) {
          citiesByState[item.state] = new Set();
        }
        citiesByState[item.state].add(item.city);
      }
    });

    // Convert sets to arrays for easier handling
    const result: Record<string, string[]> = {};
    for (const [state, cities] of Object.entries(citiesByState)) {
      result[state] = Array.from(cities);
    }

    return result;
  } catch (error) {
    console.error('Error fetching all cities by state:', error);
    return {};
  }
}

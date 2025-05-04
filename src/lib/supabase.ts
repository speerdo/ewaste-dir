import { createClient } from '@supabase/supabase-js';
import type { State, RecyclingCenter, City } from '../types/supabase';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Cache for state and city data
const stateCache = new Map<string, State>();
const cityCache = new Map<string, City[]>();
const recyclingCenterCache = new Map<string, RecyclingCenter[]>();

// Add at the top with other cache declarations
const featuredStatesCache = new Map<
  string,
  { data: State[]; timestamp: number }
>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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

export async function getAllStates(): Promise<State[]> {
  const { data, error } = await supabase
    .from('states')
    .select('*')
    .order('name');

  if (error) throw error;

  // Convert to State type with proper formatting
  return (data || []).map((state) => ({
    id: state.name.toLowerCase().replace(/\s+/g, '-'),
    name: state.name,
    description:
      state.description ||
      `Find electronics recycling centers in ${state.name}. Safe and responsible disposal of computers, phones, TVs and other electronic devices.`,
    image_url:
      state.image_url ||
      'https://images.unsplash.com/photo-1532601224476-15c79f2f7a51?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80',
    featured: state.featured,
    nearby_states: state.nearby_states,
  }));
}

export async function getState(stateId: string): Promise<State | null> {
  try {
    console.log(`Getting state data for: ${stateId}`);

    // First try exact match
    const { data: exactMatch, error: exactError } = await supabase
      .from('states')
      .select('*')
      .eq('name', stateId.replace(/-/g, ' '))
      .single();

    if (exactMatch) {
      console.log(`Found exact match for state: ${exactMatch.name}`);
      return {
        id: normalizeForUrl(exactMatch.name),
        name: exactMatch.name,
        description: exactMatch.description,
        image_url: exactMatch.image_url,
        featured: exactMatch.featured,
        created_at: exactMatch.created_at,
        updated_at: exactMatch.updated_at,
        nearby_states: exactMatch.nearby_states,
      };
    }

    // Try case-insensitive match
    const { data: likeMatch, error: likeError } = await supabase
      .from('states')
      .select('*')
      .ilike('name', stateId.replace(/-/g, ' '))
      .single();

    if (likeMatch) {
      console.log(`Found case-insensitive match for state: ${likeMatch.name}`);
      return {
        id: normalizeForUrl(likeMatch.name),
        name: likeMatch.name,
        description: likeMatch.description,
        image_url: likeMatch.image_url,
        featured: likeMatch.featured,
        created_at: likeMatch.created_at,
        updated_at: likeMatch.updated_at,
        nearby_states: likeMatch.nearby_states,
      };
    }

    // If not found in states table, try to find in recycling_centers
    const { data: centers, error: centersError } = await supabase
      .from('recycling_centers')
      .select('state')
      .ilike('state', stateId.replace(/-/g, ' '))
      .limit(1);

    if (centers && centers.length > 0) {
      console.log(`Found state in recycling centers: ${centers[0].state}`);
      return {
        id: normalizeForUrl(centers[0].state),
        name: centers[0].state,
        description: `Find electronics recycling centers in ${centers[0].state}`,
        image_url:
          'https://images.unsplash.com/photo-1532601224476-15c79f2f7a51',
        featured: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    console.log(`No state found for: ${stateId}`);
    return null;
  } catch (error) {
    console.error('Error in getState:', error);
    return null;
  }
}

export interface CentersByCity {
  [city: string]: RecyclingCenter[];
}

export async function getRecyclingCentersByState(
  stateId: string
): Promise<CentersByCity> {
  // Check cache first
  const cacheKey = `state_${stateId}`;
  if (recyclingCenterCache.has(cacheKey)) {
    const centers = recyclingCenterCache.get(cacheKey) || [];
    return centers.reduce((acc: CentersByCity, center: RecyclingCenter) => {
      const city = center.city || 'Unknown';
      if (!acc[city]) {
        acc[city] = [];
      }
      acc[city].push(center);
      return acc;
    }, {});
  }

  // First get the state name from the ID
  const state = await getState(stateId);
  if (!state) throw new Error('State not found');

  let allCenters: RecyclingCenter[] = [];
  let page = 0;
  const pageSize = 1000;

  // Use pagination to get all centers
  while (true) {
    const { data, error } = await supabase
      .from('recycling_centers')
      .select('*')
      .ilike('state', state.name)
      .order('city')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw error;

    if (!data || data.length === 0) break;

    allCenters = [...allCenters, ...data];

    if (data.length < pageSize) break;
    page++;
  }

  // Cache the results
  recyclingCenterCache.set(cacheKey, allCenters);

  // Group centers by city
  return allCenters.reduce((acc: CentersByCity, center: RecyclingCenter) => {
    const city = center.city || 'Unknown';
    if (!acc[city]) {
      acc[city] = [];
    }
    acc[city].push(center);
    return acc;
  }, {});
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

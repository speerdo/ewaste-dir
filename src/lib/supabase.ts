import { createClient } from '@supabase/supabase-js';
import type { State, RecyclingCenter, City } from '../types/supabase';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Cache for state and city data
const stateCache = new Map<string, State>();
const cityCache = new Map<string, City[]>();
const recyclingCenterCache = new Map<string, RecyclingCenter[]>();

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

    // Use case-insensitive matching for both state and city
    const { data, error } = await supabase
      .from('recycling_centers')
      .select('*')
      .ilike('state', state.name)
      .ilike('city', city)
      .order('name');

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
    console.log('Fetching featured states...');
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

    console.log('Featured states data:', states);
    return states;
  } catch (err) {
    console.error('Exception in getFeaturedStates:', err);
    throw err;
  }
}

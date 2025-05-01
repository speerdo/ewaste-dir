import { createClient } from '@supabase/supabase-js';
import type { State, RecyclingCenter, City } from '../types/supabase';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Cache for state and city data
const stateCache = new Map<string, State>();
const cityCache = new Map<string, City[]>();
const recyclingCenterCache = new Map<string, RecyclingCenter[]>();

export async function getAllStates(): Promise<State[]> {
  const { data, error } = await supabase
    .from('states')
    .select('*')
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function getState(stateId: string): Promise<State | null> {
  // Check cache first
  if (stateCache.has(stateId)) {
    return stateCache.get(stateId) || null;
  }

  const { data, error } = await supabase
    .from('states')
    .select('*')
    .eq('id', stateId)
    .single();

  if (error) throw error;
  if (data) {
    stateCache.set(stateId, data);
  }
  return data;
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

  const { data, error } = await supabase
    .from('recycling_centers')
    .select('*')
    .ilike('state', state.name);

  if (error) throw error;

  // Cache the results
  recyclingCenterCache.set(cacheKey, data || []);

  // Group centers by city
  return (data || []).reduce((acc: CentersByCity, center: RecyclingCenter) => {
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
  // Check cache first
  const cacheKey = `state_${stateId}`;
  if (recyclingCenterCache.has(cacheKey)) {
    const centers = recyclingCenterCache.get(cacheKey) || [];
    return centers.filter(
      (center) => center.city?.toLowerCase() === city.toLowerCase()
    );
  }

  // First get the state name from the ID
  const state = await getState(stateId);
  if (!state) throw new Error('State not found');

  const { data, error } = await supabase
    .from('recycling_centers')
    .select('*')
    .ilike('state', state.name)
    .ilike('city', city);

  if (error) throw error;
  return data || [];
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
    .order('state')
    .order('city');

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

  // Convert to array format
  return Object.entries(citiesByState).map(([state, cities]) => ({
    state,
    cities: Array.from(cities),
  }));
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

    console.log('Featured states data:', data);
    return data || [];
  } catch (err) {
    console.error('Exception in getFeaturedStates:', err);
    throw err;
  }
}

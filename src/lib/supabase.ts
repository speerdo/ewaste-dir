import { createClient } from '@supabase/supabase-js';
import type { State, RecyclingCenter, City } from '../types/supabase';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getAllStates(): Promise<State[]> {
  const { data, error } = await supabase
    .from('states')
    .select('*')
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function getState(id: string): Promise<State | null> {
  const { data, error } = await supabase
    .from('states')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export interface CentersByCity {
  [city: string]: RecyclingCenter[];
}

export async function getRecyclingCentersByState(
  stateId: string
): Promise<CentersByCity> {
  // First get the state name from the ID
  const { data: stateData, error: stateError } = await supabase
    .from('states')
    .select('name')
    .eq('id', stateId)
    .single();

  if (stateError) throw stateError;
  if (!stateData) throw new Error('State not found');

  const { data, error } = await supabase
    .from('recycling_centers')
    .select('*')
    .ilike('state', stateData.name);

  if (error) throw error;

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
  // First get the state name from the ID
  const { data: stateData, error: stateError } = await supabase
    .from('states')
    .select('name')
    .eq('id', stateId)
    .single();

  if (stateError) throw stateError;
  if (!stateData) throw new Error('State not found');

  const { data, error } = await supabase
    .from('recycling_centers')
    .select('*')
    .ilike('state', stateData.name)
    .ilike('city', city);

  if (error) throw error;
  return data || [];
}

export async function getCitiesByState(stateId: string): Promise<City[]> {
  // First get the state name from the ID
  const { data: stateData, error: stateError } = await supabase
    .from('states')
    .select('name')
    .eq('id', stateId)
    .single();

  if (stateError) throw stateError;
  if (!stateData) throw new Error('State not found');

  const { data, error } = await supabase
    .from('recycling_centers')
    .select('city')
    .ilike('state', stateData.name)
    .order('city')
    .not('city', 'is', null);

  if (error) throw error;

  // Get unique cities
  const uniqueCities = [...new Set(data?.map((row) => row.city) || [])];

  // Convert to City type
  return uniqueCities.map((cityName) => ({
    id: cityName.toLowerCase().replace(/\s+/g, '-'),
    state_id: stateId,
    name: cityName,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
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

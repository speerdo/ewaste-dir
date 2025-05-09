import { createClient } from '@supabase/supabase-js';
import type { State, RecyclingCenter, City } from '../types/supabase';
import * as mockData from './mockSupabase';

// Environment variables with fallbacks
const supabaseUrl =
  import.meta.env.PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey =
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

// Determine if we should use mocks
const isBuildEnv = import.meta.env.PROD && !import.meta.env.SSR;
const shouldUseMock = isBuildEnv || !supabaseUrl || !supabaseAnonKey;

// Client initialization
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  global: { headers: { 'x-client-info': 'astro-build' } },
});

// Export utility functions based on environment
export const getAllStates = shouldUseMock
  ? mockData.getAllStates
  : realGetAllStates;

export const getState = shouldUseMock ? mockData.getState : realGetState;

export const getRecyclingCentersByState = shouldUseMock
  ? mockData.getRecyclingCentersByState
  : realGetRecyclingCentersByState;

export const getRecyclingCentersByCity = shouldUseMock
  ? mockData.getRecyclingCentersByCity
  : realGetRecyclingCentersByCity;

export const getCitiesByState = shouldUseMock
  ? mockData.getCitiesByState
  : realGetCitiesByState;

export const getFeaturedStates = shouldUseMock
  ? mockData.getFeaturedStates
  : realGetFeaturedStates;

export const getAllCitiesByState = shouldUseMock
  ? mockData.getAllCitiesByState
  : realGetAllCitiesByState;

export const normalizeForUrl = (str: string): string => {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

// Real implementations
async function realGetAllStates(): Promise<State[]> {
  try {
    const { data, error } = await supabase
      .from('states')
      .select('*')
      .order('name');

    if (error) throw error;

    return (data || []).map((state) => ({
      id: normalizeForUrl(state.name),
      name: state.name,
      description:
        state.description ||
        `Find electronics recycling centers in ${state.name}`,
      image_url:
        state.image_url ||
        'https://images.unsplash.com/photo-1532601224476-15c79f2f7a51',
      featured: state.featured,
      nearby_states: state.nearby_states,
    }));
  } catch (error) {
    console.error('Error fetching states:', error);
    return [];
  }
}

async function realGetState(stateId: string): Promise<State | null> {
  try {
    const { data, error } = await supabase
      .from('states')
      .select('*')
      .eq('name', stateId.replace(/-/g, ' '))
      .single();

    if (error) {
      // Try case insensitive search
      const { data: likeData, error: likeError } = await supabase
        .from('states')
        .select('*')
        .ilike('name', stateId.replace(/-/g, ' '))
        .single();

      if (likeError) return null;

      if (likeData) {
        return {
          id: normalizeForUrl(likeData.name),
          name: likeData.name,
          description: likeData.description,
          image_url: likeData.image_url,
          featured: likeData.featured,
          nearby_states: likeData.nearby_states,
        };
      }

      return null;
    }

    return {
      id: normalizeForUrl(data.name),
      name: data.name,
      description: data.description,
      image_url: data.image_url,
      featured: data.featured,
      nearby_states: data.nearby_states,
    };
  } catch (error) {
    console.error('Error fetching state:', error);
    return null;
  }
}

interface CentersByCity {
  [city: string]: RecyclingCenter[];
}

async function realGetRecyclingCentersByState(
  stateId: string
): Promise<CentersByCity> {
  try {
    const state = await getState(stateId);
    if (!state) return {};

    const { data, error } = await supabase
      .from('recycling_centers')
      .select('*')
      .ilike('state', state.name);

    if (error) throw error;

    // Group by city
    const centersByCity: CentersByCity = {};
    (data || []).forEach((center) => {
      const city = center.city || 'Unknown';
      if (!centersByCity[city]) {
        centersByCity[city] = [];
      }
      centersByCity[city].push(center);
    });

    return centersByCity;
  } catch (error) {
    console.error('Error fetching recycling centers:', error);
    return {};
  }
}

async function realGetRecyclingCentersByCity(
  stateId: string,
  city: string
): Promise<RecyclingCenter[]> {
  try {
    const state = await getState(stateId);
    if (!state) return [];

    const { data, error } = await supabase
      .from('recycling_centers')
      .select('*')
      .ilike('state', state.name)
      .ilike('city', city);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching recycling centers by city:', error);
    return [];
  }
}

async function realGetCitiesByState(stateId: string): Promise<City[]> {
  try {
    const state = await getState(stateId);
    if (!state) return [];

    const { data, error } = await supabase
      .from('recycling_centers')
      .select('city')
      .ilike('state', state.name)
      .order('city');

    if (error) throw error;

    // Create unique set of cities
    const uniqueCities = Array.from(
      new Set((data || []).map((item) => item.city))
    ).map((cityName) => ({
      id: normalizeForUrl(cityName),
      name: cityName,
    }));

    return uniqueCities;
  } catch (error) {
    console.error('Error fetching cities:', error);
    return [];
  }
}

async function realGetFeaturedStates(): Promise<State[]> {
  try {
    const { data, error } = await supabase
      .from('states')
      .select('*')
      .eq('featured', true)
      .order('name');

    if (error) throw error;

    return (data || []).map((state) => ({
      id: normalizeForUrl(state.name),
      name: state.name,
      description:
        state.description ||
        `Find electronics recycling centers in ${state.name}`,
      image_url:
        state.image_url ||
        'https://images.unsplash.com/photo-1532601224476-15c79f2f7a51',
      featured: state.featured,
      nearby_states: state.nearby_states,
    }));
  } catch (error) {
    console.error('Error fetching featured states:', error);
    return [];
  }
}

async function realGetAllCitiesByState(): Promise<Record<string, string[]>> {
  try {
    const { data, error } = await supabase
      .from('recycling_centers')
      .select('city, state');

    if (error) throw error;

    const stateMap: Record<string, Set<string>> = {};

    (data || []).forEach((item) => {
      const stateId = normalizeForUrl(item.state);
      if (!stateMap[stateId]) {
        stateMap[stateId] = new Set();
      }
      stateMap[stateId].add(item.city);
    });

    // Convert Sets to arrays
    const result: Record<string, string[]> = {};
    Object.entries(stateMap).forEach(([stateId, citySet]) => {
      result[stateId] = Array.from(citySet).sort();
    });

    return result;
  } catch (error) {
    console.error('Error fetching all cities by state:', error);
    return {};
  }
}

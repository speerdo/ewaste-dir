// Mock Supabase implementation for build process
import type { State, RecyclingCenter, City } from '../types/supabase';

// Simple mock data for build purposes
const mockStates: State[] = [
  {
    id: 'new-york',
    name: 'New York',
    description:
      'Find electronics recycling centers in New York. Safe and responsible disposal of computers, phones, TVs and other electronic devices.',
    image_url: 'https://images.unsplash.com/photo-1532601224476-15c79f2f7a51',
    featured: true,
  },
  {
    id: 'california',
    name: 'California',
    description:
      'Find electronics recycling centers in California. Safe and responsible disposal of computers, phones, TVs and other electronic devices.',
    image_url: 'https://images.unsplash.com/photo-1532601224476-15c79f2f7a51',
    featured: true,
  },
];

const mockCities: Record<string, City[]> = {
  'new-york': [
    { id: 'new-york-city', name: 'New York City', state: 'New York' },
    { id: 'albany', name: 'Albany', state: 'New York' },
  ],
  california: [
    { id: 'los-angeles', name: 'Los Angeles', state: 'California' },
    { id: 'san-francisco', name: 'San Francisco', state: 'California' },
  ],
};

// Mock recycling centers
const mockRecyclingCenters: Record<string, RecyclingCenter[]> = {
  'new-york': [
    {
      id: '1',
      name: 'NYC E-Waste Center',
      address: '123 Example St',
      city: 'New York City',
      state: 'New York',
      zip: '10001',
      phone: '555-123-4567',
      website: 'https://example.com',
      description: 'E-waste recycling center in NYC',
      latitude: 40.7128,
      longitude: -74.006,
    },
  ],
  california: [
    {
      id: '2',
      name: 'LA E-Waste Center',
      address: '456 Sample Blvd',
      city: 'Los Angeles',
      state: 'California',
      zip: '90001',
      phone: '555-987-6543',
      website: 'https://example.com',
      description: 'E-waste recycling center in LA',
      latitude: 34.0522,
      longitude: -118.2437,
    },
  ],
};

// Mock implementation of Supabase functions
export async function getAllStates(): Promise<State[]> {
  return Promise.resolve(mockStates);
}

export async function getState(stateId: string): Promise<State | null> {
  const state = mockStates.find((s) => s.id === stateId);
  return Promise.resolve(state || null);
}

export async function getRecyclingCentersByState(
  stateId: string
): Promise<Record<string, RecyclingCenter[]>> {
  const centers = mockRecyclingCenters[stateId] || [];

  // Group by city
  const centersByCity: Record<string, RecyclingCenter[]> = {};
  centers.forEach((center) => {
    const city = center.city;
    if (!centersByCity[city]) {
      centersByCity[city] = [];
    }
    centersByCity[city].push(center);
  });

  return Promise.resolve(centersByCity);
}

export async function getRecyclingCentersByCity(
  stateId: string,
  city: string
): Promise<RecyclingCenter[]> {
  const centers = mockRecyclingCenters[stateId] || [];
  return Promise.resolve(
    centers.filter((c) => c.city.toLowerCase() === city.toLowerCase())
  );
}

export async function getCitiesByState(stateId: string): Promise<City[]> {
  return Promise.resolve(mockCities[stateId] || []);
}

export async function getFeaturedStates(): Promise<State[]> {
  return Promise.resolve(mockStates.filter((s) => s.featured));
}

export async function getAllCitiesByState(): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {};

  Object.entries(mockCities).forEach(([stateId, cities]) => {
    result[stateId] = cities.map((c) => c.name);
  });

  return Promise.resolve(result);
}

export function normalizeForUrl(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

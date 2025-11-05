import { createClient } from '@supabase/supabase-js';
import type {
  State,
  RecyclingCenter,
  City,
  LocalRegulations,
  CityStats,
} from '../types/supabase';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

// Validate Supabase credentials
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase credentials. Make sure PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY are set in your environment variables.'
  );
}

// Initialize Supabase client with extended timeout
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // Don't persist auth state during builds
  },
  global: {
    headers: { 'x-client-info': 'astro-build' },
  },
  db: {
    schema: 'public',
  },
  // Increase timeout for build queries
  realtime: {
    timeout: 120000, // 2 minutes
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
 * - Normalizing special characters (like ñ, á, é, etc.)
 * - Replacing non-alphanumeric characters with hyphens
 * - Removing leading/trailing hyphens
 */
export function normalizeForUrl(str: string): string {
  if (!str) return '';

  // Create a mapping of special characters to their ASCII equivalents
  const charMap: Record<string, string> = {
    á: 'a',
    é: 'e',
    í: 'i',
    ó: 'o',
    ú: 'u',
    à: 'a',
    è: 'e',
    ì: 'i',
    ò: 'o',
    ù: 'u',
    ä: 'a',
    ë: 'e',
    ï: 'i',
    ö: 'o',
    ü: 'u',
    â: 'a',
    ê: 'e',
    î: 'i',
    ô: 'o',
    û: 'u',
    ñ: 'n',
    ç: 'c',
    ß: 'ss',
    ø: 'o',
    å: 'a',
    æ: 'ae',
    œ: 'oe',
    ã: 'a',
    õ: 'o',
    ď: 'd',
    ť: 't',
    ň: 'n',
    ř: 'r',
    š: 's',
    ý: 'y',
    ž: 'z',
    ć: 'c',
    ĺ: 'l',
    ŕ: 'r',
    ń: 'n',
    ś: 's',
    ź: 'z',
    đ: 'd',
    ů: 'u',
    ě: 'e',
    č: 'c',
    ľ: 'l',
  };

  // Replace special characters with their ASCII equivalents
  const normalized = str
    .toLowerCase()
    .split('')
    .map((char) => {
      return charMap[char] || char;
    })
    .join('');

  // Replace non-alphanumeric characters with hyphens and clean up
  return normalized.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
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
    // Log input for debugging
    // console.log('getState - input stateId:', stateId);

    // Check cache first
    if (stateCache.has(stateId)) {
      const cachedState = stateCache.get(stateId);
      // console.log('getState - found in cache:', cachedState);
      return cachedState || null;
    }

    // Also try with spaces replaced
    const altKey = stateId.replace(/-/g, ' ');
    if (stateCache.has(altKey)) {
      const cachedState = stateCache.get(altKey);
      // console.log('getState - found in cache with altKey:', cachedState);
      return cachedState || null;
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

      // console.log('getState - found exact match:', state);
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

      // console.log('getState - found case-insensitive match:', state);
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

      // console.log('getState - found in recycling centers:', state);
      return state;
    }

    // console.log('getState - no state found for:', stateId);
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

    // Create a normalized version for comparison
    const plainCity = city
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

    // IMPORTANT: We're going to check if this is a special city for normalization only
    // Not for expanding to include more cities
    let searchCity = city; // Default to the original city name
    let searchCityVariants = [city]; // Default variants for search

    // Special handling for normalization of specific city names
    const specialCityNormalization: Record<string, string> = {
      'new york': 'New York',
      'new york city': 'New York',
      nyc: 'New York',
      manhattan: 'Manhattan',
      brooklyn: 'Brooklyn',
      queens: 'Queens',
      bronx: 'Bronx',
      'staten island': 'Staten Island',
      miami: 'Miami',
      'miami beach': 'Miami Beach',
      'miami-dade': 'Miami-Dade',
      'north miami': 'North Miami',
      'los angeles': 'Los Angeles',
      la: 'Los Angeles', // only normalize LA -> Los Angeles
      washington: 'Washington',
      'washington dc': 'Washington, D.C.',
      'district of columbia': 'Washington, D.C.',
      'washington d.c.': 'Washington, D.C.',
      // Handle Canon City / Cañon City variations - both should map to the Spanish form
      'canon city': 'Cañon City',
      'cañon city': 'Cañon City',
      // Handle Española variations
      espanola: 'Española',
      española: 'Española',
      // Handle other common Spanish city names
      'san jose': 'San José',
      'san josé': 'San José',
      'la canada': 'La Cañada',
      'la cañada': 'La Cañada',
      'la canada flintridge': 'La Cañada Flintridge',
      'la cañada flintridge': 'La Cañada Flintridge',
      // Other cities
      chicago: 'Chicago',
      'saint louis': 'Saint Louis',
      'st louis': 'Saint Louis',
      'st. louis': 'Saint Louis',
      'saint paul': 'Saint Paul',
      'st paul': 'Saint Paul',
      'st. paul': 'Saint Paul',
    };

    // Check if we need to normalize the city name
    const normalizedCity = plainCity.toLowerCase().trim();
    if (specialCityNormalization[normalizedCity]) {
      searchCity = specialCityNormalization[normalizedCity];
      console.log(`Normalized city name from "${city}" to "${searchCity}"`);
    }

    // Add common variants for the exact city we're searching for
    // These are just normalized forms of the SAME city, not different cities
    searchCityVariants = [
      searchCity,
      searchCity.normalize('NFD').replace(/[\u0300-\u036f]/g, ''), // No diacritical marks
    ];

    // If the original input city differs from searchCity, include it too
    if (city !== searchCity) {
      searchCityVariants.push(city);
      searchCityVariants.push(
        city.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      );
    }

    // Add URL-normalized version (what would be in the URL)
    const urlNormalized = normalizeForUrl(searchCity);
    if (urlNormalized !== searchCity.toLowerCase().replace(/\s+/g, '-')) {
      // Convert back from URL format to title case
      const fromUrl = urlNormalized
        .split('-')
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(' ');
      if (!searchCityVariants.includes(fromUrl)) {
        searchCityVariants.push(fromUrl);
      }
    }

    // Remove duplicates and filter out empty strings
    searchCityVariants = [...new Set(searchCityVariants)].filter(
      (variant) => variant.trim().length > 0
    );

    // Add common variants for ONLY this specific city (suffixes and prefixes)
    const baseNormalizedCity = normalizedCity;

    // Try variants without common suffixes
    const withoutSuffix = baseNormalizedCity.replace(
      /\s(city|town|village|heights|springs|beach|park)$/i,
      ''
    );
    if (withoutSuffix !== baseNormalizedCity && withoutSuffix.length > 0) {
      // Capitalize first letter of each word
      const formattedWithoutSuffix = withoutSuffix
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      searchCityVariants.push(formattedWithoutSuffix);
    }

    // Try variants without common prefixes
    const withoutPrefix = baseNormalizedCity.replace(
      /^(north|south|east|west|new|old|fort|mount|mt|saint|st|san|santa|el|la)\s/i,
      ''
    );
    if (withoutPrefix !== baseNormalizedCity && withoutPrefix.length > 0) {
      // Capitalize first letter of each word
      const formattedWithoutPrefix = withoutPrefix
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      searchCityVariants.push(formattedWithoutPrefix);
    }

    // Final deduplication
    searchCityVariants = [...new Set(searchCityVariants)].filter(
      (variant) => variant.trim().length > 0
    );

    console.log(
      `Searching for exact matches with city variants: ${searchCityVariants.join(
        ', '
      )}`
    );

    // STEP 1: First try ONLY exact city matches
    let allResults: RecyclingCenter[] = [];

    // Try exact city match first
    for (const variant of searchCityVariants) {
      const { data: exactCityMatches } = await supabase
        .from('recycling_centers')
        .select('*')
        .ilike('state', state.name)
        .ilike('city', variant)
        .order('name');

      if (exactCityMatches && exactCityMatches.length > 0) {
        console.log(
          `Found ${exactCityMatches.length} centers with exact city match: "${variant}"`
        );
        allResults = [...allResults, ...exactCityMatches];
      }
    }

    // STEP 2: If we found exact matches, mark them and return
    if (allResults.length > 0) {
      // Mark all as matched since they're exact city matches
      allResults = allResults.map((center) => ({
        ...center,
        matched: true,
      }));

      // Deduplicate
      const uniqueResults = allResults.filter(
        (center, index, self) =>
          index === self.findIndex((c) => c.id === center.id)
      );

      console.log(
        `Returning ${uniqueResults.length} exact city matches for ${city}, ${state.name}`
      );
      return uniqueResults;
    }

    // STEP 3: If NO exact matches, try address matches but only with strict filtering
    console.log(`No exact city matches found. Trying address matches...`);
    let addressMatches: RecyclingCenter[] = [];

    for (const variant of searchCityVariants) {
      const { data: addressData } = await supabase
        .from('recycling_centers')
        .select('*')
        .ilike('state', state.name)
        .ilike('full_address', `%${variant}%`)
        .order('name');

      if (addressData && addressData.length > 0) {
        console.log(
          `Found ${addressData.length} centers with "${variant}" in address`
        );
        addressMatches = [...addressMatches, ...addressData];
      }
    }

    if (addressMatches.length > 0) {
      // Mark these as not exact matches
      addressMatches = addressMatches.map((center) => ({
        ...center,
        matched: false,
      }));

      // Deduplicate
      const uniqueAddressMatches = addressMatches.filter(
        (center, index, self) =>
          index === self.findIndex((c) => c.id === center.id)
      );

      console.log(
        `Returning ${uniqueAddressMatches.length} address matches for ${city}, ${state.name}`
      );
      return uniqueAddressMatches;
    }

    // STEP 4: As a last resort, find nearest major city in the state with centers
    // This is more targeted than before and will clearly mark them as not matches
    console.log(`No matches found. Finding centers in nearest major cities...`);

    // Major cities to try
    const majorCities = [
      'New York',
      'Los Angeles',
      'Chicago',
      'Houston',
      'Phoenix',
      'Philadelphia',
      'San Antonio',
      'San Diego',
      'Dallas',
      'Austin',
      'San Jose',
      'Jacksonville',
      'Fort Worth',
      'Columbus',
      'Charlotte',
      'Indianapolis',
      'San Francisco',
      'Seattle',
      'Denver',
      'Boston',
      'Portland',
      'Las Vegas',
      'Detroit',
      'Memphis',
      'Louisville',
      'Baltimore',
      'Milwaukee',
      'Albuquerque',
      'Tucson',
      'Fresno',
      'Sacramento',
      'Atlanta',
      'Miami',
      'Orlando',
      'Tampa',
    ].filter((c) => c.toLowerCase() !== normalizedCity); // Don't include the city we already checked

    // Find centers in major cities within this state
    const { data: majorCityMatches } = await supabase
      .from('recycling_centers')
      .select('*')
      .ilike('state', state.name)
      .in('city', majorCities)
      .order('city')
      .limit(15);

    if (majorCityMatches && majorCityMatches.length > 0) {
      console.log(
        `Found ${majorCityMatches.length} centers in major cities in ${state.name}`
      );

      // Mark all as non-matches
      const fallbackResults = majorCityMatches.map((center) => ({
        ...center,
        matched: false,
      }));

      console.log(
        `Returning ${fallbackResults.length} fallback centers for ${city}, ${state.name}`
      );
      return fallbackResults;
    }

    // If absolutely nothing was found, return empty array
    console.log(`No centers found for ${city}, ${state.name}`);
    return [];
  } catch (error) {
    console.error('Error in getRecyclingCentersByCity:', error);
    return [];
  }
}

/**
 * Get city description from database
 * Returns the verified description if available, null otherwise
 */
export async function getCityDescription(stateId: string, cityId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('cities')
    .select('description, description_verified')
    .eq('state_id', stateId)
    .eq('id', cityId)
    .eq('description_verified', true)
    .single();

  if (error || !data || !data.description) {
    return null;
  }

  return data.description;
}

export async function getCitiesByState(stateId: string): Promise<City[]> {
  // Check cache first
  if (cityCache.has(stateId)) {
    return cityCache.get(stateId) || [];
  }

  // First get the state name from the ID
  const state = await getState(stateId);
  if (!state) throw new Error('State not found');

  console.log(`Fetching all cities for ${state.name}...`);

  // Optimize: Fetch distinct cities directly instead of all rows
  // This is much faster as we only get unique cities, not all recycling center rows
  const { data, error } = await supabase
    .rpc('get_distinct_cities_by_state', { state_name: state.name });

  // Fallback if RPC doesn't exist: use regular query with pagination
  if (error || !data) {
    console.log('RPC not available, using fallback query...');
    
    const allCities = new Set<string>();
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: pageData, error: pageError } = await supabase
        .from('recycling_centers')
        .select('city')
        .ilike('state', state.name)
        .not('city', 'is', null)
        .order('city')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (pageError) throw pageError;

      if (pageData && pageData.length > 0) {
        pageData.forEach((row) => {
          if (row.city) {
            allCities.add(row.city);
          }
        });
        hasMore = pageData.length === pageSize;
        page++;
        console.log(
          `  Page ${page}: ${pageData.length} rows, ${allCities.size} unique cities so far`
        );
      } else {
        hasMore = false;
      }
    }

    const uniqueCities = Array.from(allCities).sort();
    console.log(`✅ Found ${uniqueCities.length} unique cities in ${state.name}`);

    // Convert to City type and cache
    const cities = uniqueCities.map((cityName: string) => ({
      id: normalizeForUrl(cityName),
      state_id: stateId,
      name: cityName,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    cityCache.set(stateId, cities);
    return cities;
  }

  // If RPC worked, use its results
  const uniqueCities = data.map((row: any) => row.city).sort();
  console.log(`✅ Found ${uniqueCities.length} unique cities in ${state.name}`);

  // Convert to City type and cache
  const cities = uniqueCities.map((cityName: string) => ({
    id: normalizeForUrl(cityName),
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
      id: normalizeForUrl(state.name),
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

/**
 * Get local regulations data for a city
 */
export async function getLocalRegulations(
  cityState: string
): Promise<LocalRegulations | null> {
  try {
    const { data, error } = await supabase
      .from('local_regulations')
      .select('*')
      .eq('city_state', cityState)
      .single();

    if (error) {
      console.log(`No local regulations found for ${cityState}`);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error fetching local regulations:', error);
    return null;
  }
}

/**
 * Get city statistics data for a city
 */
export async function getCityStats(
  cityState: string
): Promise<CityStats | null> {
  try {
    const { data, error } = await supabase
      .from('city_stats')
      .select('*')
      .eq('city_state', cityState)
      .single();

    if (error) {
      console.log(`No city stats found for ${cityState}`);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error fetching city stats:', error);
    return null;
  }
}

/**
 * Get both local regulations and city stats for a city
 */
export async function getLocalCityData(cityState: string): Promise<{
  regulations: LocalRegulations | null;
  stats: CityStats | null;
}> {
  try {
    const [regulations, stats] = await Promise.all([
      getLocalRegulations(cityState),
      getCityStats(cityState),
    ]);

    return { regulations, stats };
  } catch (error) {
    console.error('Error fetching local city data:', error);
    return { regulations: null, stats: null };
  }
}

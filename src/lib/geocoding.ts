import type {
  GeocodeResponse,
  GeocodeErrorResponse,
} from '../pages/api/geocode';
import { PRODUCTION_URL } from './url-utils';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Location {
  city: string;
  state: string;
  coordinates: Coordinates;
}

export class GeocodingError extends Error {
  constructor(message: string, public details?: Record<string, any>) {
    super(message);
    this.name = 'GeocodingError';
  }
}

// Cache for geocoding results
const geocodeCache = new Map<
  string,
  {
    data: Location;
    timestamp: number;
  }
>();

const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

export async function reverseGeocode(
  coordinates: Coordinates
): Promise<Location> {
  // Create cache key
  const cacheKey = `${coordinates.lat.toFixed(6)},${coordinates.lng.toFixed(
    6
  )}`;

  // Check cache
  const cached = geocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  // For static sites, we'll use a simple fallback approach
  // Since we can't make server calls, we'll return a generic location
  // In a real implementation, you'd want to use Google Maps Geocoding API client-side
  // or pre-generate a lookup table of coordinates to cities

  // Simple fallback - find nearest major city from coordinates
  const majorCities = [
    {
      city: 'New York',
      state: 'New York',
      coordinates: { lat: 40.7128, lng: -74.006 },
    },
    {
      city: 'Los Angeles',
      state: 'California',
      coordinates: { lat: 34.0522, lng: -118.2437 },
    },
    {
      city: 'Chicago',
      state: 'Illinois',
      coordinates: { lat: 41.8781, lng: -87.6298 },
    },
    {
      city: 'Houston',
      state: 'Texas',
      coordinates: { lat: 29.7604, lng: -95.3698 },
    },
    {
      city: 'Phoenix',
      state: 'Arizona',
      coordinates: { lat: 33.4484, lng: -112.074 },
    },
    {
      city: 'Philadelphia',
      state: 'Pennsylvania',
      coordinates: { lat: 39.9526, lng: -75.1652 },
    },
    {
      city: 'San Antonio',
      state: 'Texas',
      coordinates: { lat: 29.4241, lng: -98.4936 },
    },
    {
      city: 'San Diego',
      state: 'California',
      coordinates: { lat: 32.7157, lng: -117.1611 },
    },
    {
      city: 'Dallas',
      state: 'Texas',
      coordinates: { lat: 32.7767, lng: -96.797 },
    },
    {
      city: 'San Jose',
      state: 'California',
      coordinates: { lat: 37.3382, lng: -121.8863 },
    },
  ];

  const nearestCity = await findNearestCity(coordinates, majorCities);

  if (!nearestCity) {
    throw new GeocodingError('Could not determine location from coordinates');
  }

  const location = {
    city: nearestCity.city,
    state: nearestCity.state,
    coordinates: coordinates, // Use the original coordinates
  };

  // Cache the result
  geocodeCache.set(cacheKey, {
    data: location,
    timestamp: Date.now(),
  });

  return location;
}

export function calculateDistance(
  point1: Coordinates,
  point2: Coordinates
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(point2.lat - point1.lat);
  const dLon = toRad(point2.lng - point1.lng);
  const lat1 = toRad(point1.lat);
  const lat2 = toRad(point2.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

export async function findNearestCity(
  coordinates: Coordinates,
  cities: Location[]
): Promise<Location | null> {
  // console.log('Finding nearest city to:', coordinates);
  // console.log('Number of cities to search:', cities.length);

  if (!cities.length) {
    console.log('No cities provided to search through');
    return null;
  }

  let nearestCity = cities[0];
  let shortestDistance = calculateDistance(coordinates, cities[0].coordinates);
  // console.log('Initial city:', nearestCity, 'at distance:', shortestDistance);

  for (const city of cities.slice(1)) {
    const distance = calculateDistance(coordinates, city.coordinates);
    // console.log(
    //   'Checking city:',
    //   city.city,
    //   city.state,
    //   'at distance:',
    //   distance
    // );
    if (distance < shortestDistance) {
      shortestDistance = distance;
      nearestCity = city;
      // console.log(
      //   'New nearest city found:',
      //   city.city,
      //   city.state,
      //   'at distance:',
      //   distance
      // );
    }
  }

  // console.log(
  //   'Final nearest city:',
  //   nearestCity,
  //   'at distance:',
  //   shortestDistance
  // );
  return nearestCity;
}

export async function getCurrentLocation(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        let message = 'An unknown error occurred';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Please allow location access to use this feature';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Location information is unavailable';
            break;
          case error.TIMEOUT:
            message = 'Location request timed out';
            break;
        }
        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

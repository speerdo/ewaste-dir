import type {
  GeocodeResponse,
  GeocodeErrorResponse,
} from '../pages/api/geocode';

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

export async function reverseGeocode(
  coordinates: Coordinates
): Promise<Location> {
  // Always use the current origin to ensure API calls work in all environments
  const url = new URL('/api/geocode', window.location.origin);
  url.searchParams.set('lat', coordinates.lat.toFixed(6));
  url.searchParams.set('lng', coordinates.lng.toFixed(6));

  console.log('Geocoding request details:', {
    coordinates,
    constructedUrl: url.toString(),
    origin: window.location.origin,
    searchParams: Object.fromEntries(url.searchParams),
  });

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });

    // Log the full response details before parsing
    console.log('Raw response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers),
    });

    const data = await response.json();
    console.log('Response data:', data);

    if (!response.ok) {
      throw new GeocodingError(
        data.error || `HTTP error ${response.status}`,
        data.details
      );
    }

    // Validate the response data
    if (!data.city || !data.state || !data.coordinates) {
      throw new GeocodingError('Invalid response format', data);
    }

    return {
      city: data.city,
      state: data.state,
      coordinates: data.coordinates,
    };
  } catch (error) {
    if (error instanceof GeocodingError) {
      throw error;
    }
    throw new GeocodingError('Failed to fetch location data', {
      originalError: error instanceof Error ? error.message : String(error),
    });
  }
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
  console.log('Finding nearest city to:', coordinates);
  console.log('Number of cities to search:', cities.length);

  if (!cities.length) {
    console.log('No cities provided to search through');
    return null;
  }

  let nearestCity = cities[0];
  let shortestDistance = calculateDistance(coordinates, cities[0].coordinates);
  console.log('Initial city:', nearestCity, 'at distance:', shortestDistance);

  for (const city of cities.slice(1)) {
    const distance = calculateDistance(coordinates, city.coordinates);
    console.log(
      'Checking city:',
      city.city,
      city.state,
      'at distance:',
      distance
    );
    if (distance < shortestDistance) {
      shortestDistance = distance;
      nearestCity = city;
      console.log(
        'New nearest city found:',
        city.city,
        city.state,
        'at distance:',
        distance
      );
    }
  }

  console.log(
    'Final nearest city:',
    nearestCity,
    'at distance:',
    shortestDistance
  );
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

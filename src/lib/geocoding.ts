import type {
  GeocodeResponse,
  GeocodeErrorResponse,
} from '../pages/api/geocode';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface City {
  name: string;
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
): Promise<GeocodeResponse> {
  const params = new URLSearchParams({
    lat: coordinates.lat.toFixed(6),
    lng: coordinates.lng.toFixed(6),
  });

  const response = await fetch(`/api/geocode?${params.toString()}`);
  const data = await response.json();

  if (!response.ok || data.error) {
    throw new GeocodingError(data.error || 'Geocoding failed', data.details);
  }

  return data;
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

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export async function findNearestCity(
  coordinates: Coordinates,
  cities: City[]
): Promise<City | null> {
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
      city.name,
      city.state,
      'at distance:',
      distance
    );
    if (distance < shortestDistance) {
      shortestDistance = distance;
      nearestCity = city;
      console.log(
        'New nearest city found:',
        city.name,
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
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(
              new Error('Please allow location access to use this feature')
            );
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new Error('Location information is unavailable'));
            break;
          case error.TIMEOUT:
            reject(new Error('Location request timed out'));
            break;
          default:
            reject(new Error('An unknown error occurred'));
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

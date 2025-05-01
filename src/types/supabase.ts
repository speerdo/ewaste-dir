export interface RecyclingCenter {
  id: string;
  name: string;
  state_id: string;
  city_id: string;
  city: string;
  full_address: string;
  latitude: number;
  longitude: number;
  phone?: string;
  site?: string;
  working_hours?: string;
  rating?: number;
  reviews?: number;
  logo?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface City {
  id: string;
  state_id: string;
  name: string;
  description?: string;
  address?: string;
  lat?: number;
  lng?: number;
  image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface State {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  featured?: boolean;
  nearby_states?: string[];
  created_at?: string;
  updated_at?: string;
}

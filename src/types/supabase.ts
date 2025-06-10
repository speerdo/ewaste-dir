export interface RecyclingCenter {
  id: string;
  name: string;
  state_id: string;
  city_id: string;
  city: string;
  state: string;
  full_address: string;
  postal_code?: number;
  latitude: number;
  longitude: number;
  phone?: string;
  site?: string;
  working_hours?: string;
  rating?: number;
  reviews?: number;
  logo?: string;
  photo?: string;
  description?: string;
  accepted_items?: string;
  created_at?: string;
  updated_at?: string;
  matched?: boolean;
  legitimacy_score?: number;
  legitimacy_reason?: string;
  is_legitimate?: boolean;
  is_suspicious?: boolean;
  scraped_at?: string;
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

export interface LocalRegulations {
  id: string;
  city_state: string;
  state_code: string;
  city_name: string;
  has_ewaste_ban: boolean;
  landfill_restrictions?: string;
  battery_regulations?: string;
  tv_computer_rules?: string;
  business_requirements?: string;
  penalties_fines?: string;
  municipal_programs?: string;
  special_events?: string;
  drop_off_locations?: string;
  environmental_benefits?: string;
  government_website?: string;
  recycling_hotline?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CityStats {
  id: string;
  city_state: string;
  population: number;
  recycling_rate: string;
  ewaste_per_capita: number;
  co2_savings_lbs: number;
  metals_recovered_lbs: number;
  plastics_recycled_lbs: number;
  jobs_supported: number;
  economic_impact_dollars: number;
  created_at?: string;
  updated_at?: string;
}

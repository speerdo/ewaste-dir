export interface StateInfo {
  id: string;
  state_code: string;
  state_name: string;
  description: string;
  image_url: string | null;
  image_alt: string | null;
  created_at: string;
  updated_at: string;
}

export interface StateData {
  stateCode: string;
  stateName: string;
  description: string;
  imageUrl?: string;
  imageAlt?: string;
}

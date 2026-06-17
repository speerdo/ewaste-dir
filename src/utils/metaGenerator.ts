import type { RecyclingCenter } from '../types/supabase';

const STATE_ABBR: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO',
  montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH',
  oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
  'district of columbia': 'DC',
};

function getStateAbbr(state: string): string {
  const abbr = STATE_ABBR[state.toLowerCase().trim()];
  if (abbr) return abbr;
  // Fallback: take first letters of each word and uppercase.
  return state
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

export function buildStateTitle(state: string): string {
  // Prefer concise title: E-Waste Recycling in {State} | RecycleOldTech
  const title = `E-Waste Recycling in ${state} | RecycleOldTech`;
  if (title.length <= 55) return title;
  // For long state names (e.g. District of Columbia), replace with abbreviation + label
  return `E-Waste Recycling in ${state} | Recycle`;
}

interface MetaData {
  title: string;
  description: string;
  keywords: string;
}

interface CityMetaProps {
  cityName: string;
  state: string;
  centers: RecyclingCenter[];
  localData?: {
    regulations?: any;
    stats?: any;
  };
  showNearbyMessage?: boolean;
}

export function generateCityMeta({
  cityName,
  state,
  centers,
  localData,
  showNearbyMessage,
}: CityMetaProps): MetaData {
  const centerCount = centers.length;
  const centerWord = centerCount === 1 ? 'Center' : 'Centers';

  // Analyze centers for unique selling points
  const topRated = centers
    .filter((c) => c.rating && Number(c.rating) > 0)
    .sort((a, b) => Number(b.rating) - Number(a.rating))[0];

  const cityGov = centers.find(
    (c) =>
      c.name.toLowerCase().includes('city') ||
      c.name.toLowerCase().includes('municipal') ||
      c.name.toLowerCase().includes('public works')
  );

  const chains = centers.filter((c) =>
    ['best buy', 'staples', 'goodwill', 'waste management'].some((chain) =>
      c.name.toLowerCase().includes(chain)
    )
  );

  const withHours = centers.filter((c) => c.working_hours);

  // Use a single, concise city title pattern to stay under ~55 chars
  // E.g. "E-Waste Recycling in Phoenix, AZ | 39 Centers" (46 chars)
  const stateAbbr = getStateAbbr(state);
  let title = `E-Waste Recycling in ${cityName}, ${stateAbbr} | ${centerCount} ${centerWord}`;
  if (title.length > 55) {
    title = `E-Waste Recycling in ${cityName}, ${stateAbbr} | ${centerCount}`;
  }

  // Select title based on city name hash to ensure consistency but variety
  const cityHash = cityName.split('').reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);

  // Generate compelling, unique descriptions
  const descriptionElements = [];

  // Opening statement
  if (showNearbyMessage) {
    descriptionElements.push(
      `Find electronics recycling near ${cityName}, ${state} with ${centerCount} area facilities`
    );
  } else if (centerCount === 1) {
    descriptionElements.push(
      `Electronics recycling in ${cityName} with professional e-waste disposal services`
    );
  } else {
    descriptionElements.push(
      `Find ${centerCount} certified electronics recycling ${centerWord.toLowerCase()} in ${cityName}, ${state}`
    );
  }

  // Add unique selling points
  const sellingPoints = [];
  if (topRated) {
    sellingPoints.push(`top-rated services (${topRated.rating}★)`);
  }
  if (cityGov) {
    sellingPoints.push('city-operated facility');
  }
  if (chains.length > 0) {
    sellingPoints.push('retail drop-off locations');
  }
  if (localData?.regulations?.has_ewaste_ban) {
    sellingPoints.push('compliant with state e-waste laws');
  }
  if (withHours.length > centerCount * 0.5) {
    sellingPoints.push('posted hours available');
  }

  if (sellingPoints.length > 0) {
    descriptionElements.push(
      ` featuring ${sellingPoints.slice(0, 2).join(' & ')}`
    );
  }

  // Add services
  descriptionElements.push(
    '. Safe disposal of computers, phones, TVs & electronics'
  );

  // Add local context if available
  if (localData?.stats?.population) {
    descriptionElements.push(
      ` serving ${Math.round(localData.stats.population / 1000)}K+ residents`
    );
  }

  // Add call to action
  const ctaVariations = [
    '. Get directions, hours & contact info',
    '. Find locations, hours & accepted items',
    '. Compare services, ratings & fees',
    '. View locations, contact info & reviews',
  ];
  const ctaIndex = Math.abs(cityHash) % ctaVariations.length;
  descriptionElements.push(ctaVariations[ctaIndex]);

  const description = descriptionElements.join('');

  // Ensure description is within optimal length (150-155 characters for city pages)
  let finalDescription = description;
  if (description.length > 155) {
    // Trim to fit under 155 chars, preserving complete words
    finalDescription =
      description.substring(0, 152).replace(/\s+\S*$/, '') + '...';
  } else if (description.length < 150) {
    // Add more context if too short
    const additions = [];
    if (localData?.regulations?.has_ewaste_ban) {
      additions.push(' Required by state law');
    }
    if (localData?.stats?.recycling_rate) {
      additions.push(` ${localData.stats.recycling_rate} recycling rate`);
    }
    if (chains.length > 0) {
      additions.push(' Retail chains available');
    }

    // Add additions until we reach the minimum length
    for (const addition of additions) {
      if (finalDescription.length + addition.length <= 155) {
        finalDescription += addition;
        if (finalDescription.length >= 150) break;
      }
    }
  }

  // Generate keywords
  const keywords = [
    'electronics recycling',
    `${cityName} recycling`,
    'e-waste disposal',
    'computer recycling',
    'phone recycling',
    'TV recycling',
    `${state} electronics recycling`,
    'certified recycler',
    'data destruction',
  ];

  // Add location-specific keywords
  if (cityGov) keywords.push('municipal recycling', 'city recycling program');
  if (chains.length > 0)
    keywords.push('retail recycling', 'drop-off locations');
  if (localData?.regulations?.has_ewaste_ban)
    keywords.push('e-waste laws', 'legal disposal');

  // Ensure city title stays under 55 characters
  return {
    title: title.length > 55 ? title.substring(0, 52) + '...' : title,
    description: finalDescription,
    keywords: keywords.slice(0, 10).join(', '),
  };
}

export function generateStateMeta(
  state: string,
  cityCount: number,
  centerCount: number
): MetaData {
  // Concise title pattern to stay under ~55 characters
  // E.g. "E-Waste Recycling in Colorado | RecycleOldTech"
  const title = `E-Waste Recycling in ${state} | RecycleOldTech`;

  // Keep a hash for description/keyword variation
  const stateHash = state.split('').reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);

  let description = `Find ${centerCount} electronics recycling centers across ${cityCount} cities in ${state}. Safe disposal of computers, phones, TVs & e-waste. Certified facilities with secure data destruction services.`;

  // Ensure state description stays under 155 characters
  if (description.length > 155) {
    description = description.substring(0, 152).replace(/\s+\S*$/, '') + '...';
  }

  const keywords = [
    `${state} electronics recycling`,
    'e-waste disposal',
    'computer recycling',
    'electronics recycling centers',
    `${state} recycling directory`,
    'certified recyclers',
    'data destruction',
  ];

  return {
    title: title.length > 55 ? title.substring(0, 52) + '...' : title,
    description,
    keywords: keywords.join(', '),
  };
}

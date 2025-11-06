import type { RecyclingCenter } from '../types/supabase';

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
  const centerWord = centerCount === 1 ? 'center' : 'centers';

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

  // Generate title variations to avoid repetition
  const titleVariations = [
    `Electronics Recycling Centers in ${cityName}, ${state}`,
    `${cityName} Electronics Recycling & E-Waste Disposal`,
    `Computer & Phone Recycling in ${cityName}, ${state}`,
    `Safe Electronics Disposal in ${cityName}, ${state}`,
    `${cityName} E-Waste Recycling Centers & Services`,
  ];

  // Add unique elements to title based on what's special about this city
  let titleModifier = '';
  if (centerCount > 15) {
    titleModifier = ` - ${centerCount} Locations`;
  } else if (topRated && Number(topRated.rating) >= 4.5) {
    titleModifier = ` - Top-Rated Services`;
  } else if (cityGov) {
    titleModifier = ` - City & Private Options`;
  } else if (centerCount === 1) {
    titleModifier = ` - Local Drop-Off`;
  }

  // Select title based on city name hash to ensure consistency but variety
  const cityHash = cityName.split('').reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);
  const titleIndex = Math.abs(cityHash) % titleVariations.length;
  const title = titleVariations[titleIndex] + titleModifier;

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
      `${centerCount} electronics recycling ${centerWord} in ${cityName}, ${state}`
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

  // Ensure description is within optimal length (150-160 characters)
  let finalDescription = description;
  if (description.length > 160) {
    // Trim to fit, preserving complete words
    finalDescription =
      description.substring(0, 157).replace(/\s+\S*$/, '') + '...';
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
      if (finalDescription.length + addition.length <= 160) {
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

  return {
    title: title.length > 60 ? title.substring(0, 57) + '...' : title,
    description: finalDescription,
    keywords: keywords.slice(0, 10).join(', '),
  };
}

export function generateStateMeta(
  state: string,
  cityCount: number,
  centerCount: number
): MetaData {
  const titleVariations = [
    `Electronics Recycling Centers in ${state}`,
    `${state} E-Waste Recycling Directory`,
    `Computer & Electronics Recycling in ${state}`,
    `${state} Electronics Disposal Centers`,
  ];

  // Use state name hash for consistent but varied titles
  const stateHash = state.split('').reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);
  const titleIndex = Math.abs(stateHash) % titleVariations.length;

  const title = `${titleVariations[titleIndex]} - ${centerCount} Locations`;

  let description = `Find ${centerCount} electronics recycling centers across ${cityCount} cities in ${state}. Safe disposal of computers, phones, TVs & e-waste. Certified facilities with secure data destruction services.`;

  // Ensure state description is also 150-160 characters
  if (description.length < 150) {
    description +=
      ' Compliant with state regulations & environmental standards for proper disposal of electronic waste items.';
  }
  if (description.length > 160) {
    description = description.substring(0, 157) + '...';
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
    title: title.length > 60 ? title.substring(0, 57) + '...' : title,
    description,
    keywords: keywords.join(', '),
  };
}

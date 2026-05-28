import type { RecyclingCenter } from '../types/supabase';

const SCHEMA_BUSINESS_LIMIT = 25;
const SCHEMA_DESCRIPTION_MAX = 160;

const DAY_ORDER = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const DAY_MAP: Record<string, string> = {
  monday: 'Mo', tuesday: 'Tu', wednesday: 'We', thursday: 'Th',
  friday: 'Fr', saturday: 'Sa', sunday: 'Su',
};

function truncate(text: string | null | undefined, max: number): string | undefined {
  if (!text?.trim()) return undefined;
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

function convertTimeFormat(timeStr: string): string | undefined {
  if (!timeStr) return undefined;
  if (/24\/7|24 hours/i.test(timeStr)) return '00:00-24:00';
  const match = timeStr.match(/(\d{1,2}):?(\d{0,2})\s*(AM|PM)?\s*[-–]\s*(\d{1,2}):?(\d{0,2})\s*(AM|PM)?/i);
  if (!match) return timeStr;
  let [, sh, sm = '00', sp = '', eh, em = '00', ep = ''] = match;
  let s = parseInt(sh), e = parseInt(eh);
  if (sp.toUpperCase() === 'PM' && s !== 12) s += 12;
  if (sp.toUpperCase() === 'AM' && s === 12) s = 0;
  if (ep.toUpperCase() === 'PM' && e !== 12) e += 12;
  if (ep.toUpperCase() === 'AM' && e === 12) e = 0;
  return `${s.toString().padStart(2, '0')}:${sm.padStart(2, '0')}-${e.toString().padStart(2, '0')}:${em.padStart(2, '0')}`;
}

function groupConsecutiveDays(days: string[]): string {
  if (days.length === 0) return '';
  if (days.length === 1) return days[0];
  const groups: string[] = [];
  let run = [days[0]];
  for (let i = 1; i < days.length; i++) {
    if (DAY_ORDER.indexOf(days[i]) === DAY_ORDER.indexOf(days[i - 1]) + 1) {
      run.push(days[i]);
    } else {
      groups.push(run.length >= 3 ? `${run[0]}-${run[run.length - 1]}` : run.join(','));
      run = [days[i]];
    }
  }
  groups.push(run.length >= 3 ? `${run[0]}-${run[run.length - 1]}` : run.join(','));
  return groups.join(',');
}

function formatOpeningHours(workingHours: unknown): string | undefined {
  if (!workingHours) return undefined;
  if (typeof workingHours === 'string') {
    if (/24\/7|24 hours/i.test(workingHours)) return 'Mo-Su 00:00-24:00';
    return workingHours;
  }
  if (typeof workingHours === 'object') {
    try {
      const hoursTodays: Record<string, string[]> = {};
      for (const [day, hours] of Object.entries(workingHours as Record<string, unknown>)) {
        if (typeof hours !== 'string' || !hours.trim()) continue;
        if (/closed/i.test(hours)) continue;
        const dayCode = DAY_MAP[day.toLowerCase()];
        if (!dayCode) continue;
        const converted = convertTimeFormat(hours);
        if (!converted) continue;
        (hoursTodays[converted] ??= []).push(dayCode);
      }
      const schedules = Object.entries(hoursTodays).map(([hours, days]) => {
        const sorted = days.sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
        return `${groupConsecutiveDays(sorted)} ${hours}`;
      });
      return schedules.length > 0 ? schedules.join(', ') : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Compact LocalBusiness nodes for JSON-LD — only visible centers, capped count, short fields.
 */
export function buildLocalBusinessGraph(
  centers: RecyclingCenter[],
  cityName: string,
  stateName: string
): Record<string, unknown>[] {
  return centers.slice(0, SCHEMA_BUSINESS_LIMIT).map((center) => {
    const business: Record<string, unknown> = {
      '@type': 'LocalBusiness',
      name: center.name,
      address: {
        '@type': 'PostalAddress',
        streetAddress: center.full_address || '',
        addressLocality: cityName,
        addressRegion: stateName,
        addressCountry: 'US',
      },
      telephone: center.phone || undefined,
      url: center.site || undefined,
      image: center.logo || center.photo || undefined,
      geo:
        center.latitude && center.longitude
          ? {
              '@type': 'GeoCoordinates',
              latitude: center.latitude,
              longitude: center.longitude,
            }
          : undefined,
      openingHours: formatOpeningHours(center.working_hours),
      aggregateRating: center.rating
        ? {
            '@type': 'AggregateRating',
            ratingValue: center.rating,
            reviewCount: center.reviews || 1,
          }
        : undefined,
      description: truncate(center.description, SCHEMA_DESCRIPTION_MAX),
    };

    Object.keys(business).forEach((key) => {
      if (business[key] === undefined) delete business[key];
    });

    return business;
  });
}

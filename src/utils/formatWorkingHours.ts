/**
 * Format working hours for display. Handles multiple formats:
 * - Simple string (e.g. "24/7", "Mon-Fri 9am-5pm")
 * - Object with day keys: { Monday: "9:00 AM – 5:00 PM", ... }
 * - Google Places format: { periods: [...], weekday_descriptions: ["Monday: 9:00 AM – 5:00 PM", ...] }
 */
export function formatWorkingHours(hours: unknown): string {
  if (!hours) return 'Hours not available';
  if (typeof hours === 'string') {
    if (hours === '24/7') return 'Open 24/7';
    return hours;
  }

  try {
    let parsed: unknown = hours;
    if (typeof hours === 'string') {
      parsed = JSON.parse(hours);
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return String(hours);
    }

    const obj = parsed as Record<string, unknown>;

    // Claim approvals store free-form hours as { "text": "Mon–Fri …" }
    const textField = obj.text;
    if (typeof textField === 'string' && textField.trim()) {
      return textField.trim();
    }

    // Google Places format: use weekday_descriptions (or camelCase variant) when available
    const weekdayDescriptions = obj.weekday_descriptions ?? obj.weekdayDescriptions;
    if (Array.isArray(weekdayDescriptions) && weekdayDescriptions.length > 0) {
      return weekdayDescriptions
        .filter((d): d is string => typeof d === 'string')
        .join('\n');
    }

    // Object with day names as keys (e.g. { Monday: "9:00 AM – 5:00 PM", ... })
    const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dayKeys = Object.keys(obj).filter((k) => daysOrder.includes(k));
    if (dayKeys.length > 0) {
      return dayKeys
        .sort((a, b) => daysOrder.indexOf(a) - daysOrder.indexOf(b))
        .map((day) => {
          const time = obj[day];
          const timeStr = typeof time === 'string' ? time : String(time ?? '');
          return `${day}: ${timeStr}`;
        })
        .join('\n');
    }

    // Skip 'periods' and other non-day keys - don't stringify objects
    return 'Hours not available';
  } catch {
    return 'Hours not available';
  }
}

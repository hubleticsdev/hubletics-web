// Timezone utilities
export const DEFAULT_TIMEZONE = 'America/Chicago';

export function getTimezoneFromLocation(location?: { state?: string }): string {
  if (!location?.state) return DEFAULT_TIMEZONE;

  const stateTimezoneMap: Record<string, string> = {
    'AL': 'America/New_York', 'CT': 'America/New_York', 'DE': 'America/New_York',
    'FL': 'America/New_York', 'GA': 'America/New_York', 'IN': 'America/New_York',
    'KY': 'America/New_York', 'ME': 'America/New_York', 'MD': 'America/New_York',
    'MA': 'America/New_York', 'MI': 'America/New_York', 'NH': 'America/New_York',
    'NJ': 'America/New_York', 'NY': 'America/New_York', 'NC': 'America/New_York',
    'OH': 'America/New_York', 'PA': 'America/New_York', 'RI': 'America/New_York',
    'SC': 'America/New_York', 'VT': 'America/New_York', 'VA': 'America/New_York',
    'WV': 'America/New_York', 'DC': 'America/New_York',

    'AR': 'America/Chicago', 'IL': 'America/Chicago', 'IA': 'America/Chicago',
    'KS': 'America/Chicago', 'LA': 'America/Chicago', 'MN': 'America/Chicago',
    'MS': 'America/Chicago', 'MO': 'America/Chicago', 'NE': 'America/Chicago',
    'ND': 'America/Chicago', 'OK': 'America/Chicago', 'SD': 'America/Chicago',
    'TN': 'America/Chicago', 'TX': 'America/Chicago', 'WI': 'America/Chicago',

    'AZ': 'America/Denver', 'CO': 'America/Denver', 'ID': 'America/Denver',
    'MT': 'America/Denver', 'NM': 'America/Denver', 'UT': 'America/Denver',
    'WY': 'America/Denver',

    'CA': 'America/Los_Angeles', 'NV': 'America/Los_Angeles', 'OR': 'America/Los_Angeles',
    'WA': 'America/Los_Angeles',

    'AK': 'America/Anchorage',

    'HI': 'Pacific/Honolulu',
  };

  return stateTimezoneMap[location.state] || DEFAULT_TIMEZONE;
}

export function formatBookingDateTime(date: Date, timezone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
    timeZoneName: 'short',
  }).format(date);
}

export function formatTimeRange(start: Date, end: Date, timezone: string = DEFAULT_TIMEZONE): string {
  const startTime = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  }).format(start);

  const endTime = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  }).format(end);

  return `${startTime} - ${endTime}`;
}

export function formatDateWithTimezone(date: Date, timezone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
    timeZoneName: 'short',
  }).format(date);
}

export function formatTimeOnly(date: Date, timezone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  }).format(date);
}

export function formatDateOnly(date: Date, timezone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: timezone,
  }).format(date);
}


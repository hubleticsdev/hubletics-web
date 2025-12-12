export interface Violation {
  type: string;
  matches: string[];
  severity: 'low' | 'medium' | 'high';
}

export interface FilterResult {
  isSafe: boolean;
  violations: Violation[];
  flaggedContent: string[];
}

const FILTERS = {
  phoneNumber: {
    pattern: /((\+\d{1,3}[\s-]?)?(\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4})|(\d[\s\-._]*){10,}/g,
    severity: 'high' as const,
    description: 'Phone numbers',
  },
  email: {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    severity: 'medium' as const,
    description: 'Email addresses',
  },
  socialMedia: {
    pattern: /@[\w]+|snapchat|instagram|whatsapp|telegram|discord|facebook|twitter|tiktok/gi,
    severity: 'medium' as const,
    description: 'Social media references',
  },
  urls: {
    pattern: /(?:https?:\/\/)?(?:www\.)?[\w-]+\.[\w.]+/gi,
    severity: 'medium' as const,
    description: 'URLs and links',
  },
} as const;

export function checkMessageContent(content: string): FilterResult {
  const violations: Violation[] = [];
  const flaggedContent: string[] = [];

  for (const [filterName, filter] of Object.entries(FILTERS)) {
    const matches = content.match(filter.pattern);
    if (matches && matches.length > 0) {
      violations.push({
        type: filterName,
        matches,
        severity: filter.severity,
      });
      flaggedContent.push(...matches);
    }
  }

  const isSafe = violations.length === 0;

  return {
    isSafe,
    violations,
    flaggedContent: [...new Set(flaggedContent)],
  };
}

export function shouldFlagMessage(content: string): boolean {
  const result = checkMessageContent(content);
  return !result.isSafe;
}

export function getViolationTypes(content: string): string[] {
  const result = checkMessageContent(content);
  return result.violations.map(v => v.type);
}

export function hasHighSeverityViolation(content: string): boolean {
  const result = checkMessageContent(content);
  return result.violations.some(v => v.severity === 'high');
}

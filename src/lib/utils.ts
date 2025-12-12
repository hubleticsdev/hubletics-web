import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import sanitizeHtmlLib from 'sanitize-html';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isValidUploadThingUrl(url: string): boolean {
  const validHosts = ['uploadthing.com', 'utfs.io'];
  try {
    const parsedUrl = new URL(url);
    return validHosts.includes(parsedUrl.hostname);
  } catch {
    return false;
  }
}

export function sanitizeHtml(dirty: string): string {
  return sanitizeHtmlLib(dirty, {
    allowedTags: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'blockquote', 'code', 'pre'
    ],
    allowedAttributes: {},
    allowVulnerableTags: false,
  });
}

export function sanitizeText(dirty: string): string {
  return sanitizeHtmlLib(dirty, {
    allowedTags: [],
    allowedAttributes: {},
  });
}

export function sanitizeName(dirty: string): string {
  return sanitizeHtmlLib(dirty, {
    allowedTags: [],
    allowedAttributes: {},
    allowVulnerableTags: false,
  });
}

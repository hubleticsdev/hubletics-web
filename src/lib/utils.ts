import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import xss from 'xss';

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
  return xss(dirty, {
    whiteList: {
      p: [],
      br: [],
      strong: [],
      b: [],
      em: [],
      i: [],
      u: [],
      h1: [],
      h2: [],
      h3: [],
      h4: [],
      h5: [],
      h6: [],
      ul: [],
      ol: [],
      li: [],
      blockquote: [],
      code: [],
      pre: []
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed']
  });
}

export function sanitizeText(dirty: string): string {
  return xss(dirty, {
    whiteList: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed']
  });
}

export function sanitizeName(dirty: string): string {
  return xss(dirty, {
    whiteList: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed']
  });
}

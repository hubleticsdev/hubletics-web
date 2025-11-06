import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

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

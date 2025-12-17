import { UTApi } from 'uploadthing/server';
import { env } from '@/lib/env';

// Extract fileKey from UploadThing URL
export function extractFileKeyFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    
    if (!urlObj.hostname.includes('utfs.io') && !urlObj.hostname.includes('ufs.sh')) {
      return null;
    }
    
    const match = urlObj.pathname.match(/^\/f\/(.+)$/);
    if (match && match[1]) {
      return match[1];
    }
    
    return null;
  } catch {
    return null;
  }
}

// Delete a file from UploadThing by URL
export async function deleteUploadThingFile(url: string): Promise<boolean> {
  const fileKey = extractFileKeyFromUrl(url);
  
  if (!fileKey) {
    return true;
  }
  
  try {
    const utapi = new UTApi();
    await utapi.deleteFiles(fileKey);
    return true;
  } catch (error) {
    console.error('Failed to delete UploadThing file:', error);
    return false;
  }
}

// Delete multiple files from UploadThing by URLs
export async function deleteUploadThingFiles(urls: string[]): Promise<void> {
  const fileKeys = urls
    .map(url => extractFileKeyFromUrl(url))
    .filter((key): key is string => key !== null);
  
  if (fileKeys.length === 0) {
    return;
  }
  
  try {
    const utapi = new UTApi();
    await utapi.deleteFiles(fileKeys);
  } catch (error) {
    console.error('Failed to delete UploadThing files:', error);
  }
}

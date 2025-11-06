'use server';

import { db } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { isValidUploadThingUrl } from '@/lib/utils';

export async function saveTempPhoto(photoUrl: string): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  if (!isValidUploadThingUrl(photoUrl)) {
    throw new Error('Invalid file URL - must be from UploadThing');
  }

  await db
    .update(user)
    .set({ onboardingPhotoUrl: photoUrl })
    .where(eq(user.id, session.user.id));
}

export async function saveTempVideo(videoUrl: string): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  if (!isValidUploadThingUrl(videoUrl)) {
    throw new Error('Invalid file URL - must be from UploadThing');
  }

  await db
    .update(user)
    .set({ onboardingVideoUrl: videoUrl })
    .where(eq(user.id, session.user.id));
}

export async function clearTempFiles(): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await db
    .update(user)
    .set({
      onboardingPhotoUrl: null,
      onboardingVideoUrl: null,
    })
    .where(eq(user.id, session.user.id));
}

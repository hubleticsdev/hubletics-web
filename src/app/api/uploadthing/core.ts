import { createUploadthing, type FileRouter } from 'uploadthing/next';
import { getSessionFromRequest } from '@/lib/auth/session';

const f = createUploadthing();

export const ourFileRouter = {
  // Profile images for both athletes and coaches
  profileImage: f({ image: { maxFileSize: '4MB', maxFileCount: 1 } })
    .middleware(async ({ req }) => {
      // Using cached session helper - prevents duplicate queries!
      const session = await getSessionFromRequest(req);

      if (!session) throw new Error('Unauthorized');

      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log('Profile image upload complete for userId:', metadata.userId);
      console.log('File URL:', file.ufsUrl);

      return { uploadedBy: metadata.userId, url: file.ufsUrl };
    }),

  // Coach intro videos (max 50MB as per spec)
  coachIntroVideo: f({ video: { maxFileSize: '64MB', maxFileCount: 1 } })
    .middleware(async ({ req }) => {
      // Using cached session helper
      const session = await getSessionFromRequest(req);

      if (!session) throw new Error('Unauthorized');
      if (session.user.role !== 'coach') throw new Error('Only coaches can upload intro videos');

      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log('Coach intro video upload complete for userId:', metadata.userId);
      console.log('File URL:', file.ufsUrl);

      return { uploadedBy: metadata.userId, url: file.ufsUrl };
    }),

  // Coach certification PDFs
  coachCertification: f({ pdf: { maxFileSize: '8MB', maxFileCount: 1 } })
    .middleware(async ({ req }) => {
      // Using cached session helper
      const session = await getSessionFromRequest(req);

      if (!session) throw new Error('Unauthorized');
      if (session.user.role !== 'coach') throw new Error('Only coaches can upload certifications');

      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log('Coach certification upload complete for userId:', metadata.userId);
      console.log('File URL:', file.ufsUrl);

      return { uploadedBy: metadata.userId, url: file.ufsUrl };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { env } from '@/lib/env';
import { sendEmail } from '@/lib/email/resend';
import {
  getVerificationEmailTemplate,
  getPasswordResetEmailTemplate,
} from '@/lib/email/templates';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      const template = getPasswordResetEmailTemplate({
        userName: user.name,
        resetUrl: url,
      });

      await sendEmail({
        to: user.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
    },
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      const template = getVerificationEmailTemplate({
        userName: user.name,
        verificationUrl: url,
      });

      await sendEmail({
        to: user.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
    },
  },

  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },

  // User schema extensions are already in our database schema
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: true,
        defaultValue: 'pending',
        input: false, // Role should not be set during signup - users select after account creation
      },
      status: {
        type: 'string',
        required: true,
        defaultValue: 'active',
        input: false,
      },
      profileComplete: {
        type: 'boolean',
        required: true,
        defaultValue: false,
        input: false,
      },
      lastLoginAt: {
        type: 'date',
        required: false,
      },
      deletedAt: {
        type: 'date',
        required: false,
      },
      deletedBy: {
        type: 'string',
        required: false,
      },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
  },

  // No session callback needed - profileComplete is now stored in the user table
  // This eliminates the extra DB query on every session fetch

  // Rate limiting (in-memory, Vercel-compatible)
  rateLimit: {
    enabled: true,
    window: 60, // 1 minute
    max: 10, // 10 requests per window
  },

  advanced: {
    useSecureCookies: env.NODE_ENV === 'production',
    crossSubDomainCookies: {
      enabled: false,
    },
  },

  // Database hooks for tracking last login
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          // Update lastLoginAt when session is created
          const { eq } = await import('drizzle-orm');
          await db
            .update(user)
            .set({ lastLoginAt: new Date() })
            .where(eq(user.id, session.userId));
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user & {
  profileComplete?: boolean;
};

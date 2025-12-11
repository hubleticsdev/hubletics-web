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

  user: {
    additionalFields: {
      username: {
        type: 'string',
        required: true,
        input: false,
      },
      role: {
        type: 'string',
        required: true,
        defaultValue: 'pending',
        input: false,
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
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 30,
    }
  },

  rateLimit: {
    enabled: true,
    window: 60,
    max: 10,
  },

  advanced: {
    useSecureCookies: env.NODE_ENV === 'production',
    crossSubDomainCookies: {
      enabled: false,
    },
  },

  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
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

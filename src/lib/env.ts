import { z } from 'zod';

const serverSchema = z.object({
  DATABASE_URL: z.string().url().min(1, 'DATABASE_URL is required'),
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  BETTER_AUTH_URL: z.string().url().min(1, 'BETTER_AUTH_URL is required'),
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),

  STRIPE_SECRET_KEY: z.string().startsWith('sk_', 'STRIPE_SECRET_KEY must start with sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_', 'STRIPE_WEBHOOK_SECRET must start with whsec_'),

  RESEND_API_KEY: z.string().startsWith('re_', 'RESEND_API_KEY must start with re_'),

  UPLOADTHING_TOKEN: z.string().min(1, 'UPLOADTHING_TOKEN is required'),

  PUSHER_APP_ID: z.string().min(1, 'PUSHER_APP_ID is required'),
  PUSHER_SECRET: z.string().min(1, 'PUSHER_SECRET is required'),

  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().min(1, 'NEXT_PUBLIC_APP_URL is required'),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z
    .string()
    .startsWith('pk_', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must start with pk_'),
  NEXT_PUBLIC_PUSHER_KEY: z.string().min(1, 'NEXT_PUBLIC_PUSHER_KEY is required'),
  NEXT_PUBLIC_PUSHER_CLUSTER: z.string().min(1, 'NEXT_PUBLIC_PUSHER_CLUSTER is required'),
});

const envSchema = serverSchema.merge(clientSchema);

function validateServerEnv() {
  if (typeof window !== 'undefined') {
    return {} as z.infer<typeof envSchema>;
  }

  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(JSON.stringify(parsed.error.format(), null, 2));
    throw new Error('Invalid environment variables');
  }

  return parsed.data;
}

export const env = validateServerEnv();

export type Env = typeof env;

export const clientEnv = {
  get APP_URL() {
    const value = process.env.NEXT_PUBLIC_APP_URL;
    if (!value) {
      throw new Error('NEXT_PUBLIC_APP_URL is not defined');
    }
    return value;
  },
  get STRIPE_PUBLISHABLE_KEY() {
    const value = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!value) {
      throw new Error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not defined');
    }
    return value;
  },
  get PUSHER_KEY() {
    const value = process.env.NEXT_PUBLIC_PUSHER_KEY;
    if (!value) {
      throw new Error('NEXT_PUBLIC_PUSHER_KEY is not defined');
    }
    return value;
  },
  get PUSHER_CLUSTER() {
    const value = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!value) {
      throw new Error('NEXT_PUBLIC_PUSHER_CLUSTER is not defined');
    }
    return value;
  },
} as const;

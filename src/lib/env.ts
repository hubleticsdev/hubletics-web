/**
 * Environment variable validation using Zod
 *
 * This ensures all required environment variables are present and valid
 * at application startup, preventing runtime errors from misconfiguration.
 *
 * Usage:
 * - Import { env } from '@/lib/env'
 * - Access validated variables: env.DATABASE_URL, env.GOOGLE_CLIENT_ID, etc.
 */

import { z } from 'zod';

/**
 * Server-side environment variables schema
 * These should NEVER be exposed to the client
 */
const serverSchema = z.object({
  // Database
  DATABASE_URL: z.string().url().min(1, 'DATABASE_URL is required'),

  // Auth
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  BETTER_AUTH_URL: z.string().url().min(1, 'BETTER_AUTH_URL is required'),
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),

  // Stripe
  STRIPE_SECRET_KEY: z.string().startsWith('sk_', 'STRIPE_SECRET_KEY must start with sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_', 'STRIPE_WEBHOOK_SECRET must start with whsec_'),

  // Email
  RESEND_API_KEY: z.string().startsWith('re_', 'RESEND_API_KEY must start with re_'),

  // File uploads
  UPLOADTHING_TOKEN: z.string().min(1, 'UPLOADTHING_TOKEN is required'),

  // Node environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

/**
 * Client-side environment variables schema
 * These are safe to expose to the browser (prefixed with NEXT_PUBLIC_)
 */
const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().min(1, 'NEXT_PUBLIC_APP_URL is required'),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z
    .string()
    .startsWith('pk_', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must start with pk_'),
});

/**
 * Combined schema for validation
 */
const envSchema = serverSchema.merge(clientSchema);

/**
 * Validate server-side environment variables
 * Only runs on the server
 */
function validateServerEnv() {
  // Skip validation on the client
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

/**
 * Validated environment variables (server-only)
 * Use this instead of process.env to ensure type safety and validation
 *
 * IMPORTANT: Only import this in server-side code!
 */
export const env = validateServerEnv();

/**
 * Type-safe environment variable access
 * This type can be used throughout the application
 */
export type Env = typeof env;

/**
 * Client-safe environment variables
 * Only includes NEXT_PUBLIC_ prefixed variables
 * Safe to import in both server and client code
 *
 * These are accessed directly from process.env in Next.js
 * because NEXT_PUBLIC_ variables are automatically injected at build time
 */
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
} as const;

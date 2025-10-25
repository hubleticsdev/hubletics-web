import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields } from 'better-auth/client/plugins';
import { clientEnv } from '@/lib/env';
import type { auth } from '@/lib/auth';

export const authClient = createAuthClient({
  baseURL: clientEnv.APP_URL,
  plugins: [inferAdditionalFields<typeof auth>()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
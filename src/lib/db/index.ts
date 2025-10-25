import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Create the Neon HTTP client (uses connection pooling)
const sql = neon(process.env.DATABASE_URL);

// Create Drizzle instance with schema
export const db = drizzle(sql, {
  schema,
  logger: process.env.NODE_ENV === 'development',
});

// Export types
export type Database = typeof db;
export { schema };

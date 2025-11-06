// Transaction utilities for Vercel serverless environment with Neon
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';
import ws from 'ws';

interface TransactionDatabase {
  insert: ReturnType<typeof drizzle>['insert'];
  update: ReturnType<typeof drizzle>['update'];
  delete: ReturnType<typeof drizzle>['delete'];
  select: ReturnType<typeof drizzle>['select'];
  query: ReturnType<typeof drizzle>['query'];
}

neonConfig.webSocketConstructor = ws;

// Execute a database transaction using WebSocket connection
export async function withTransaction<T>(
  callback: (tx: TransactionDatabase) => Promise<T>
): Promise<T> {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 10000,
  });

  let result: T;

  try {
    const db = drizzle(pool, { schema });

    result = await db.transaction(callback);

  } catch (error) {
    console.error('Transaction failed:', error);
    throw error;
  } finally {
    try {
      await pool.end();
    } catch (cleanupError) {
      console.warn('Error cleaning up database pool:', cleanupError);
    }
  }

  return result;
}


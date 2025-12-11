'use server';

import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { ilike, and, ne, eq } from 'drizzle-orm';

export async function searchUsersByUsername(query: string) {
  try {
    const session = await getSession();

    if (!session) {
      return { success: false, error: 'Unauthorized' };
    }

    if (query.length < 2) {
      return { success: true, users: [] };
    }

    const cleanQuery = query.startsWith('@') ? query.slice(1) : query;

    const users = await db.query.user.findMany({
      where: and(
        ilike(user.username, `%${cleanQuery}%`),
        ne(user.id, session.user.id),
        eq(user.status, 'active')
      ),
      columns: {
        username: true,
        name: true,
        image: true,
      },
      limit: 10,
    });

    return { success: true, users };
  } catch (error) {
    console.error('Search users error:', error);
    return { success: false, error: 'Failed to search users' };
  }
}


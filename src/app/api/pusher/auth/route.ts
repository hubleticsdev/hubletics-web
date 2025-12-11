import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { conversation } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { pusherServer } from '@/lib/pusher/server';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const socket_id = formData.get('socket_id') as string;
    const channel_name = formData.get('channel_name') as string;

    if (!socket_id || !channel_name) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const conversationMatch = channel_name.match(/^private-conversation-(.+)$/);
    if (conversationMatch) {
      const conversationId = conversationMatch[1];

      const conv = await db.query.conversation.findFirst({
        where: eq(conversation.id, conversationId),
        columns: {
          id: true,
          clientId: true,
          coachId: true,
        },
      });

      if (!conv) {
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: 404 }
        );
      }

      if (conv.clientId !== session.user.id && conv.coachId !== session.user.id) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }

      const authResponse = pusherServer.authenticate(socket_id, channel_name);
      return NextResponse.json(authResponse);
    }

    return NextResponse.json(
      { error: 'Channel not supported' },
      { status: 403 }
    );

  } catch (error) {
    console.error('Pusher auth error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}

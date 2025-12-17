import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { conversation } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { pusherServer } from '@/lib/pusher/server';
import { withRateLimit, apiRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const rateLimitResponse = await withRateLimit(request, apiRateLimit);
  if (rateLimitResponse) return rateLimitResponse;

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

    // Handle group conversation channels
    const groupConversationMatch = channel_name.match(/^private-group-conversation-(.+)$/);
    if (groupConversationMatch) {
      const { groupConversation, groupConversationParticipant } = await import('@/lib/db/schema');
      const conversationId = groupConversationMatch[1];

      const participant = await db.query.groupConversationParticipant.findFirst({
        where: and(
          eq(groupConversationParticipant.conversationId, conversationId),
          eq(groupConversationParticipant.userId, session.user.id)
        ),
        columns: {
          id: true,
        },
      });

      if (!participant) {
        return NextResponse.json(
          { error: 'Access denied - not a participant' },
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

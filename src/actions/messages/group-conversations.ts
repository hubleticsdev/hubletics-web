'use server';

import { db } from '@/lib/db';
import { groupConversation, groupConversationParticipant, groupMessage, booking, bookingParticipant } from '@/lib/db/schema';
import { getSession } from '@/lib/auth/session';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { messageContentSchema, validateInput } from '@/lib/validations';

export async function getOrCreateGroupConversation(bookingId: string) {
  try {
    const session = await getSession();
    if (!session) {
      throw new Error('Unauthorized');
    }

    const bookingRecord = await db.query.booking.findFirst({
      where: eq(booking.id, bookingId),
    });

    if (!bookingRecord || !bookingRecord.isGroupBooking) {
      throw new Error('Booking not found or not a group booking');
    }

    const isCoach = bookingRecord.coachId === session.user.id;
    const participants = await db.query.bookingParticipant.findMany({
      where: eq(bookingParticipant.bookingId, bookingId),
    });
    const isParticipant = participants.some(p => p.userId === session.user.id);

    if (!isCoach && !isParticipant) {
      throw new Error('Unauthorized - not a member of this group');
    }

    let conv = await db.query.groupConversation.findFirst({
      where: eq(groupConversation.bookingId, bookingId),
    });

    if (!conv) {
      const [newConv] = await db
        .insert(groupConversation)
        .values({ bookingId })
        .returning();

      if (!newConv) {
        throw new Error('Failed to create group conversation');
      }

      conv = newConv;

      await db.insert(groupConversationParticipant).values({
        conversationId: newConv.id,
        userId: bookingRecord.coachId,
      });

      if (participants.length > 0) {
        await db.insert(groupConversationParticipant).values(
          participants.map(p => ({
            conversationId: newConv.id,
            userId: p.userId,
          }))
        );
      }
    }

    return conv!
  } catch (error) {
    console.error('Get or create group conversation error:', error);
    throw error;
  }
}

export async function getGroupConversationMessages(conversationId: string, limit = 50, offset = 0) {
  try {
    const session = await getSession();
    if (!session) {
      throw new Error('Unauthorized');
    }

    const participant = await db.query.groupConversationParticipant.findFirst({
      where: and(
        eq(groupConversationParticipant.conversationId, conversationId),
        eq(groupConversationParticipant.userId, session.user.id)
      ),
    });

    if (!participant) {
      throw new Error('Unauthorized - not a member of this conversation');
    }

    const messages = await db.query.groupMessage.findMany({
      where: eq(groupMessage.conversationId, conversationId),
      orderBy: [desc(groupMessage.createdAt)],
      limit,
      offset,
      with: {
        sender: {
          columns: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    return messages.reverse();
  } catch (error) {
    console.error('Get group conversation messages error:', error);
    throw error;
  }
}

export async function sendGroupMessage(conversationId: string, content: string) {
  try {
    const session = await getSession();
    if (!session) {
      throw new Error('Unauthorized');
    }

    const validatedConversationId = validateInput(z.string().uuid(), conversationId);
    const validatedContent = validateInput(messageContentSchema, content);

    const participant = await db.query.groupConversationParticipant.findFirst({
      where: and(
        eq(groupConversationParticipant.conversationId, validatedConversationId),
        eq(groupConversationParticipant.userId, session.user.id)
      ),
    });

    if (!participant) {
      throw new Error('Unauthorized - not a member of this conversation');
    }

    const [newMessage] = await db
      .insert(groupMessage)
      .values({
        conversationId: validatedConversationId,
        senderId: session.user.id,
        content: validatedContent.trim(),
        readBy: [session.user.id],
      })
      .returning();

    await db
      .update(groupConversation)
      .set({ lastMessageAt: new Date() })
      .where(eq(groupConversation.id, validatedConversationId));

    const fullMessage = await db.query.groupMessage.findFirst({
      where: eq(groupMessage.id, newMessage.id),
      with: {
        sender: {
          columns: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    if (!fullMessage) {
      throw new Error('Failed to retrieve sent message');
    }

    return fullMessage;
  } catch (error) {
    console.error('Send group message error:', error);
    throw error;
  }
}

export async function markGroupMessagesAsRead(conversationId: string) {
  try {
    const session = await getSession();
    if (!session) {
      throw new Error('Unauthorized');
    }

    const participant = await db.query.groupConversationParticipant.findFirst({
      where: and(
        eq(groupConversationParticipant.conversationId, conversationId),
        eq(groupConversationParticipant.userId, session.user.id)
      ),
    });

    if (!participant) {
      throw new Error('Unauthorized');
    }

    await db
      .update(groupConversationParticipant)
      .set({ lastReadAt: new Date() })
      .where(
        and(
          eq(groupConversationParticipant.conversationId, conversationId),
          eq(groupConversationParticipant.userId, session.user.id)
        )
      );

    return { success: true };
  } catch (error) {
    console.error('Mark group messages as read error:', error);
    throw error;
  }
}

export async function getGroupConversationParticipants(conversationId: string) {
  try {
    const session = await getSession();
    if (!session) {
      throw new Error('Unauthorized');
    }

    const participant = await db.query.groupConversationParticipant.findFirst({
      where: and(
        eq(groupConversationParticipant.conversationId, conversationId),
        eq(groupConversationParticipant.userId, session.user.id)
      ),
    });

    if (!participant) {
      throw new Error('Unauthorized');
    }

    const participants = await db.query.groupConversationParticipant.findMany({
      where: eq(groupConversationParticipant.conversationId, conversationId),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
          },
        },
      },
    });

    return participants.map(p => p.user);
  } catch (error) {
    console.error('Get group conversation participants error:', error);
    throw error;
  }
}


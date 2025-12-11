'use server';

import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { withTransaction } from '@/lib/db/transactions';
import { coachProfile, adminAction, user as userTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createConnectAccount } from '@/lib/stripe';
import { sendEmail } from '@/lib/email/resend';
import { uuidSchema, validateInput } from '@/lib/validations';
import {
  getCoachApprovedEmailTemplate,
  getCoachRejectedEmailTemplate,
} from '@/lib/email/templates/coach-notifications';

export async function approveCoach(coachUserId: string, notes?: string) {
  try {
    const session = await getSession();

    if (!session || session.user.role !== 'admin') {
      return { success: false, error: 'Unauthorized' };
    }

    const validatedCoachUserId = validateInput(uuidSchema, coachUserId);

    const coach = await db.query.coachProfile.findFirst({
      where: eq(coachProfile.userId, validatedCoachUserId),
      with: {
        user: true,
      },
    });

    if (!coach) {
      return { success: false, error: 'Coach not found' };
    }

    if (coach.adminApprovalStatus !== 'pending') {
      return { success: false, error: 'Coach already processed' };
    }

    let stripeAccountId = coach.stripeAccountId;

    await withTransaction(async (tx) => {
      if (!stripeAccountId) {
        const stripeAccount = await createConnectAccount(
          coach.user.email,
          validatedCoachUserId
        );
        stripeAccountId = stripeAccount.id;
      }

      await tx
        .update(coachProfile)
        .set({
          adminApprovalStatus: 'approved',
          adminApprovedAt: new Date(),
          adminApprovedBy: session.user.id,
          stripeAccountId,
          updatedAt: new Date(),
          updatedBy: session.user.id,
        })
        .where(eq(coachProfile.userId, validatedCoachUserId));

      await tx.insert(adminAction).values({
        adminId: session.user.id,
        action: 'approved_coach',
        targetUserId: validatedCoachUserId,
        relatedEntityId: coach.id,
        notes: notes || 'Coach profile approved',
      });
    });

    const emailTemplate = getCoachApprovedEmailTemplate(coach.fullName);
    await sendEmail({
      to: coach.user.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    console.log(`Coach approved: ${coach.fullName} (${coach.user.email})`);
    console.log(`Stripe account created: ${stripeAccountId}`);
    console.log(`Approval email sent to: ${coach.user.email}`);

    return { success: true, stripeAccountId };
  } catch (error) {
    console.error('Approve coach error:', error);
    return { success: false, error: 'Failed to approve coach' };
  }
}

export async function rejectCoach(
  coachUserId: string,
  reason: string,
  notes?: string
) {
  try {
    const session = await getSession();

    if (!session || session.user.role !== 'admin') {
      return { success: false, error: 'Unauthorized' };
    }

    const validatedCoachUserId = validateInput(uuidSchema, coachUserId);

    const coach = await db.query.coachProfile.findFirst({
      where: eq(coachProfile.userId, validatedCoachUserId),
      with: {
        user: true,
      },
    });

    if (!coach) {
      return { success: false, error: 'Coach not found' };
    }

    if (coach.adminApprovalStatus !== 'pending') {
      return { success: false, error: 'Coach already processed' };
    }

    await withTransaction(async (tx) => {
      await tx
        .update(coachProfile)
        .set({
          adminApprovalStatus: 'rejected',
          adminApprovedAt: new Date(),
          adminApprovedBy: session.user.id,
          updatedAt: new Date(),
          updatedBy: session.user.id,
        })
        .where(eq(coachProfile.userId, validatedCoachUserId));

      await tx.insert(adminAction).values({
        adminId: session.user.id,
        action: 'rejected_coach',
        targetUserId: validatedCoachUserId,
        relatedEntityId: coach.id,
        notes: `${reason}${notes ? ` - ${notes}` : ''}`,
      });
    });

    const emailTemplate = getCoachRejectedEmailTemplate(coach.fullName, reason);
    await sendEmail({
      to: coach.user.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    console.log(`Coach rejected: ${coach.fullName} (${coach.user.email})`);
    console.log(`Reason: ${reason}`);
    console.log(`Rejection email sent to: ${coach.user.email}`);

    return { success: true };
  } catch (error) {
    console.error('Reject coach error:', error);
    return { success: false, error: 'Failed to reject coach' };
  }
}

export async function getPendingCoaches() {
  try {
    const session = await getSession();

    if (!session || session.user.role !== 'admin') {
      return { success: false, error: 'Unauthorized', coaches: [] };
    }

    const pendingCoaches = await db.query.coachProfile.findMany({
      where: eq(coachProfile.adminApprovalStatus, 'pending'),
      with: {
        user: true,
      },
      orderBy: (coaches, { asc }) => [asc(coaches.createdAt)],
    });

    return { success: true, coaches: pendingCoaches };
  } catch (error) {
    console.error('Get pending coaches error:', error);
    return { success: false, error: 'Failed to fetch pending coaches', coaches: [] };
  }
}


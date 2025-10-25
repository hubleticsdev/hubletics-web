'use server';

import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { coachProfile, adminAction, user as userTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createConnectAccount } from '@/lib/stripe';
import { sendEmail } from '@/lib/email/resend';
import {
  getCoachApprovedEmailTemplate,
  getCoachRejectedEmailTemplate,
} from '@/lib/email/templates/coach-notifications';

/**
 * Approve a coach profile
 * Creates Stripe Connect account and sends email
 */
export async function approveCoach(coachUserId: string, notes?: string) {
  try {
    const session = await getSession();

    if (!session || session.user.role !== 'admin') {
      return { success: false, error: 'Unauthorized' };
    }

    // Get coach profile and user
    const coach = await db.query.coachProfile.findFirst({
      where: eq(coachProfile.userId, coachUserId),
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

    // Create Stripe Connect account
    let stripeAccountId = coach.stripeAccountId;

    if (!stripeAccountId) {
      const stripeAccount = await createConnectAccount(
        coach.user.email,
        coachUserId
      );
      stripeAccountId = stripeAccount.id;
    }

    // Update coach profile
    await db
      .update(coachProfile)
      .set({
        adminApprovalStatus: 'approved',
        adminApprovedAt: new Date(),
        adminApprovedBy: session.user.id,
        stripeAccountId,
        updatedAt: new Date(),
        updatedBy: session.user.id,
      })
      .where(eq(coachProfile.userId, coachUserId));

    // Log admin action
    await db.insert(adminAction).values({
      adminId: session.user.id,
      action: 'approved_coach',
      targetUserId: coachUserId,
      relatedEntityId: coach.id,
      notes: notes || 'Coach profile approved',
    });

    // Send approval email
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

/**
 * Reject a coach profile
 */
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

    // Get coach profile
    const coach = await db.query.coachProfile.findFirst({
      where: eq(coachProfile.userId, coachUserId),
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

    // Update coach profile
    await db
      .update(coachProfile)
      .set({
        adminApprovalStatus: 'rejected',
        adminApprovedAt: new Date(),
        adminApprovedBy: session.user.id,
        updatedAt: new Date(),
        updatedBy: session.user.id,
      })
      .where(eq(coachProfile.userId, coachUserId));

    // Log admin action
    await db.insert(adminAction).values({
      adminId: session.user.id,
      action: 'rejected_coach',
      targetUserId: coachUserId,
      relatedEntityId: coach.id,
      notes: `${reason}${notes ? ` - ${notes}` : ''}`,
    });

    // Send rejection email
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

/**
 * Get all pending coach approvals
 */
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


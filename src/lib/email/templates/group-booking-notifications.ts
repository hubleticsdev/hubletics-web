import { sanitizeName } from '@/lib/utils';

export function getGroupLessonDeclinedEmailTemplate(
  participantName: string,
  coachName: string,
  lessonDate: string,
  reason?: string
) {
  const safeParticipantName = sanitizeName(participantName);
  const safeCoachName = sanitizeName(coachName);

  return {
    subject: 'Update on your group lesson request',
    html: `
      <h2>Group Lesson Update</h2>
      <p>Hi ${safeParticipantName},</p>
      <p>Unfortunately, ${safeCoachName} has declined your request to join the group lesson on ${lessonDate}.</p>

      ${reason ? `<div style="background-color: #fef2f2; padding: 15px; border-left: 4px solid #ef4444; margin: 20px 0;">
        <p style="margin: 0;"><strong>Reason:</strong> ${reason}</p>
      </div>` : ''}

      <p><strong>Good news:</strong> Your payment authorization has been cancelled. You will NOT be charged.</p>

      <p>Feel free to browse other available group lessons from this coach or explore other coaches on the platform.</p>

      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/coaches" style="display: inline-block; padding: 12px 24px; background: linear-gradient(to right, #FF6B4A, #FF8C5A); color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">Browse Coaches</a></p>

      <p>Best regards,<br>The Hubletics Team</p>
    `,
    text: `Hi ${safeParticipantName}, The coach has declined your request to join the group lesson. Your payment authorization has been cancelled - you will NOT be charged.${reason ? ` Reason: ${reason}` : ''}`,
  };
}

export function getGroupLessonAcceptedEmailTemplate(
  participantName: string,
  lessonTitle: string,
  lessonDate: string,
  lessonTime: string,
  coachName: string,
  location?: string
) {
  const safeParticipantName = sanitizeName(participantName);

  return {
    subject: `✅ You're confirmed for ${lessonTitle}`,
    html: `
      <h2>You're In!</h2>
      <p>Hi ${safeParticipantName},</p>
      <p>Great news! Your spot in the group lesson has been confirmed.</p>

      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Lesson Details</h3>
        <p><strong>Date:</strong> ${lessonDate}</p>
        <p><strong>Time:</strong> ${lessonTime}</p>
        <p><strong>Coach:</strong> ${coachName}</p>
        ${location ? `<p><strong>Location:</strong> ${location}</p>` : ''}
      </div>

      <p>Your payment has been processed. See you there!</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/bookings" style="display: inline-block; padding: 12px 24px; background: linear-gradient(to right, #FF6B4A, #FF8C5A); color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">View Booking</a></p>

      <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
        Need to cancel? Please contact your coach as soon as possible.
      </p>

      <p>Best regards,<br>The Hubletics Team</p>
    `,
    text: `Hi ${safeParticipantName}, You're confirmed for the group lesson on ${lessonDate} at ${lessonTime}. Coach: ${coachName}. Your payment has been processed.`,
  };
}

export function getNewParticipantRequestEmailTemplate(
  coachName: string,
  participantName: string,
  lessonDate: string,
  lessonTime: string,
  amount: string
) {
  const safeCoachName = sanitizeName(coachName);
  const safeParticipantName = sanitizeName(participantName);

  return {
    subject: 'New participant request for your group lesson',
    html: `
      <h2>New Participant Request</h2>
      <p>Hi ${safeCoachName},</p>
      <p>${safeParticipantName} has requested to join your group lesson and authorized payment.</p>

      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Lesson Details</h3>
        <p><strong>Date:</strong> ${lessonDate}</p>
        <p><strong>Time:</strong> ${lessonTime}</p>
        <p><strong>Amount:</strong> $${amount}</p>
      </div>

      <p>Please review and approve or decline this participant from your dashboard.</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/bookings" style="display: inline-block; padding: 12px 24px; background: linear-gradient(to right, #FF6B4A, #FF8C5A); color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">View Requests</a></p>

      <p>Best regards,<br>The Hubletics Team</p>
    `,
    text: `Hi ${safeCoachName}, ${safeParticipantName} has requested to join your group lesson on ${lessonDate} at ${lessonTime}. Amount: $${amount}. Please review and approve/decline from your dashboard.`,
  };
}

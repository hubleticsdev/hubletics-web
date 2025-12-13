import { sanitizeName } from '@/lib/utils';

function formatDollarsFromCents(amountCents: number | null | undefined): string {
  if (!amountCents || Number.isNaN(amountCents)) return '0.00';
  return (amountCents / 100).toFixed(2);
}

export function getBookingAcceptedEmailTemplate(
  clientName: string,
  coachName: string,
  lessonDate: string,
  lessonTime: string,
  location: string,
  amountCents: number | null | undefined,
  paymentDueDate: string
) {
  const safeClientName = sanitizeName(clientName);
  const formattedAmount = formatDollarsFromCents(amountCents);

  return {
    subject: 'Lesson Accepted - Payment Required',
    html: `
      <h2>Great news! Your lesson has been accepted</h2>
      <p>Hi ${safeClientName},</p>
      <p>Your coach has accepted your lesson request for ${lessonDate} at ${lessonTime}!</p>

      <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #059669;">Lesson Details</h3>
        <p><strong>Date:</strong> ${lessonDate}</p>
        <p><strong>Time:</strong> ${lessonTime}</p>
        <p><strong>Location:</strong> ${location}</p>
        <p><strong>Amount:</strong> $${formattedAmount}</p>
      </div>

      <h3>⏰ Payment Required</h3>
      <p><strong>You have 24 hours to complete payment</strong> or this booking will be automatically cancelled.</p>
      <p><strong>Payment Deadline:</strong> ${paymentDueDate}</p>

      <p style="margin: 30px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/bookings"
           style="background: linear-gradient(to right, #FF6B4A, #FF8C5A); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
          Pay Now
        </a>
      </p>

      <p style="color: #666; font-size: 14px;">
        You'll receive a reminder email 30 minutes before the deadline.
      </p>

      <p>Best regards,<br>The Hubletics Team</p>
    `,
    text: `Hi ${safeClientName}, Your lesson has been accepted! Please complete payment within 24 hours. Payment deadline: ${paymentDueDate}. Amount: $${formattedAmount}. Visit ${process.env.NEXT_PUBLIC_APP_URL}/dashboard/bookings to pay now.`,
  };
}

export function getBookingDeclinedEmailTemplate(
  clientName: string,
  coachName: string,
  lessonDate: string,
  lessonTime: string,
  reason?: string
) {
  const safeClientName = sanitizeName(clientName);
  const safeCoachName = sanitizeName(coachName);

  return {
    subject: 'Booking Update - Request Declined',
    html: `
      <h2>Booking Update</h2>
      <p>Hi ${safeClientName},</p>
      <p>Unfortunately, ${safeCoachName} was unable to accept your booking request for ${lessonDate} at ${lessonTime}.</p>

      ${reason ? `<div style="background-color: #fef2f2; padding: 15px; border-left: 4px solid #ef4444; margin: 20px 0;">
        <p style="margin: 0;"><strong>Reason:</strong> ${reason}</p>
      </div>` : ''}

      <p>You can browse other available coaches or try booking at a different time.</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/coaches">Find Other Coaches</a></p>

      <p>We apologize for any inconvenience and hope to help you find the perfect coaching session soon!</p>

      <p>Best regards,<br>The Hubletics Team</p>
    `,
    text: `Hi ${safeClientName}, ${safeCoachName} has declined your booking request for ${lessonDate} at ${lessonTime}.${reason ? ` Reason: ${reason}` : ''} Find other coaches at ${process.env.NEXT_PUBLIC_APP_URL}/coaches`,
  };
}

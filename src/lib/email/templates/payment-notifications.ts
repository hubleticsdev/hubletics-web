import { sanitizeName } from '@/lib/utils';

export function getBookingCancelledDueToPaymentEmailTemplate(
  clientName: string,
  coachName: string,
  lessonDate: string,
  lessonTime: string
) {
  const safeClientName = sanitizeName(clientName);
  const safeCoachName = sanitizeName(coachName);

  return {
    subject: 'Booking Cancelled - Payment Not Received',
    html: `
      <h2>Booking Cancelled</h2>
      <p>Hi ${safeClientName},</p>
      <p>Your booking for ${lessonDate} at ${lessonTime} with ${safeCoachName} has been automatically cancelled because payment was not received within 24 hours.</p>
      <p>You can book a new session anytime on the platform.</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/coaches">Find Coaches</a></p>
      <p>Best regards,<br>The Hubletics Team</p>
    `,
    text: `Hi ${safeClientName}, Your booking with ${safeCoachName} on ${lessonDate} at ${lessonTime} has been cancelled due to non-payment. Book a new session at ${process.env.NEXT_PUBLIC_APP_URL}/coaches`,
  };
}

export function getPaymentReminder12HoursEmailTemplate(
  clientName: string,
  coachName: string,
  lessonDate: string,
  lessonTime: string,
  amount: string,
  paymentDeadline: string
) {
  const safeClientName = sanitizeName(clientName);
  const safeCoachName = sanitizeName(coachName);

  return {
    subject: 'Reminder: Payment Due in 12 Hours',
    html: `
      <h2>⏰ Payment Reminder</h2>
      <p>Hi ${safeClientName},</p>
      <p>This is a friendly reminder that payment for your lesson with ${safeCoachName} is due in <strong>12 hours</strong>.</p>

      <div style="background-color: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0;">
        <p><strong>Lesson:</strong> ${lessonDate} at ${lessonTime}</p>
        <p><strong>Amount:</strong> $${amount}</p>
        <p><strong>Payment Deadline:</strong> ${paymentDeadline}</p>
      </div>

      <p>Please complete your payment to secure your booking.</p>
      <p style="margin: 30px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/bookings"
           style="background: linear-gradient(to right, #FF6B4A, #FF8C5A); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
          Pay Now
        </a>
      </p>

      <p style="color: #666; font-size: 14px;">
        If payment is not received by the deadline, this booking will be automatically cancelled.
      </p>

      <p>Best regards,<br>The Hubletics Team</p>
    `,
    text: `Hi ${safeClientName}, Payment reminder: Your lesson with ${safeCoachName} on ${lessonDate} at ${lessonTime} costs $${amount} and is due by ${paymentDeadline}. Complete payment at ${process.env.NEXT_PUBLIC_APP_URL}/dashboard/bookings`,
  };
}

export function getPaymentReminder30MinutesEmailTemplate(
  clientName: string,
  coachName: string,
  lessonDate: string,
  lessonTime: string,
  amount: string,
  paymentDeadline: string
) {
  const safeClientName = sanitizeName(clientName);
  const safeCoachName = sanitizeName(coachName);

  return {
    subject: '🚨 URGENT: Payment Due in 30 Minutes',
    html: `
      <h2>🚨 Final Payment Reminder</h2>
      <p>Hi ${safeClientName},</p>
      <p><strong>This is your final reminder</strong> - payment for your lesson is due in <strong>30 minutes</strong>!</p>

      <div style="background-color: #fee2e2; padding: 15px; border-left: 4px solid #dc2626; margin: 20px 0;">
        <p><strong>Lesson:</strong> ${lessonDate} at ${lessonTime}</p>
        <p><strong>Amount:</strong> $${amount}</p>
        <p><strong>Payment Deadline:</strong> ${paymentDeadline}</p>
      </div>

      <p>If payment is not received by the deadline, your booking will be automatically cancelled.</p>
      <p style="margin: 30px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/bookings"
           style="background: linear-gradient(to right, #FF6B4A, #FF8C5A); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
          Pay Now - Don't Lose Your Spot!
        </a>
      </p>

      <p style="color: #dc2626; font-weight: 600;">
        ⚠️ If payment is not received within 30 minutes, this booking will be cancelled.
      </p>

      <p>Best regards,<br>The Hubletics Team</p>
    `,
    text: `URGENT: Hi ${safeClientName}, Final payment reminder: Your lesson with ${safeCoachName} on ${lessonDate} at ${lessonTime} costs $${amount} and is due by ${paymentDeadline}. Complete payment immediately at ${process.env.NEXT_PUBLIC_APP_URL}/dashboard/bookings`,
  };
}

export function getAutoConfirmationClientEmailTemplate(
  clientName: string,
  coachName: string,
  lessonDate: string
) {
  const safeClientName = sanitizeName(clientName);
  const safeCoachName = sanitizeName(coachName);

  return {
    subject: 'Lesson automatically confirmed',
    html: `
      <h2>Lesson Confirmed</h2>
      <p>Hi ${safeClientName},</p>
      <p>Your lesson with ${safeCoachName} on ${lessonDate} has been automatically confirmed since we didn't hear back from you within 7 days.</p>
      <p>Payment has been released to your coach.</p>
      <p>If there was any issue with the lesson, please contact support immediately at support@hubletics.com</p>
      <p>We'd love to hear about your experience! <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/bookings">Leave a review</a></p>
      <p>Best regards,<br>The Hubletics Team</p>
    `,
    text: `Hi ${safeClientName}, Your lesson with ${safeCoachName} on ${lessonDate} has been automatically confirmed. Payment released to coach. Contact support if there were any issues. Leave a review at ${process.env.NEXT_PUBLIC_APP_URL}/dashboard/bookings`,
  };
}

export function getAutoConfirmationCoachEmailTemplate(
  coachName: string,
  clientName: string,
  lessonDate: string,
  payoutAmount: string
) {
  const safeCoachName = sanitizeName(coachName);
  const safeClientName = sanitizeName(clientName);

  return {
    subject: 'Lesson automatically confirmed - Payment released',
    html: `
      <h2>Payment Released</h2>
      <p>Hi ${safeCoachName},</p>
      <p>Your lesson with ${safeClientName} on ${lessonDate} has been automatically confirmed.</p>
      <p>The payment of $${payoutAmount} has been transferred to your account.</p>
      <p>Thank you for using Hubletics!</p>
      <p>Best regards,<br>The Hubletics Team</p>
    `,
    text: `Hi ${safeCoachName}, Your lesson with ${safeClientName} on ${lessonDate} has been auto-confirmed. Payment of $${payoutAmount} has been transferred.`,
  };
}

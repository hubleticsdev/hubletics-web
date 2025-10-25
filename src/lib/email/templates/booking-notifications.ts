import { clientEnv } from '@/lib/env';

export function getBookingRequestEmailTemplate(
  coachName: string,
  athleteName: string,
  bookingDetails: {
    date: string;
    time: string;
    duration: number;
    location: string;
    amount: string;
  }
) {
  const dashboardLink = `${clientEnv.APP_URL}/dashboard/coach`;
  return {
    subject: `New Booking Request from ${athleteName}`,
    html: `
      <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
        <div style="background: linear-gradient(to right, #FF6B4A, #FF8C5A); padding: 20px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">New Booking Request</h1>
        </div>
        <div style="padding: 30px;">
          <p>Hi ${coachName},</p>
          <p>You have a new booking request from <strong>${athleteName}</strong>!</p>
          
          <div style="background-color: #f9fafb; border-left: 4px solid #FF6B4A; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #FF6B4A;">Session Details</h3>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${bookingDetails.date}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${bookingDetails.time}</p>
            <p style="margin: 5px 0;"><strong>Duration:</strong> ${bookingDetails.duration} minutes</p>
            <p style="margin: 5px 0;"><strong>Location:</strong> ${bookingDetails.location}</p>
            <p style="margin: 5px 0;"><strong>Amount:</strong> $${bookingDetails.amount}</p>
          </div>

          <p>The payment is currently on hold. Once you accept the booking, the payment will be processed automatically.</p>

          <div style="text-align: center; margin-top: 30px;">
            <a href="${dashboardLink}" style="background-color: #FF6B4A; color: white; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
              Review Booking Request
            </a>
          </div>

          <p style="margin-top: 30px; font-size: 14px; color: #666;">If you have any questions, please contact our support team.</p>
          <p style="font-size: 14px; color: #666;">Best regards,<br>The Hubletics Team</p>
        </div>
      </div>
    `,
    text: `Hi ${coachName},

You have a new booking request from ${athleteName}!

Session Details:
- Date: ${bookingDetails.date}
- Time: ${bookingDetails.time}
- Duration: ${bookingDetails.duration} minutes
- Location: ${bookingDetails.location}
- Amount: $${bookingDetails.amount}

The payment is currently on hold. Once you accept the booking, the payment will be processed automatically.

Review the booking request: ${dashboardLink}

If you have any questions, please contact our support team.

Best regards,
The Hubletics Team`,
  };
}

export function getBookingAcceptedEmailTemplate(
  athleteName: string,
  coachName: string,
  bookingDetails: {
    date: string;
    time: string;
    duration: number;
    location: string;
    amount: string;
  }
) {
  const dashboardLink = `${clientEnv.APP_URL}/dashboard/athlete`;
  return {
    subject: `Booking Confirmed: ${coachName} Accepted Your Request`,
    html: `
      <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
        <div style="background: linear-gradient(to right, #10B981, #34D399); padding: 20px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">🎉 Booking Confirmed!</h1>
        </div>
        <div style="padding: 30px;">
          <p>Hi ${athleteName},</p>
          <p>Great news! <strong>${coachName}</strong> has accepted your booking request.</p>
          
          <div style="background-color: #f0fdf4; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #10B981;">Confirmed Session Details</h3>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${bookingDetails.date}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${bookingDetails.time}</p>
            <p style="margin: 5px 0;"><strong>Duration:</strong> ${bookingDetails.duration} minutes</p>
            <p style="margin: 5px 0;"><strong>Location:</strong> ${bookingDetails.location}</p>
            <p style="margin: 5px 0;"><strong>Amount Charged:</strong> $${bookingDetails.amount}</p>
          </div>

          <p>Your payment has been processed. See you at the session!</p>

          <div style="text-align: center; margin-top: 30px;">
            <a href="${dashboardLink}" style="background-color: #10B981; color: white; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
              View My Bookings
            </a>
          </div>

          <p style="margin-top: 30px; font-size: 14px; color: #666;">If you need to cancel or have any questions, please contact us as soon as possible.</p>
          <p style="font-size: 14px; color: #666;">Best regards,<br>The Hubletics Team</p>
        </div>
      </div>
    `,
    text: `Hi ${athleteName},

Great news! ${coachName} has accepted your booking request.

Confirmed Session Details:
- Date: ${bookingDetails.date}
- Time: ${bookingDetails.time}
- Duration: ${bookingDetails.duration} minutes
- Location: ${bookingDetails.location}
- Amount Charged: $${bookingDetails.amount}

Your payment has been processed. See you at the session!

View your bookings: ${dashboardLink}

If you need to cancel or have any questions, please contact us as soon as possible.

Best regards,
The Hubletics Team`,
  };
}

export function getBookingDeclinedEmailTemplate(
  athleteName: string,
  coachName: string,
  reason: string,
  bookingDetails: {
    date: string;
    time: string;
  }
) {
  const coachesLink = `${clientEnv.APP_URL}/coaches`;
  return {
    subject: `Booking Update: ${coachName} Declined Your Request`,
    html: `
      <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
        <div style="background: linear-gradient(to right, #8A2BE2, #9370DB); padding: 20px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">Booking Update</h1>
        </div>
        <div style="padding: 30px;">
          <p>Hi ${athleteName},</p>
          <p>Unfortunately, <strong>${coachName}</strong> was unable to accept your booking request for ${bookingDetails.date} at ${bookingDetails.time}.</p>
          
          <div style="background-color: #fdf2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; font-weight: bold; color: #ef4444;">Reason:</p>
            <p style="margin: 5px 0 0 0;">${reason}</p>
          </div>

          <p><strong>No charges were made</strong> - the payment hold has been released.</p>

          <p>Don't worry! There are many other great coaches available. Browse our coach directory to find another coach who's a great fit for you.</p>

          <div style="text-align: center; margin-top: 30px;">
            <a href="${coachesLink}" style="background-color: #FF6B4A; color: white; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
              Browse Coaches
            </a>
          </div>

          <p style="margin-top: 30px; font-size: 14px; color: #666;">If you have any questions, please contact our support team.</p>
          <p style="font-size: 14px; color: #666;">Best regards,<br>The Hubletics Team</p>
        </div>
      </div>
    `,
    text: `Hi ${athleteName},

Unfortunately, ${coachName} was unable to accept your booking request for ${bookingDetails.date} at ${bookingDetails.time}.

Reason: ${reason}

No charges were made - the payment hold has been released.

Don't worry! There are many other great coaches available. Browse our coach directory to find another coach who's a great fit for you.

Browse coaches: ${coachesLink}

If you have any questions, please contact our support team.

Best regards,
The Hubletics Team`,
  };
}

export function getBookingCancelledEmailTemplate(
  recipientName: string,
  cancelledBy: string,
  reason: string,
  bookingDetails: {
    date: string;
    time: string;
    amount: string;
  }
) {
  return {
    subject: 'Booking Cancelled',
    html: `
      <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
        <div style="background: linear-gradient(to right, #6B7280, #9CA3AF); padding: 20px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">Booking Cancelled</h1>
        </div>
        <div style="padding: 30px;">
          <p>Hi ${recipientName},</p>
          <p>Your booking for ${bookingDetails.date} at ${bookingDetails.time} has been cancelled by ${cancelledBy}.</p>
          
          <div style="background-color: #f9fafb; border-left: 4px solid #6B7280; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; font-weight: bold;">Cancellation Reason:</p>
            <p style="margin: 5px 0 0 0;">${reason}</p>
          </div>

          <p>A refund of <strong>$${bookingDetails.amount}</strong> has been processed and will appear in your account within 5-10 business days.</p>

          <p style="margin-top: 30px; font-size: 14px; color: #666;">If you have any questions, please contact our support team.</p>
          <p style="font-size: 14px; color: #666;">Best regards,<br>The Hubletics Team</p>
        </div>
      </div>
    `,
    text: `Hi ${recipientName},

Your booking for ${bookingDetails.date} at ${bookingDetails.time} has been cancelled by ${cancelledBy}.

Cancellation Reason: ${reason}

A refund of $${bookingDetails.amount} has been processed and will appear in your account within 5-10 business days.

If you have any questions, please contact our support team.

Best regards,
The Hubletics Team`,
  };
}


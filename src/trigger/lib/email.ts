/**
 * Minimal email utility for Trigger.dev tasks
 * This avoids importing the full env.ts which requires all env vars
 */

import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey) {
  throw new Error('RESEND_API_KEY is required for Trigger.dev tasks');
}

export const resend = new Resend(resendApiKey);

export const FROM_EMAIL = 'Hubletics <noreply@hubletics.com>';

export async function sendEmail({
  to,
  subject,
  html,
  text,
  from = FROM_EMAIL,
}: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}) {
  if (!html && !text) {
    throw new Error('Either html or text content must be provided');
  }

  if (!to || !subject) {
    throw new Error('Recipient and subject are required');
  }

  const emailPayload = html
    ? {
        from,
        to,
        subject,
        html,
        ...(text && { text }),
      }
    : {
        from,
        to,
        subject,
        text: text!,
      };

  const { data, error } = await resend.emails.send(emailPayload);

  if (error) {
    console.error('Resend API error:', error);
    throw new Error(`Failed to send email: ${error.message || 'Unknown error'}`);
  }

  return { success: true, data };
}

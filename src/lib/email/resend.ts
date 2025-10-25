/**
 * Resend email client configuration
 *
 * This module provides a configured Resend client for sending emails
 * throughout the application (verification, password reset, notifications).
 */

import { Resend } from 'resend';
import { env } from '@/lib/env';

/**
 * Initialize Resend client with API key from environment variables
 */
export const resend = new Resend(env.RESEND_API_KEY);

/**
 * Default "from" email address for all outgoing emails
 *
 * Format: "Display Name <email@domain.com>"
 */
export const FROM_EMAIL = 'Hubletics <noreply@propelprep.com>';

/**
 * Send an email using Resend
 *
 * @param options - Email options
 * @returns Promise with email send result
 */
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
  try {
    // According to Resend docs, both html and text are valid parameters
    // We need to ensure at least one is provided
    if (!html && !text) {
      throw new Error('Either html or text content must be provided');
    }

    // Build email payload - Resend requires at least one of html, text, or react
    // Since we validated above that at least html or text exists, we can safely send
    const { data, error } = html
      ? await resend.emails.send({
          from,
          to,
          subject,
          html,
          ...(text && { text }),
        })
      : await resend.emails.send({
          from,
          to,
          subject,
          text: text!, // We know text exists because html is undefined
        });

    if (error) {
      console.error('Resend API error:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, error };
  }
}

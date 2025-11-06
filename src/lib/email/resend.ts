// resend configuration

import { Resend } from 'resend';
import { env } from '@/lib/env';

// Custom error types for email
export class EmailError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'EmailError';
  }
}

export class EmailServiceError extends EmailError {
  constructor(message: string = 'Email service temporarily unavailable') {
    super(message, 'SERVICE_ERROR', 503);
    this.name = 'EmailServiceError';
  }
}

export class EmailValidationError extends EmailError {
  constructor(message: string = 'Invalid email configuration') {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'EmailValidationError';
  }
}

// Utility function to handle Resend errors
function handleEmailError(error: unknown): never {
  if (error instanceof Error) {
    // Check for common Resend error patterns
    if (error.message.includes('rate limit') || error.message.includes('quota')) {
      throw new EmailServiceError('Email sending limit exceeded. Please try again later.');
    }
    if (error.message.includes('invalid') || error.message.includes('malformed')) {
      throw new EmailValidationError('Invalid email format or configuration.');
    }
    if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
      throw new EmailServiceError('Email service authentication failed.');
    }
    throw new EmailError(error.message, 'UNKNOWN_ERROR', 500);
  }

  throw new EmailError('Unknown email error', 'UNKNOWN_ERROR', 500);
}

export const resend = new Resend(env.RESEND_API_KEY);

export const FROM_EMAIL = 'Hubletics <noreply@propelprep.com>';

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
    // Validation
    if (!html && !text) {
      throw new EmailValidationError('Either html or text content must be provided');
    }

    if (!to || !subject) {
      throw new EmailValidationError('Recipient and subject are required');
    }

    // Build email payload - Resend requires at least one of html, text, or react
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
          text: text!, // We know text exists because html is undefined
        };

    const { data, error } = await resend.emails.send(emailPayload);

    if (error) {
      console.error('Resend API error:', error);
      handleEmailError(error);
    }

    return { success: true, data };
  } catch (error) {
    console.error('Failed to send email:', error);
    handleEmailError(error);
  }
}

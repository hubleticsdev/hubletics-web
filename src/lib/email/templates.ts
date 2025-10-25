/**
 * Email templates for authentication flows
 *
 * These templates are used for email verification, password reset,
 * and other authentication-related emails.
 */

/**
 * Email verification template
 */
export function getVerificationEmailTemplate({
  userName,
  verificationUrl,
}: {
  userName: string;
  verificationUrl: string;
}) {
  return {
    subject: 'Verify your Hubletics account',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #111827;">
                Welcome to Hubletics!
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 0 40px 20px 40px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #374151;">
                Hi ${userName},
              </p>
              <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #374151;">
                Thanks for signing up! Please verify your email address by clicking the button below.
              </p>
            </td>
          </tr>

          <!-- Button -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <a href="${verificationUrl}" style="display: inline-block; padding: 12px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">
                Verify Email Address
              </a>
            </td>
          </tr>

          <!-- Alternative link -->
          <tr>
            <td style="padding: 0 40px 20px 40px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 20px; color: #6b7280;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 8px 0 0 0; font-size: 14px; line-height: 20px; word-break: break-all;">
                <a href="${verificationUrl}" style="color: #2563eb;">${verificationUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 40px 40px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 14px; line-height: 20px; color: #6b7280;">
                This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>

        <!-- Footer info -->
        <table width="600" cellpadding="0" cellspacing="0" style="margin-top: 20px;">
          <tr>
            <td style="padding: 0 40px;">
              <p style="margin: 0; font-size: 12px; line-height: 16px; color: #9ca3af; text-align: center;">
                © ${new Date().getFullYear()} Hubletics. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
    text: `
Welcome to Hubletics!

Hi ${userName},

Thanks for signing up! Please verify your email address by clicking the link below:

${verificationUrl}

This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.

© ${new Date().getFullYear()} Hubletics. All rights reserved.
    `,
  };
}

/**
 * Password reset template
 */
export function getPasswordResetEmailTemplate({
  userName,
  resetUrl,
}: {
  userName: string;
  resetUrl: string;
}) {
  return {
    subject: 'Reset your Hubletics password',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #111827;">
                Password Reset Request
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 0 40px 20px 40px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #374151;">
                Hi ${userName},
              </p>
              <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #374151;">
                We received a request to reset your password. Click the button below to create a new password.
              </p>
            </td>
          </tr>

          <!-- Button -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <a href="${resetUrl}" style="display: inline-block; padding: 12px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">
                Reset Password
              </a>
            </td>
          </tr>

          <!-- Alternative link -->
          <tr>
            <td style="padding: 0 40px 20px 40px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 20px; color: #6b7280;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 8px 0 0 0; font-size: 14px; line-height: 20px; word-break: break-all;">
                <a href="${resetUrl}" style="color: #2563eb;">${resetUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 40px 40px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px 0; font-size: 14px; line-height: 20px; color: #6b7280;">
                This link will expire in 1 hour for security reasons.
              </p>
              <p style="margin: 0; font-size: 14px; line-height: 20px; color: #6b7280;">
                If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
              </p>
            </td>
          </tr>
        </table>

        <!-- Footer info -->
        <table width="600" cellpadding="0" cellspacing="0" style="margin-top: 20px;">
          <tr>
            <td style="padding: 0 40px;">
              <p style="margin: 0; font-size: 12px; line-height: 16px; color: #9ca3af; text-align: center;">
                © ${new Date().getFullYear()} Hubletics. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
    text: `
Password Reset Request

Hi ${userName},

We received a request to reset your password. Click the link below to create a new password:

${resetUrl}

This link will expire in 1 hour for security reasons.

If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.

© ${new Date().getFullYear()} Hubletics. All rights reserved.
    `,
  };
}

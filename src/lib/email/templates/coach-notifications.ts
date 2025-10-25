/**
 * Email templates for coach approval notifications
 */

export function getCoachApprovedEmailTemplate(coachName: string) {
  return {
    subject: '🎉 Your Coach Profile Has Been Approved!',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Coach Profile Approved</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #FF6B4A 0%, #FF8C5A 100%);
              padding: 40px 20px;
              text-align: center;
              border-radius: 12px 12px 0 0;
            }
            .header h1 {
              color: white;
              margin: 0;
              font-size: 28px;
            }
            .content {
              background: white;
              padding: 40px 30px;
              border: 1px solid #e5e5e5;
              border-top: none;
            }
            .emoji {
              font-size: 48px;
              margin-bottom: 20px;
            }
            .message {
              font-size: 16px;
              margin-bottom: 30px;
              color: #555;
            }
            .button {
              display: inline-block;
              background: linear-gradient(135deg, #FF6B4A 0%, #FF8C5A 100%);
              color: white;
              padding: 14px 32px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              margin: 20px 0;
            }
            .next-steps {
              background: #f9fafb;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .next-steps h3 {
              margin-top: 0;
              color: #FF6B4A;
            }
            .next-steps ol {
              margin: 0;
              padding-left: 20px;
            }
            .next-steps li {
              margin: 10px 0;
            }
            .footer {
              text-align: center;
              padding: 20px;
              color: #999;
              font-size: 14px;
              border: 1px solid #e5e5e5;
              border-top: none;
              border-radius: 0 0 12px 12px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="emoji">🎉</div>
            <h1>Congratulations, ${coachName}!</h1>
          </div>
          
          <div class="content">
            <p class="message">
              We're excited to inform you that your coach profile has been <strong>approved</strong>! 
              You're now part of the Hubletics coaching community.
            </p>
            
            <div class="next-steps">
              <h3>📋 Next Steps:</h3>
              <ol>
                <li><strong>Complete Payment Setup:</strong> Set up your Stripe account to receive payments</li>
                <li><strong>Update Your Availability:</strong> Make sure your schedule is up to date</li>
                <li><strong>Start Accepting Bookings:</strong> Athletes can now find and book sessions with you!</li>
              </ol>
            </div>
            
            <center>
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/coach" class="button">
                Go to Dashboard
              </a>
            </center>
            
            <p class="message" style="margin-top: 30px; font-size: 14px;">
              If you have any questions or need assistance, please don't hesitate to reach out to our support team.
            </p>
          </div>
          
          <div class="footer">
            <p>© ${new Date().getFullYear()} Hubletics. All rights reserved.</p>
            <p>Train with the best. Become the best.</p>
          </div>
        </body>
      </html>
    `,
    text: `
Congratulations, ${coachName}!

We're excited to inform you that your coach profile has been approved! You're now part of the Hubletics coaching community.

Next Steps:
1. Complete Payment Setup: Set up your Stripe account to receive payments
2. Update Your Availability: Make sure your schedule is up to date
3. Start Accepting Bookings: Athletes can now find and book sessions with you!

Visit your dashboard: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/coach

If you have any questions or need assistance, please don't hesitate to reach out to our support team.

© ${new Date().getFullYear()} Hubletics. All rights reserved.
Train with the best. Become the best.
    `.trim(),
  };
}

export function getCoachRejectedEmailTemplate(coachName: string, reason?: string) {
  return {
    subject: 'Update on Your Coach Application',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Coach Application Update</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
              padding: 40px 20px;
              text-align: center;
              border-radius: 12px 12px 0 0;
            }
            .header h1 {
              color: white;
              margin: 0;
              font-size: 28px;
            }
            .content {
              background: white;
              padding: 40px 30px;
              border: 1px solid #e5e5e5;
              border-top: none;
            }
            .message {
              font-size: 16px;
              margin-bottom: 20px;
              color: #555;
            }
            .reason {
              background: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .button {
              display: inline-block;
              background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
              color: white;
              padding: 14px 32px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              padding: 20px;
              color: #999;
              font-size: 14px;
              border: 1px solid #e5e5e5;
              border-top: none;
              border-radius: 0 0 12px 12px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Update on Your Application</h1>
          </div>
          
          <div class="content">
            <p class="message">
              Hi ${coachName},
            </p>
            
            <p class="message">
              Thank you for your interest in becoming a coach on Hubletics. After careful review, 
              we're unable to approve your application at this time.
            </p>
            
            ${reason ? `
              <div class="reason">
                <strong>Reason:</strong><br>
                ${reason}
              </div>
            ` : ''}
            
            <p class="message">
              We encourage you to reapply in the future. If you have questions about this decision 
              or would like to discuss your application, please contact our support team.
            </p>
            
            <center>
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/contact" class="button">
                Contact Support
              </a>
            </center>
          </div>
          
          <div class="footer">
            <p>© ${new Date().getFullYear()} Hubletics. All rights reserved.</p>
          </div>
        </body>
      </html>
    `,
    text: `
Hi ${coachName},

Thank you for your interest in becoming a coach on Hubletics. After careful review, we're unable to approve your application at this time.

${reason ? `Reason: ${reason}\n\n` : ''}

We encourage you to reapply in the future. If you have questions about this decision or would like to discuss your application, please contact our support team.

Contact us: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/contact

© ${new Date().getFullYear()} Hubletics. All rights reserved.
    `.trim(),
  };
}


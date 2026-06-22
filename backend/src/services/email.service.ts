import nodemailer from 'nodemailer';

const GMAIL_USER = process.env.GMAIL_USER || '';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || '';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
});

transporter.verify((err) => {
  if (err) {
    console.error('[EmailService] Connection verify failed:', err);
  } else {
    console.log('[EmailService] Nodemailer with Gmail is ready to process mails.');
  }
});

async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.warn('[EmailService] Missing Gmail credentials. Skipping email.');
    return false;
  }
  try {
    await transporter.sendMail({ from: `"SalesGenius" <${GMAIL_USER}>`, to, subject, text });
    console.log(`[EmailService] Email sent to ${to}`);
    return true;
  } catch (err) {
    console.error('[EmailService] Send failed:', err);
    return false;
  }
}

export async function sendInvitationEmail(email: string, name: string, portalUrl: string, companyName: string, tempPassword?: string) {
  const text = tempPassword
    ? `Hello ${name},

You have been invited to join ${companyName} on SalesGenius.

Your login credentials:
Email: ${email}
Password: ${tempPassword}

Login at: http://localhost:3000/portal/login

You can also use this link to set your own password:
${portalUrl}

Best regards,
SalesGenius Team`
    : `Hello ${name},

You have been invited to join ${companyName} on SalesGenius.

Click the link below to complete your onboarding:
${portalUrl}

This link expires in 7 days.

Best regards,
SalesGenius Team`;

  return sendEmail(email, `You're invited to join SalesGenius!`, text);
}

export async function sendPasswordResetEmail(email: string, name: string, resetUrl: string) {
  return sendEmail(
    email,
    'Password Reset — SalesGenius',
    `Hello ${name},

A password reset was requested for your SalesGenius account.

Click the link below to reset your password:
${resetUrl}

This link expires in 1 hour.

If you didn't request this, please ignore this email.

Best regards,
SalesGenius Team`
  );
}

export async function sendOnboardedNotificationEmail(adminEmail: string, adminName: string, clientName: string, companyName: string) {
  return sendEmail(
    adminEmail,
    `${clientName} has completed onboarding!`,
    `Hello ${adminName},

${clientName} has successfully completed onboarding for ${companyName}.

You can now manage their account from your dashboard.

Best regards,
SalesGenius Team`
  );
}

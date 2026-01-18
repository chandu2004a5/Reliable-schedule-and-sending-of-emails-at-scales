import nodemailer from 'nodemailer';

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verify connection configuration
export async function verifyEmailConnection() {
  try {
    await transporter.verify();
    console.log('✅ Email transport is ready');
    return true;
  } catch (error) {
    console.error('❌ Email transport error:', error);
    return false;
  }
}

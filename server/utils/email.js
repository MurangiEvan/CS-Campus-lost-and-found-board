const nodemailer = require('nodemailer');

/**
 * Email utility for sending system notifications and account recovery links.
 */
const emailUtils = {
  async sendPasswordResetEmail(email, token) {
    // In a real production environment, these would be set in .env
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.mailtrap.io',
      port: process.env.EMAIL_PORT || 2525,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const resetLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/app/reset-password?token=${token}`;

    const mailOptions = {
      from: '"CampusLink Support" <support@campuslink.tut4life.ac.za>',
      to: email,
      subject: 'Password Reset Request - CampusLink',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px;">
          <h2 style="color: #333;">Reset Your Password</h2>
          <p>You requested a password reset for your CampusLink account.</p>
          <p>Click the button below to set a new password. This link will expire in 1 hour.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
          </div>
          <p>If you did not request this, you can safely ignore this email.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <small style="color: #888;">This is an automated message from the CampusLink system.</small>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      return { success: true };
    } catch (error) {
      console.error('Email sending failed:', error);
      throw new Error('Failed to send reset email');
    }
  },
};

module.exports = emailUtils;

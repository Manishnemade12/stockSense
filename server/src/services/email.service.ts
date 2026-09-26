import { Resend } from 'resend';
import { env } from '../config/env.js';

let resendClient: Resend | null = null;

if (env.RESEND_API_KEY && !env.RESEND_API_KEY.includes('mock')) {
  resendClient = new Resend(env.RESEND_API_KEY);
}

export class EmailService {
  /**
   * Send Signup Account Activation OTP
   */
  static async sendSignupVerificationOtp(
    toEmail: string,
    otpCode: string,
    loginId?: string
  ): Promise<{ success: boolean; simulated?: boolean; messageId?: string }> {
    const subject = 'StockSense Account Verification Code';
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #0f172a; font-size: 22px; font-weight: 800; margin: 0; letter-spacing: -0.5px;">StockSense</h1>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Core Inventory Management System</p>
        </div>
        
        <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 24px; text-align: center;">
          <p style="color: #334155; font-size: 14px; margin: 0 0 12px 0;">Hello <strong>${loginId || 'User'}</strong>,</p>
          <p style="color: #475569; font-size: 13px; margin: 0 0 16px 0;">Use the 6-digit verification code below to activate your account:</p>
          
          <div style="background-color: #ffffff; border: 2px dashed #0284c7; border-radius: 8px; padding: 14px 24px; display: inline-block; margin: 8px 0;">
            <span style="font-family: Courier, monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0284c7;">${otpCode}</span>
          </div>
          
          <p style="color: #94a3b8; font-size: 12px; margin: 12px 0 0 0;">This code will expire in <strong>10 minutes</strong>.</p>
        </div>

        <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0;">
          If you did not attempt to register for StockSense, please safely ignore this email.
        </p>
      </div>
    `;

    return EmailService.sendEmail(toEmail, subject, html, otpCode);
  }

  /**
   * Send Password Reset OTP
   */
  static async sendPasswordResetOtp(
    toEmail: string,
    otpCode: string,
    loginId?: string
  ): Promise<{ success: boolean; simulated?: boolean; messageId?: string }> {
    const subject = 'StockSense Password Reset Code';
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #0f172a; font-size: 22px; font-weight: 800; margin: 0; letter-spacing: -0.5px;">StockSense</h1>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Security & Password Recovery</p>
        </div>
        
        <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 24px; text-align: center;">
          <p style="color: #334155; font-size: 14px; margin: 0 0 12px 0;">Hello <strong>${loginId || 'User'}</strong>,</p>
          <p style="color: #475569; font-size: 13px; margin: 0 0 16px 0;">We received a request to reset your password. Use the verification code below:</p>
          
          <div style="background-color: #ffffff; border: 2px dashed #dc2626; border-radius: 8px; padding: 14px 24px; display: inline-block; margin: 8px 0;">
            <span style="font-family: Courier, monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #dc2626;">${otpCode}</span>
          </div>
          
          <p style="color: #94a3b8; font-size: 12px; margin: 12px 0 0 0;">This code is valid for <strong>10 minutes</strong>.</p>
        </div>

        <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0;">
          If you did not request a password reset, your account is secure and you can ignore this email.
        </p>
      </div>
    `;

    return EmailService.sendEmail(toEmail, subject, html, otpCode);
  }

  /**
   * Internal sender via Resend API with safe local dev fallback
   */
  private static async sendEmail(
    toEmail: string,
    subject: string,
    html: string,
    otpCode: string
  ): Promise<{ success: boolean; simulated?: boolean; messageId?: string }> {
    // If no real Resend client is configured, simulate cleanly in development
    if (!resendClient) {
      console.log(
        `[Resend Email Simulator] 📨 To: "${toEmail}" | Subject: "${subject}" | OTP Code: [ ${otpCode} ]`
      );
      return { success: true, simulated: true };
    }

    try {
      const response = await resendClient.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: [toEmail],
        subject,
        html,
      });

      if (response.error) {
        console.warn(`[Resend Warning] Delivery error: ${response.error.message}. OTP fallback code: ${otpCode}`);
        return { success: true, simulated: true };
      }

      console.log(`[Resend Success] Email delivered to ${toEmail}. Message ID: ${response.data?.id}`);
      return { success: true, messageId: response.data?.id };
    } catch (err) {
      console.warn(`[Resend Exception] Delivery failed:`, err);
      // Fallback: Never fail user registration/recovery due to external mail transport failure
      return { success: true, simulated: true };
    }
  }
}

export default EmailService;

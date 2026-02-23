import nodemailer from 'nodemailer';
import { config } from '../config';

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export const sendEmail = async (options: EmailOptions): Promise<string> => {
  try {
    if (config.email.provider === 'smtp') {
      const transporter = nodemailer.createTransport({
        host: config.email.smtp.host,
        port: config.email.smtp.port,
        secure: config.email.smtp.secure,
        auth: {
          user: config.email.smtp.user,
          pass: config.email.smtp.password,
        },
      });

      const info = await transporter.sendMail({
        from: config.email.smtp.user,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html || options.text,
      });

      return info.messageId;
    } else if (config.email.provider === 'sendgrid') {
      // SendGrid implementation
      // For now, returning a mock message ID
      console.log('SendGrid email would be sent here:', options);
      return `sendgrid-${Date.now()}`;
    }

    throw new Error('No email provider configured');
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

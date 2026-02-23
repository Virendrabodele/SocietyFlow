import { config } from '../config';

export interface SMSOptions {
  to: string;
  message: string;
}

export const sendSMS = async (options: SMSOptions): Promise<string> => {
  try {
    if (config.sms.provider === 'twilio') {
      // Twilio implementation
      // For now, returning a mock message ID
      console.log('Twilio SMS would be sent here:', options);
      return `twilio-${Date.now()}`;
    } else if (config.sms.provider === 'msg91') {
      // MSG91 implementation
      console.log('MSG91 SMS would be sent here:', options);
      return `msg91-${Date.now()}`;
    }

    throw new Error('No SMS provider configured');
  } catch (error) {
    console.error('Error sending SMS:', error);
    throw error;
  }
};

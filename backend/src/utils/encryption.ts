import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production-32bytes';
const ALGORITHM = 'aes-256-cbc';

// Ensure key is exactly 32 bytes
const getKey = (): Buffer => {
  const key = Buffer.from(ENCRYPTION_KEY);
  if (key.length !== 32) {
    // Pad or truncate to 32 bytes
    const paddedKey = Buffer.alloc(32);
    key.copy(paddedKey, 0, 0, Math.min(key.length, 32));
    return paddedKey;
  }
  return key;
};

/**
 * Encrypt sensitive data like bank account numbers
 */
export const encrypt = (text: string): string => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Return IV + encrypted data (IV needed for decryption)
  return iv.toString('hex') + ':' + encrypted;
};

/**
 * Decrypt sensitive data
 */
export const decrypt = (encrypted: string): string => {
  const parts = encrypted.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted data format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = parts[1];

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);

  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
};

/**
 * Mask account number showing only last 4 digits
 */
export const maskAccountNumber = (accountNumber: string): string => {
  if (accountNumber.length <= 4) {
    return accountNumber;
  }
  const last4 = accountNumber.slice(-4);
  const masked = 'X'.repeat(accountNumber.length - 4);
  return masked + last4;
};

/**
 * Mask IFSC code showing only first 4 and last 2 characters
 */
export const maskIfscCode = (ifsc: string): string => {
  if (ifsc.length <= 6) {
    return ifsc;
  }
  return ifsc.slice(0, 4) + 'X'.repeat(ifsc.length - 6) + ifsc.slice(-2);
};

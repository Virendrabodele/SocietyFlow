/**
 * India Compliance Validation Utilities
 * Validates GSTIN, PAN, and other Indian regulatory formats
 */

/**
 * Validates GSTIN (Goods and Services Tax Identification Number)
 * Format: 22AAAAA0000A1Z5
 * - 2 chars: State code (01-37)
 * - 10 chars: PAN
 * - 1 char: Entity number (1-9, A-Z)
 * - 1 char: Z (default)
 * - 1 char: Checksum digit
 */
export const validateGSTIN = (gstin: string): boolean => {
  if (!gstin || typeof gstin !== 'string') {
    return false;
  }

  // Remove spaces and convert to uppercase
  const cleanGSTIN = gstin.trim().toUpperCase();

  // GSTIN should be exactly 15 characters
  if (cleanGSTIN.length !== 15) {
    return false;
  }

  // Regex pattern for GSTIN
  const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

  return gstinPattern.test(cleanGSTIN);
};

/**
 * Validates PAN (Permanent Account Number)
 * Format: AAAAA9999A
 * - 5 chars: Alphabetic characters
 * - 4 chars: Numeric characters
 * - 1 char: Alphabetic check character
 */
export const validatePAN = (pan: string): boolean => {
  if (!pan || typeof pan !== 'string') {
    return false;
  }

  // Remove spaces and convert to uppercase
  const cleanPAN = pan.trim().toUpperCase();

  // PAN should be exactly 10 characters
  if (cleanPAN.length !== 10) {
    return false;
  }

  // Regex pattern for PAN
  const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

  return panPattern.test(cleanPAN);
};

/**
 * Extracts state code from GSTIN
 */
export const getStateCodeFromGSTIN = (gstin: string): string | null => {
  if (!validateGSTIN(gstin)) {
    return null;
  }

  return gstin.substring(0, 2);
};

/**
 * Extracts PAN from GSTIN
 */
export const getPANFromGSTIN = (gstin: string): string | null => {
  if (!validateGSTIN(gstin)) {
    return null;
  }

  return gstin.substring(2, 12);
};

/**
 * Indian state codes mapping
 */
export const INDIA_STATE_CODES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};

/**
 * Get state name from state code
 */
export const getStateName = (stateCode: string): string | null => {
  return INDIA_STATE_CODES[stateCode] || null;
};

/**
 * Validate if a number is negative
 */
export const validateNonNegative = (amount: number): boolean => {
  return amount >= 0;
};

/**
 * Validate if payment amount doesn't exceed invoice amount
 */
export const validatePaymentAmount = (
  paymentAmount: number,
  invoiceAmount: number,
  alreadyPaid: number = 0
): { valid: boolean; message?: string } => {
  if (paymentAmount <= 0) {
    return { valid: false, message: 'Payment amount must be greater than zero' };
  }

  const remaining = invoiceAmount - alreadyPaid;

  if (paymentAmount > remaining) {
    return {
      valid: false,
      message: `Payment amount (₹${paymentAmount}) exceeds remaining balance (₹${remaining})`,
    };
  }

  return { valid: true };
};

/**
 * Format amount in Indian currency format
 */
export const formatIndianCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Convert number to words (Indian numbering system)
 */
export const numberToWords = (num: number): string => {
  if (num === 0) return 'Zero Rupees Only';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

  const convertLessThanThousand = (n: number): string => {
    if (n === 0) return '';
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertLessThanThousand(n % 100) : '');
  };

  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);

  let result = '';
  let remainingRupees = rupees;

  if (remainingRupees >= 10000000) {
    const crores = Math.floor(remainingRupees / 10000000);
    result += convertLessThanThousand(crores) + ' Crore ';
    remainingRupees %= 10000000;
  }

  if (remainingRupees >= 100000) {
    const lakhs = Math.floor(remainingRupees / 100000);
    result += convertLessThanThousand(lakhs) + ' Lakh ';
    remainingRupees %= 100000;
  }

  if (remainingRupees >= 1000) {
    const thousands = Math.floor(remainingRupees / 1000);
    result += convertLessThanThousand(thousands) + ' Thousand ';
    remainingRupees %= 1000;
  }

  if (remainingRupees > 0) {
    result += convertLessThanThousand(remainingRupees);
  }

  result = result.trim() + ' Rupees';

  if (paise > 0) {
    result += ' and ' + convertLessThanThousand(paise) + ' Paise';
  }

  return result + ' Only';
};

/**
 * GST Calculation Service for India Compliance
 * Handles CGST/SGST/IGST calculations based on place of supply
 */

export interface GSTCalculationInput {
  amount: number;
  gstRate: number;
  placeOfSupply: string; // State code or name
  societyState: string; // Society's state
  isInterState?: boolean; // Override automatic detection
}

export interface GSTCalculationResult {
  taxableAmount: number;
  gstRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  totalAmount: number;
  isInterState: boolean;
}

export interface LineItemGSTInput {
  lineItemName: string;
  amount: number;
  taxable: boolean;
  gstRate?: number;
}

export interface InvoiceGSTInput {
  lineItems: LineItemGSTInput[];
  defaultGstRate: number;
  placeOfSupply: string;
  societyState: string;
}

export interface InvoiceGSTResult {
  lineItems: Array<{
    lineItemName: string;
    amount: number;
    taxable: boolean;
    gstRate: number;
    cgst: number;
    sgst: number;
    igst: number;
    totalWithTax: number;
  }>;
  subtotal: number;
  totalCGST: number;
  totalSGST: number;
  totalIGST: number;
  totalTax: number;
  grandTotal: number;
  isInterState: boolean;
}

/**
 * Normalizes state name/code for comparison
 */
const normalizeState = (state: string): string => {
  return state.trim().toUpperCase().replace(/\s+/g, '');
};

/**
 * Determines if the transaction is inter-state
 */
export const isInterStateTransaction = (
  placeOfSupply: string,
  societyState: string
): boolean => {
  const normalizedSupply = normalizeState(placeOfSupply);
  const normalizedSociety = normalizeState(societyState);

  return normalizedSupply !== normalizedSociety;
};

/**
 * Calculates GST for a single amount
 */
export const calculateGST = (input: GSTCalculationInput): GSTCalculationResult => {
  const { amount, gstRate, placeOfSupply, societyState, isInterState: forceInterState } = input;

  // Determine if inter-state or intra-state
  const isInterState =
    forceInterState !== undefined
      ? forceInterState
      : isInterStateTransaction(placeOfSupply, societyState);

  // Calculate tax amount
  const totalTax = (amount * gstRate) / 100;

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (isInterState) {
    // Inter-state: Full IGST
    igst = totalTax;
  } else {
    // Intra-state: Split equally between CGST and SGST
    cgst = totalTax / 2;
    sgst = totalTax / 2;
  }

  // Round to 2 decimal places
  const round = (num: number) => Math.round(num * 100) / 100;

  return {
    taxableAmount: round(amount),
    gstRate,
    cgst: round(cgst),
    sgst: round(sgst),
    igst: round(igst),
    totalTax: round(totalTax),
    totalAmount: round(amount + totalTax),
    isInterState,
  };
};

/**
 * Calculates GST for multiple line items (invoice)
 */
export const calculateInvoiceGST = (input: InvoiceGSTInput): InvoiceGSTResult => {
  const { lineItems, defaultGstRate, placeOfSupply, societyState } = input;

  const isInterState = isInterStateTransaction(placeOfSupply, societyState);

  let subtotal = 0;
  let totalCGST = 0;
  let totalSGST = 0;
  let totalIGST = 0;

  const processedLineItems = lineItems.map((item) => {
    const amount = item.amount;
    subtotal += amount;

    if (!item.taxable) {
      return {
        lineItemName: item.lineItemName,
        amount,
        taxable: false,
        gstRate: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalWithTax: amount,
      };
    }

    const gstRate = item.gstRate !== undefined ? item.gstRate : defaultGstRate;

    const gstCalc = calculateGST({
      amount,
      gstRate,
      placeOfSupply,
      societyState,
      isInterState,
    });

    totalCGST += gstCalc.cgst;
    totalSGST += gstCalc.sgst;
    totalIGST += gstCalc.igst;

    return {
      lineItemName: item.lineItemName,
      amount,
      taxable: true,
      gstRate,
      cgst: gstCalc.cgst,
      sgst: gstCalc.sgst,
      igst: gstCalc.igst,
      totalWithTax: gstCalc.totalAmount,
    };
  });

  const totalTax = totalCGST + totalSGST + totalIGST;
  const grandTotal = subtotal + totalTax;

  const round = (num: number) => Math.round(num * 100) / 100;

  return {
    lineItems: processedLineItems,
    subtotal: round(subtotal),
    totalCGST: round(totalCGST),
    totalSGST: round(totalSGST),
    totalIGST: round(totalIGST),
    totalTax: round(totalTax),
    grandTotal: round(grandTotal),
    isInterState,
  };
};

/**
 * Calculates round-off amount (for invoice total)
 */
export const calculateRoundOff = (amount: number): { roundOff: number; roundedAmount: number } => {
  const rounded = Math.round(amount);
  const roundOff = rounded - amount;

  return {
    roundOff: Math.round(roundOff * 100) / 100,
    roundedAmount: rounded,
  };
};

/**
 * Applies round-off to invoice GST result
 */
export const applyRoundOff = (
  gstResult: InvoiceGSTResult
): InvoiceGSTResult & { roundOff: number; finalAmount: number } => {
  const { roundOff, roundedAmount } = calculateRoundOff(gstResult.grandTotal);

  return {
    ...gstResult,
    roundOff,
    finalAmount: roundedAmount,
  };
};

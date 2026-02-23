/**
 * Safe formula evaluator for billing calculations
 * Supports basic arithmetic operations without arbitrary code execution
 */

export type BasisType =
  | 'FLAT'
  | 'PER_BHK'
  | 'PER_SQFT'
  | 'PER_WATER_READING'
  | 'PER_DG_READING'
  | 'PER_METER_READING'
  | 'PER_CUSTOM_KEY'
  | 'FORMULA';

export interface MemberVariables {
  bhk?: number;
  sqft?: number;
  waterReading?: number;
  dgReading?: number;
  meterReading?: number;
  [key: string]: number | string | undefined;
}

export interface LineItemConfig {
  basisType: BasisType;
  rate: number;
  customKey?: string;
  formulaText?: string;
}

export interface CalculationResult {
  units: number;
  rate: number;
  amount: number;
}

/**
 * Calculate line item amount based on basis type
 */
export const calculateLineItemAmount = (
  config: LineItemConfig,
  memberVariables: MemberVariables
): CalculationResult => {
  const { basisType, rate, customKey, formulaText } = config;

  switch (basisType) {
    case 'FLAT':
      return {
        units: 1,
        rate,
        amount: rate,
      };

    case 'PER_BHK': {
      const bhk = memberVariables.bhk || 0;
      return {
        units: bhk,
        rate,
        amount: bhk * rate,
      };
    }

    case 'PER_SQFT': {
      const sqft = memberVariables.sqft || 0;
      return {
        units: sqft,
        rate,
        amount: sqft * rate,
      };
    }

    case 'PER_WATER_READING': {
      const waterReading = memberVariables.waterReading || 0;
      return {
        units: waterReading,
        rate,
        amount: waterReading * rate,
      };
    }

    case 'PER_DG_READING': {
      const dgReading = memberVariables.dgReading || 0;
      return {
        units: dgReading,
        rate,
        amount: dgReading * rate,
      };
    }

    case 'PER_METER_READING': {
      const meterReading = memberVariables.meterReading || 0;
      return {
        units: meterReading,
        rate,
        amount: meterReading * rate,
      };
    }

    case 'PER_CUSTOM_KEY': {
      if (!customKey) {
        throw new Error('Custom key is required for PER_CUSTOM_KEY basis type');
      }
      const customValue = memberVariables[customKey];
      const units = typeof customValue === 'number' ? customValue : 0;
      return {
        units,
        rate,
        amount: units * rate,
      };
    }

    case 'FORMULA': {
      if (!formulaText) {
        throw new Error('Formula text is required for FORMULA basis type');
      }
      const result = evaluateFormula(formulaText, memberVariables);
      return {
        units: 1,
        rate: result,
        amount: result,
      };
    }

    default:
      throw new Error(`Unsupported basis type: ${basisType}`);
  }
};

/**
 * Safe formula evaluator
 * Supports basic arithmetic: +, -, *, /, (), and variable references
 */
export const evaluateFormula = (
  formula: string,
  variables: MemberVariables
): number => {
  // Remove whitespace
  const cleanFormula = formula.replace(/\s+/g, '');

  // Validate formula contains only safe characters
  const safePattern = /^[a-zA-Z0-9_+\-*/().]+$/;
  if (!safePattern.test(cleanFormula)) {
    throw new Error('Formula contains invalid characters');
  }

  // Replace variable names with their values
  let processedFormula = cleanFormula;
  for (const [key, value] of Object.entries(variables)) {
    if (typeof value === 'number') {
      const regex = new RegExp(`\\b${key}\\b`, 'g');
      processedFormula = processedFormula.replace(regex, String(value));
    }
  }

  // Validate no unresolved variables remain
  if (/[a-zA-Z_]/.test(processedFormula)) {
    throw new Error('Formula contains undefined variables');
  }

  // Safely evaluate the mathematical expression
  try {
    // Use Function constructor with restricted scope (safer than eval)
    // Only mathematical operations are allowed
    const result = Function(`"use strict"; return (${processedFormula})`)();

    if (typeof result !== 'number' || !isFinite(result)) {
      throw new Error('Formula evaluation did not produce a valid number');
    }

    return result;
  } catch (error) {
    throw new Error(
      `Formula evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

/**
 * Calculate total invoice amount with tax
 */
export const calculateInvoiceTotal = (
  lineItems: CalculationResult[],
  taxableItems: boolean[],
  taxRate: number
): { subtotal: number; taxAmount: number; totalAmount: number } => {
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);

  const taxableAmount = lineItems.reduce((sum, item, index) => {
    if (taxableItems[index]) {
      return sum + item.amount;
    }
    return sum;
  }, 0);

  const taxAmount = (taxableAmount * taxRate) / 100;
  const totalAmount = subtotal + taxAmount;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
};

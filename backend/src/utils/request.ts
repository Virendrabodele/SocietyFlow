/**
 * Helper to safely get string param from Express Request
 */
export const getStringParam = (param: string | string[] | undefined): string => {
  if (Array.isArray(param)) {
    return param[0] || '';
  }
  return param || '';
};

/**
 * Helper to safely get optional string param
 */
export const getOptionalStringParam = (param: string | string[] | undefined): string | undefined => {
  if (Array.isArray(param)) {
    return param[0];
  }
  return param;
};

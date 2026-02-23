// Utility to safely extract string from query parameters
export const getStringParam = (param: string | string[] | undefined): string | undefined => {
  if (Array.isArray(param)) {
    return param[0];
  }
  return param;
};

export const getStringParamOrThrow = (param: string | string[] | undefined, name: string): string => {
  const value = getStringParam(param);
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

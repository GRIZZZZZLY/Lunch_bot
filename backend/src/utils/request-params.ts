export const getParam = (
  params: Record<string, string | string[] | undefined>,
  key: string
): string => {
  const value = params[key];

  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const SAFE_POST_PATHS = new Set([
  '/api/auth/refresh',
  '/api/auth/validate',
  '/api/user/avatars/batch',
]);

export function isAllowedProductionApiRequest(method: string, pathname: string): boolean {
  const normalizedMethod = method.toUpperCase();
  return (
    SAFE_METHODS.has(normalizedMethod) ||
    (normalizedMethod === 'POST' && SAFE_POST_PATHS.has(pathname))
  );
}

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { requestContext } from '../../utils/request-context';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

/**
 * Attach a stable request id to every incoming request.
 * Honors an inbound X-Request-ID header (proxy / client correlation), otherwise
 * generates a UUID v4. Also reflected back to the caller via response header so
 * a user-reported error can be traced to log lines + error responses.
 *
 * Wraps downstream middleware in AsyncLocalStorage scope so any logger.* call
 * inside the request automatically inherits requestId without manual threading.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const inbound = req.get('X-Request-ID');
  const requestId = inbound && inbound.length <= 64 ? inbound : randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  requestContext.run({ requestId }, () => next());
}

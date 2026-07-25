import { timingSafeEqual } from 'crypto';
import { NextFunction, Request, Response } from 'express';

const OPERATIONS_SECRET_HEADER = 'x-operations-secret';

function secretsMatch(received: string, expected: string): boolean {
  const receivedBuffer = Buffer.from(received, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(receivedBuffer, expectedBuffer);
}

/**
 * Защищает редкие системные операции, которые не относятся к роли внутри
 * конкретной группы. Одних глобальных прав чтения для таких действий
 * недостаточно: маршрут должен быть явно включён и вызван с отдельным секретом.
 */
export function operationsApiMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (process.env.ENABLE_OPERATIONS_API !== 'true') {
    res.status(404).json({
      success: false,
      error: 'Not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  const expected = process.env.OPERATIONS_API_SECRET;
  const received = req.header(OPERATIONS_SECRET_HEADER);

  if (
    !expected ||
    expected.length < 32 ||
    !received ||
    !secretsMatch(received, expected)
  ) {
    res.status(403).json({
      success: false,
      error: 'Operations authorization required',
      code: 'OPERATIONS_ACCESS_DENIED',
    });
    return;
  }

  next();
}

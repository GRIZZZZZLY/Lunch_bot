/**
 * Avatar signed-URL middleware.
 *
 * Заменяет `telegramAuthMiddleware` на `/api/avatar/:fileId`, потому что
 * <img src> не несёт Bearer. Доступ разрешён только по короткоживущей
 * HMAC-подписи в query (?exp=&sig=), которую выдаёт проверенный API аватаров.
 */

import { Request, Response, NextFunction } from 'express';
import { verifyAvatarSignature, AVATAR_SIG_PARAMS } from '../../utils/avatar-url-signer';
import { logger } from '../../utils/logger';

export async function avatarAccessMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const fileId = typeof req.params.fileId === 'string' ? req.params.fileId : '';
  // req.query[...] имеет тип string | ParsedQs | (string | ParsedQs)[] | undefined.
  // Берём только если строка — иначе игнорируем (массивы и nested objects = атака).
  const rawSig = req.query[AVATAR_SIG_PARAMS.SIG_PARAM];
  const rawExp = req.query[AVATAR_SIG_PARAMS.EXP_PARAM];
  const sig = typeof rawSig === 'string' ? rawSig : undefined;
  const exp = typeof rawExp === 'string' ? rawExp : undefined;

  if (sig || exp) {
    const result = verifyAvatarSignature(fileId, exp, sig);
    if (result.ok) {
      return next();
    }
    logger.warn('avatarAccess: signature rejected', {
      fileId,
      reason: result.reason,
      ip: req.ip,
    });
    res.status(401).json({
      success: false,
      error: `Avatar signature invalid: ${result.reason}`,
      code: 'AVATAR_SIG_INVALID',
    });
    return;
  }

  res.status(401).json({
    success: false,
    error: 'Missing avatar signature',
    code: 'AVATAR_AUTH_REQUIRED',
  });
}

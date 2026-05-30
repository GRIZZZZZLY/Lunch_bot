/**
 * Avatar signed-URL middleware.
 *
 * Заменяет `telegramAuthMiddleware` на `/api/avatar/:fileId`, потому что
 * <img src> не несёт Bearer. Принимает либо валидную HMAC-подпись в query
 * (?exp=&sig=), либо — для обратной совместимости — Bearer от уже-аутентифицированного
 * клиента (например, превью в админке).
 */

import { Request, Response, NextFunction } from 'express';
import { verifyAvatarSignature, AVATAR_SIG_PARAMS } from '../../utils/avatar-url-signer';
import { JwtService } from '../../services/jwt.service';
import { UserService } from '../../services/user.service';
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

  // 1) Signed-URL path — основной.
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

  // 2) Bearer fallback — для legacy callers (превью в админке, devtools).
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = JwtService.verifyToken(token);
      if (decoded?.type === 'access') {
        const user = await UserService.getUserById(decoded.userId);
        if (user?.isActive) {
          (req as any).user = user;
          return next();
        }
      }
    } catch {
      /* fall through to 401 */
    }
  }

  res.status(401).json({
    success: false,
    error: 'Missing avatar signature or valid bearer token',
    code: 'AVATAR_AUTH_REQUIRED',
  });
}

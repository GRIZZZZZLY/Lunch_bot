import { Request, Response, NextFunction } from 'express';
import { GroupService } from '../../services/group.service';
import { logger } from '../../utils/logger';
import { collapseRepeatedValue } from './validate';

function resolveGroupId(req: Request): number | null {
  /* `collapseRepeatedValue` здесь важнее, чем в контроллерах: от этого значения
     зависит РЕШЕНИЕ О ДОСТУПЕ. `?groupId=5&groupId=5` приходит массивом, и
     `parseInt(['5','5'])` возвращал 5 только по случайности — массив приводится
     к строке `'5,5'`. `?groupId=5&groupId=7` тем же путём дал бы 5, то есть
     проверку прав по ОДНОЙ группе при намерении обратиться к другой; теперь
     такой запрос не проходит вовсе. */
  const raw: unknown = collapseRepeatedValue(
    req.params?.groupId ?? req.query?.groupId ?? (req.body as { groupId?: unknown })?.groupId
  );
  if (raw === undefined || raw === null || raw === '') return null;

  const groupId = Number(raw);
  return Number.isInteger(groupId) && groupId > 0 ? groupId : null;
}

export async function requireGroupAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, error: 'User not authenticated', code: 'NOT_AUTHENTICATED' });
      return;
    }
    const groupId = resolveGroupId(req);
    if (!groupId) {
      res.status(400).json({ success: false, error: 'groupId is required', code: 'MISSING_GROUP_ID' });
      return;
    }
    const isAdmin = await GroupService.isUserGroupAdmin(user.id, groupId);
    if (!isAdmin) {
      res.status(403).json({ success: false, error: 'Group admin access required', code: 'ACCESS_DENIED' });
      return;
    }
    next();
  } catch (error) {
    logger.error('requireGroupAdmin error:', error);
    res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

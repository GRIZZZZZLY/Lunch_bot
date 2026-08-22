import { Request, Response, NextFunction } from 'express';
import { GroupService } from '../../services/group.service';
import { logger } from '../../utils/logger';

function resolveGroupId(req: Request): number | null {
  const raw = (req.params?.groupId ?? req.query?.groupId ?? (req.body && req.body.groupId)) as
    | string | number | undefined;
  const n = typeof raw === 'string' ? parseInt(raw, 10) : raw;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
}

export async function groupAdminMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
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
    logger.error('groupAdminMiddleware error:', error);
    res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

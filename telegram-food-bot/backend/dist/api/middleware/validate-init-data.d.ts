import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types/api.types';
export declare function validateInitDataMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
export declare function requireAdminMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
export declare function optionalAuthMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=validate-init-data.d.ts.map
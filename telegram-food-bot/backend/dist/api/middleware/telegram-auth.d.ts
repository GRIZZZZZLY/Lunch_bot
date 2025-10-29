import { Request, Response, NextFunction } from 'express';
export declare function telegramAuthMiddleware(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function adminMiddleware(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function validateInitDataMiddleware(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function refreshTokenMiddleware(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=telegram-auth.d.ts.map
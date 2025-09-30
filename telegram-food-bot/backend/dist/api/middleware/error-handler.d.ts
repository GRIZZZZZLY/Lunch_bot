import { Request, Response, NextFunction } from 'express';
export declare function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void;
export declare function notFoundHandler(req: Request, res: Response, next: NextFunction): void;
export declare function requestLogger(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=error-handler.d.ts.map
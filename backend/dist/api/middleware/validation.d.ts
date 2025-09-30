import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
export declare function validateMenuItemData(req: Request, res: Response, next: NextFunction): void;
export declare function validatePollData(req: Request, res: Response, next: NextFunction): void;
export declare function validateVoteData(req: Request, res: Response, next: NextFunction): void;
export declare function validateIdParam(paramName?: string): (req: Request, res: Response, next: NextFunction) => void;
export declare function validatePaginationParams(req: Request, res: Response, next: NextFunction): void;
export declare function validateWithSchema(schema: z.ZodSchema): (req: Request, res: Response, next: NextFunction) => void;
export declare function sanitizeStrings(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=validation.d.ts.map
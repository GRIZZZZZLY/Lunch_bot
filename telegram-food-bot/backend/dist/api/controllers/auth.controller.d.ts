import { Request, Response } from 'express';
export declare class AuthController {
    static validateInitData(req: Request, res: Response): Promise<void>;
    static getCurrentUser(req: Request, res: Response): Promise<void>;
    static getAuthStatus(req: Request, res: Response): Promise<void>;
    static refreshAuth(req: Request, res: Response): Promise<void>;
}
export declare const authController: typeof AuthController;
//# sourceMappingURL=auth.controller.d.ts.map
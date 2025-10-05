import { Request, Response } from 'express';
export declare class UserController {
    static getCurrentUser(req: Request, res: Response): Promise<void>;
    static getPaymentInfo(req: Request, res: Response): Promise<void>;
    static updatePaymentInfo(req: Request, res: Response): Promise<void>;
    static getUserGroups(req: Request, res: Response): Promise<void>;
}
export declare const userController: typeof UserController;
//# sourceMappingURL=user.controller.d.ts.map
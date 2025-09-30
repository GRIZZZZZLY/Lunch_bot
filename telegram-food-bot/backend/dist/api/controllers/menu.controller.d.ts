import { Request, Response } from 'express';
export declare class MenuController {
    static getAllItems(req: Request, res: Response): Promise<void>;
    static getActiveItems(req: Request, res: Response): Promise<void>;
    static getCategories(req: Request, res: Response): Promise<void>;
    static getPopularItems(req: Request, res: Response): Promise<void>;
    static getMenuStats(req: Request, res: Response): Promise<void>;
    static searchItems(req: Request, res: Response): Promise<void>;
    static getItemById(req: Request, res: Response): Promise<void>;
    static createItem(req: Request, res: Response): Promise<void>;
    static updateItem(req: Request, res: Response): Promise<void>;
    static toggleItemStatus(req: Request, res: Response): Promise<void>;
    static deleteItem(req: Request, res: Response): Promise<void>;
    static bulkUpdateStatus(req: Request, res: Response): Promise<void>;
}
export declare const menuController: typeof MenuController;
//# sourceMappingURL=menu.controller.d.ts.map
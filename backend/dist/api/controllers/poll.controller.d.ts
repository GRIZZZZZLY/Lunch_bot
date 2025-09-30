import { Request, Response } from 'express';
export declare class PollController {
    static getActivePolls(req: Request, res: Response): Promise<void>;
    static getPollHistory(req: Request, res: Response): Promise<void>;
    static getPollStats(req: Request, res: Response): Promise<void>;
    static getPollById(req: Request, res: Response): Promise<void>;
    static getPollResults(req: Request, res: Response): Promise<void>;
    static getPollVotes(req: Request, res: Response): Promise<void>;
    static createPoll(req: Request, res: Response): Promise<void>;
    static completePoll(req: Request, res: Response): Promise<void>;
    static cancelPoll(req: Request, res: Response): Promise<void>;
    static vote(req: Request, res: Response): Promise<void>;
    static removeVote(req: Request, res: Response): Promise<void>;
    static runRoulette(req: Request, res: Response): Promise<void>;
}
export declare const pollController: typeof PollController;
//# sourceMappingURL=poll.controller.d.ts.map
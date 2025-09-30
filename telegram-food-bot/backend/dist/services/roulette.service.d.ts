import { PollResult } from '../types/database.types';
export interface RouletteResult {
    responsibleUserId: number;
    responsibleUserName: string;
    winnerMenuItemId?: number;
    winnerMenuItemName?: string;
    totalVotes: number;
    animationData: {
        participants: string[];
        steps: {
            step: number;
            message: string;
            delay: number;
        }[];
    };
}
export declare class RouletteService {
    runRoulette(pollId: number): Promise<RouletteResult>;
    saveResult(pollId: number, result: RouletteResult): Promise<PollResult>;
    getResult(pollId: number): Promise<PollResult | null>;
    private generateRouletteAnimation;
    getAnimationMessages(animationData: any): Promise<string[]>;
    canRunRoulette(pollId: number): Promise<{
        canRun: boolean;
        reason?: string;
    }>;
    getStats(groupId?: number): Promise<{
        totalRoulettes: number;
        roulettesToday: number;
        topResponsible: {
            userId: number;
            count: number;
        }[];
    }>;
}
export declare const rouletteService: RouletteService;
//# sourceMappingURL=roulette.service.d.ts.map
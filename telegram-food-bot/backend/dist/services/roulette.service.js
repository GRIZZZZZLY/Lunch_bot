"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rouletteService = exports.RouletteService = void 0;
const client_1 = require("../database/client");
const logger_1 = require("../utils/logger");
const vote_service_1 = require("./vote.service");
class RouletteService {
    async runRoulette(pollId) {
        try {
            const voters = await vote_service_1.VoteService.getVoters(pollId);
            if (voters.length === 0) {
                throw new Error('Никто не голосовал, рулетка невозможна');
            }
            const mostPopular = await vote_service_1.VoteService.getMostPopularMenuItem(pollId);
            const randomIndex = Math.floor(Math.random() * voters.length);
            const responsible = voters[randomIndex];
            const animationData = this.generateRouletteAnimation(voters.map(v => v.userName));
            const result = {
                responsibleUserId: responsible.userId,
                responsibleUserName: responsible.userName,
                winnerMenuItemId: mostPopular?.menuItemId,
                winnerMenuItemName: mostPopular ?
                    voters.find(v => v.userId === responsible.userId)?.menuItemName :
                    undefined,
                totalVotes: voters.length,
                animationData,
            };
            logger_1.logger.info('Рулетка завершена', {
                pollId,
                responsibleUserId: result.responsibleUserId,
                winnerMenuItemId: result.winnerMenuItemId,
                totalVotes: result.totalVotes,
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Ошибка запуска рулетки:', error);
            throw error;
        }
    }
    async saveResult(pollId, result) {
        try {
            const pollResult = await client_1.prisma.pollResult.create({
                data: {
                    pollId,
                    responsibleUserId: result.responsibleUserId,
                    winnerMenuItemId: result.winnerMenuItemId,
                    totalVotes: result.totalVotes,
                    rouletteData: JSON.stringify(result.animationData),
                },
                include: {
                    poll: true,
                    responsibleUser: true,
                    winnerMenuItem: true,
                },
            });
            logger_1.logger.info('Результат рулетки сохранен', {
                id: pollResult.id,
                pollId: pollResult.pollId,
            });
            return pollResult;
        }
        catch (error) {
            logger_1.logger.error('Ошибка сохранения результата рулетки:', error);
            throw error;
        }
    }
    async getResult(pollId) {
        try {
            return await client_1.prisma.pollResult.findUnique({
                where: { pollId },
                include: {
                    poll: true,
                    responsibleUser: true,
                    winnerMenuItem: true,
                },
            });
        }
        catch (error) {
            logger_1.logger.error('Ошибка получения результата рулетки:', error);
            throw error;
        }
    }
    generateRouletteAnimation(participants) {
        if (participants.length === 0) {
            return { participants: [], steps: [] };
        }
        const steps = [];
        const shuffledParticipants = [...participants].sort(() => Math.random() - 0.5);
        steps.push({
            step: 0,
            message: '🎲 Запускаем рулетку...',
            delay: 1000,
        });
        steps.push({
            step: 1,
            message: `👥 Участвуют: ${participants.length} человек`,
            delay: 1500,
        });
        const animationSteps = Math.min(8, participants.length * 2);
        for (let i = 0; i < animationSteps; i++) {
            const randomParticipant = shuffledParticipants[i % shuffledParticipants.length];
            const speed = 500 + (i * 200);
            steps.push({
                step: i + 2,
                message: `🎯 ${randomParticipant}...`,
                delay: speed,
            });
        }
        const winner = shuffledParticipants[shuffledParticipants.length - 1];
        steps.push({
            step: steps.length + 1,
            message: '🥁 И победитель...',
            delay: 2000,
        });
        steps.push({
            step: steps.length + 1,
            message: `🎉 ${winner}!`,
            delay: 1000,
        });
        return {
            participants: shuffledParticipants,
            steps,
        };
    }
    async getAnimationMessages(animationData) {
        if (!animationData || !animationData.steps) {
            return ['🎲 Рулетка завершена'];
        }
        return animationData.steps.map((step) => step.message);
    }
    async canRunRoulette(pollId) {
        try {
            const existingResult = await this.getResult(pollId);
            if (existingResult) {
                return { canRun: false, reason: 'Рулетка уже была проведена для этого голосования' };
            }
            const voters = await vote_service_1.VoteService.getVoters(pollId);
            if (voters.length === 0) {
                return { canRun: false, reason: 'Никто не голосовал' };
            }
            return { canRun: true };
        }
        catch (error) {
            logger_1.logger.error('Ошибка проверки возможности запуска рулетки:', error);
            return { canRun: false, reason: 'Ошибка проверки' };
        }
    }
    async getStats(groupId) {
        try {
            const where = groupId ? { poll: { groupId } } : {};
            const [totalRoulettes, roulettesToday] = await Promise.all([
                client_1.prisma.pollResult.count({ where }),
                client_1.prisma.pollResult.count({
                    where: {
                        ...where,
                        createdAt: {
                            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                        },
                    },
                }),
            ]);
            const topResponsible = await client_1.prisma.pollResult.groupBy({
                by: ['responsibleUserId'],
                where,
                _count: {
                    responsibleUserId: true,
                },
                orderBy: {
                    _count: {
                        responsibleUserId: 'desc',
                    },
                },
                take: 5,
            });
            return {
                totalRoulettes,
                roulettesToday,
                topResponsible: topResponsible.map(item => ({
                    userId: item.responsibleUserId,
                    count: item._count.responsibleUserId,
                })),
            };
        }
        catch (error) {
            logger_1.logger.error('Ошибка получения статистики рулеток:', error);
            throw error;
        }
    }
}
exports.RouletteService = RouletteService;
exports.rouletteService = new RouletteService();

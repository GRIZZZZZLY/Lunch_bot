"use strict";
async;
savePollResult(data, {
    pollId: number,
    winnerMenuItemId: number,
    responsibleUserId: number,
    totalVotes: number,
    rouletteData: string
});
Promise < PollResult > {
    try: {
        const: existing = await prisma.pollResult.findUnique({
            where: { pollId: data.pollId },
        }),
        if(existing) {
            const result = await prisma.pollResult.update({
                where: { pollId: data.pollId },
                data: {
                    responsibleUserId: data.responsibleUserId,
                    updatedAt: new Date(),
                },
                include: {
                    poll: true,
                    winnerMenuItem: true,
                    responsibleUser: true,
                },
            });
            logger.info(`Poll result updated for poll ${data.pollId}`);
            return result;
        }, else: {
            const: result = await prisma.pollResult.create({
                data: {
                    pollId: data.pollId,
                    winnerMenuItemId: data.winnerMenuItemId,
                    responsibleUserId: data.responsibleUserId,
                    totalVotes: data.totalVotes,
                },
                include: {
                    poll: true,
                    winnerMenuItem: true,
                    responsibleUser: true,
                },
            }),
            logger, : .info(`Poll result created for poll ${data.pollId}`),
            return: result
        }
    }, catch(error) {
        logger.error('Error saving poll result:', error);
        throw new Error('Failed to save poll result');
    }
};
//# sourceMappingURL=poll.service.additions.js.map
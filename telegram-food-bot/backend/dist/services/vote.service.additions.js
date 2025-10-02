"use strict";
async;
createVote(data, CreateVoteData);
Promise < Vote > {
    try: {
        const: vote = await prisma.vote.create({
            data: {
                pollId: data.pollId,
                userId: data.userId,
                menuItemId: data.menuItemId,
            },
        }),
        logger, : .info(`Vote created: user ${data.userId} voted for item ${data.menuItemId} in poll ${data.pollId}`),
        return: vote
    }, catch(error) {
        logger.error('Error creating vote:', error);
        throw new Error('Failed to create vote');
    }
};
async;
updateVote(voteId, number, menuItemId, number);
Promise < Vote > {
    try: {
        const: vote = await prisma.vote.update({
            where: { id: voteId },
            data: {
                menuItemId,
                updatedAt: new Date(),
            },
        }),
        logger, : .info(`Vote updated: vote ${voteId} changed to item ${menuItemId}`),
        return: vote
    }, catch(error) {
        logger.error('Error updating vote:', error);
        throw new Error('Failed to update vote');
    }
};
async;
getVoteBreakdown(pollId, number);
Promise < Array < {
    menuItemId: number,
    menuItemName: string,
    votes: number,
    percentage: number,
    voters: (Array)
} >> {
    try: {
        const: votes = await prisma.vote.findMany({
            where: { pollId },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        username: true,
                    },
                },
                menuItem: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        }),
        const: totalVotes = votes.length,
        const: breakdown = new Map(),
        votes, : .forEach(vote => {
            const existing = breakdown.get(vote.menuItemId) || {
                menuItemName: vote.menuItem.name,
                votes: 0,
                voters: [],
            };
            existing.votes++;
            existing.voters.push({
                id: vote.user.id,
                firstName: vote.user.firstName,
                username: vote.user.username || undefined,
            });
            breakdown.set(vote.menuItemId, existing);
        }),
        return: Array.from(breakdown.entries())
            .map(([menuItemId, data]) => ({
            menuItemId,
            menuItemName: data.menuItemName,
            votes: data.votes,
            percentage: totalVotes > 0 ? Math.round((data.votes / totalVotes) * 100) : 0,
            voters: data.voters,
        }))
            .sort((a, b) => b.votes - a.votes)
    }, catch(error) {
        logger.error('Error getting vote breakdown:', error);
        throw new Error('Failed to get vote breakdown');
    }
};
//# sourceMappingURL=vote.service.additions.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function testActivePolls() {
    try {
        console.log('🔍 Testing active polls query...\n');
        const polls = await prisma.poll.findMany({
            where: { status: 'ACTIVE' },
            include: {
                group: true,
                votes: {
                    include: {
                        user: true,
                        menuItem: true,
                    },
                },
                _count: {
                    select: {
                        votes: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        console.log(`📊 Found ${polls.length} active polls\n`);
        if (polls.length > 0) {
            const poll = polls[0];
            console.log('First poll:', {
                id: poll.id,
                groupId: poll.groupId,
                status: poll.status,
                duration: poll.duration,
                startedAt: poll.startedAt,
                endedAt: poll.endedAt,
                chatId: poll.chatId?.toString(),
                voteCount: poll._count.votes,
            });
            try {
                const serialized = {
                    ...poll,
                    chatId: poll.chatId ? poll.chatId.toString() : null,
                };
                const jsonString = JSON.stringify(serialized);
                console.log('\n✅ Serialization successful!');
            }
            catch (error) {
                console.error('\n❌ Serialization failed:', error.message);
            }
        }
    }
    catch (error) {
        console.error('❌ Error:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
testActivePolls();
//# sourceMappingURL=test-active-polls.js.map
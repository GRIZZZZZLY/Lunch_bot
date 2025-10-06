"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function checkPolls() {
    try {
        console.log('🔍 Checking polls in database...\n');
        const allPolls = await prisma.poll.findMany({
            include: {
                _count: {
                    select: {
                        votes: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: 10,
        });
        console.log(`📊 Total polls: ${allPolls.length}\n`);
        if (allPolls.length === 0) {
            console.log('❌ No polls found in database');
            return;
        }
        console.log('Recent polls:');
        allPolls.forEach((poll, i) => {
            console.log(`\n${i + 1}. Poll ID: ${poll.id}`);
            console.log(`   Question: ${poll.question}`);
            console.log(`   Status: ${poll.status}`);
            console.log(`   Votes: ${poll._count.votes}`);
            console.log(`   Starts: ${poll.startsAt}`);
            console.log(`   Ends: ${poll.endsAt}`);
            console.log(`   Created: ${poll.createdAt}`);
        });
        const activePolls = allPolls.filter((p) => p.status === 'ACTIVE');
        console.log(`\n✅ Active polls: ${activePolls.length}`);
    }
    catch (error) {
        console.error('❌ Error:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
checkPolls();
//# sourceMappingURL=check-polls.js.map
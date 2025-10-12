"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function checkPolls() {
    console.log('');
    console.log('========================================');
    console.log('  Check All Polls Status');
    console.log('========================================');
    console.log('');
    try {
        const allPolls = await prisma.poll.findMany({
            include: {
                group: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        const now = new Date();
        console.log(`Current time: ${now.toISOString()}`);
        console.log('');
        if (allPolls.length === 0) {
            console.log('No polls found in database');
            return;
        }
        console.log(`Found ${allPolls.length} poll(s):\n`);
        for (const poll of allPolls) {
            console.log(`Poll ID: ${poll.id}`);
            console.log(`  Group: ${poll.group.title} (ID: ${poll.groupId})`);
            console.log(`  Status in DB: ${poll.status}`);
            console.log(`  Duration: ${poll.duration} minutes`);
            console.log(`  Started: ${poll.startedAt?.toISOString() || 'null'}`);
            console.log(`  Should end: ${poll.endedAt?.toISOString() || 'null'}`);
            if (poll.endedAt) {
                const hoursSinceEnd = Math.floor((now.getTime() - new Date(poll.endedAt).getTime()) / (1000 * 60 * 60));
                const isExpired = new Date(poll.endedAt) < now;
                console.log(`  Is expired: ${isExpired ? 'YES' : 'NO'}`);
                if (isExpired) {
                    console.log(`  Hours ago: ${hoursSinceEnd}h`);
                }
            }
            console.log('');
        }
        const expiredActive = allPolls.filter(p => p.status === 'ACTIVE' && p.endedAt && new Date(p.endedAt) < now);
        if (expiredActive.length > 0) {
            console.log('========================================');
            console.log('⚠️  EXPIRED POLLS WITH ACTIVE STATUS:');
            console.log('========================================');
            console.log('');
            for (const poll of expiredActive) {
                console.log(`❌ Poll ${poll.id} - "${poll.group.title}"`);
                console.log(`   Ended: ${poll.endedAt?.toISOString()}`);
                console.log(`   Hours ago: ${Math.floor((now.getTime() - new Date(poll.endedAt).getTime()) / (1000 * 60 * 60))}h`);
                console.log('');
            }
        }
        else {
            console.log('========================================');
            console.log('✅ All polls have correct status!');
            console.log('========================================');
        }
    }
    catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
    finally {
        await prisma.$disconnect();
    }
}
checkPolls()
    .then(() => {
    process.exit(0);
})
    .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
});
//# sourceMappingURL=check-polls.js.map
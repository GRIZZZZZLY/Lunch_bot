"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function closePoll() {
    try {
        console.log('🔄 Closing Poll ID 9...');
        const poll = await prisma.poll.update({
            where: { id: 10 },
            data: {
                status: 'COMPLETED',
                endedAt: new Date(),
            },
        });
        console.log('✅ Poll closed:', poll);
    }
    catch (error) {
        console.error('❌ Error:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
closePoll();
//# sourceMappingURL=close-poll.js.map
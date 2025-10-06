"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function makeAdmin() {
    try {
        console.log('🔄 Making user 555502880 (Игорь) an admin...');
        const user = await prisma.user.update({
            where: { telegramId: 555502880 },
            data: { isAdmin: true },
        });
        console.log('✅ User is now admin:', user);
    }
    catch (error) {
        console.error('❌ Error:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
makeAdmin();
//# sourceMappingURL=make-admin.js.map
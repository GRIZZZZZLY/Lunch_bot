"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function checkUsers() {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                telegramId: true,
                username: true,
                firstName: true,
                isAdmin: true,
            },
        });
        const groups = await prisma.group.findMany({
            select: {
                id: true,
                title: true,
                telegramId: true,
            },
        });
        console.log(`\n👥 Пользователи: ${users.length}`);
        if (users.length > 0) {
            users.forEach(user => {
                console.log(`  - ${user.firstName} (@${user.username}) - telegramId: ${user.telegramId} ${user.isAdmin ? '[ADMIN]' : ''}`);
            });
        }
        else {
            console.log('  ❌ Нет пользователей в базе!');
        }
        console.log(`\n👥 Группы: ${groups.length}`);
        if (groups.length > 0) {
            groups.forEach(group => {
                console.log(`  - ${group.name} (chatId: ${group.chatId}) ${group.isActive ? '[АКТИВНА]' : '[НЕАКТИВНА]'}`);
            });
        }
        else {
            console.log('  ❌ Нет групп в базе!');
        }
    }
    catch (error) {
        console.error('❌ Ошибка:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
checkUsers();
//# sourceMappingURL=check-users.js.map
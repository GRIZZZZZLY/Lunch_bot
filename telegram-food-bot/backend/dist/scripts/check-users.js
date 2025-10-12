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
                firstName: true,
                lastName: true,
                username: true,
                isAdmin: true,
            }
        });
        console.log('\n📋 Пользователи в базе данных:\n');
        users.forEach(user => {
            console.log(`ID: ${user.id}`);
            console.log(`Telegram ID: ${user.telegramId}`);
            console.log(`Имя: ${user.firstName} ${user.lastName || ''}`);
            console.log(`Username: @${user.username || 'нет'}`);
            console.log(`Админ: ${user.isAdmin ? 'Да' : 'Нет'}`);
            console.log('---');
        });
        console.log(`\nВсего пользователей: ${users.length}\n`);
    }
    catch (error) {
        console.error('Ошибка:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
checkUsers();
//# sourceMappingURL=check-users.js.map
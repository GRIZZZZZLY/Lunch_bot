"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function checkMenu() {
    try {
        const menuItems = await prisma.menuItem.findMany({
            select: {
                id: true,
                name: true,
                category: true,
                price: true,
                isActive: true,
            },
        });
        console.log(`\n📊 В базе данных: ${menuItems.length} блюд\n`);
        if (menuItems.length > 0) {
            console.log('Блюда:');
            menuItems.forEach((item, index) => {
                console.log(`${index + 1}. ${item.name} (${item.category}) - ₽${item.price} [${item.isActive ? 'Активно' : 'Неактивно'}]`);
            });
        }
        else {
            console.log('✅ База данных пустая - блюд нет!');
        }
        const polls = await prisma.poll.count();
        const votes = await prisma.vote.count();
        const results = await prisma.pollResult.count();
        console.log(`\n📈 Статистика:`);
        console.log(`   Голосований: ${polls}`);
        console.log(`   Голосов: ${votes}`);
        console.log(`   Результатов: ${results}`);
    }
    catch (error) {
        console.error('❌ Ошибка:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
checkMenu();
//# sourceMappingURL=check-menu.js.map
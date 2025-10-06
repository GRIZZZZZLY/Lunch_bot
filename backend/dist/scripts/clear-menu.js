"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function clearMenu() {
    try {
        console.log('🗑️  Начинаем очистку меню...');
        const deletedResults = await prisma.pollResult.deleteMany({});
        console.log(`✅ Удалено результатов голосований: ${deletedResults.count}`);
        const deletedVotes = await prisma.vote.deleteMany({});
        console.log(`✅ Удалено голосов: ${deletedVotes.count}`);
        const deletedPolls = await prisma.poll.deleteMany({});
        console.log(`✅ Удалено голосований: ${deletedPolls.count}`);
        const deletedMenuItems = await prisma.menuItem.deleteMany({});
        console.log(`✅ Удалено блюд: ${deletedMenuItems.count}`);
        console.log('\n🎉 Меню полностью очищено!');
        console.log('Теперь можно добавлять блюда вручную.');
    }
    catch (error) {
        console.error('❌ Ошибка при очистке меню:', error);
        throw error;
    }
    finally {
        await prisma.$disconnect();
    }
}
clearMenu()
    .then(() => {
    console.log('\n✨ Готово!');
    process.exit(0);
})
    .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=clear-menu.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function checkMenu() {
    try {
        const totalItems = await prisma.menuItem.count();
        const activeItems = await prisma.menuItem.count({ where: { isActive: true } });
        console.log('\n📋 Menu Items Status:');
        console.log(`Total items: ${totalItems}`);
        console.log(`Active items: ${activeItems}`);
        console.log(`Inactive items: ${totalItems - activeItems}`);
        if (totalItems > 0) {
            console.log('\n📝 All menu items:');
            const items = await prisma.menuItem.findMany({
                orderBy: { name: 'asc' }
            });
            items.forEach(item => {
                console.log(`  ${item.isActive ? '✅' : '❌'} ${item.name} (${item.category}) - ID: ${item.id}`);
            });
        }
        else {
            console.log('\n⚠️ No menu items found in database!');
            console.log('Run: npm run db:seed');
        }
    }
    catch (error) {
        console.error('Error checking menu:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
checkMenu();
//# sourceMappingURL=check-menu.js.map
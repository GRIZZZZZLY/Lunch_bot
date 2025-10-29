"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedMenu = seedMenu;
exports.clearMenu = clearMenu;
const client_1 = require("../client");
const logger_1 = require("../../utils/logger");
const testMenuItems = [
    {
        name: 'Маргарита',
        description: 'Классическая пицца с томатами, моцареллой и базиликом',
        price: 450,
        category: 'pizza',
    },
    {
        name: 'Пепперони',
        description: 'Острая пицца с колбасой пепперони и сыром',
        price: 520,
        category: 'pizza',
    },
    {
        name: 'Четыре сыра',
        description: 'Пицца с моцареллой, пармезаном, горгонзолой и чеддером',
        price: 590,
        category: 'pizza',
    },
    {
        name: 'Карбонара',
        description: 'Спагетти с беконом, яйцом, пармезаном и черным перцем',
        price: 380,
        category: 'pasta',
    },
    {
        name: 'Болоньезе',
        description: 'Паста с мясным соусом по-болонски',
        price: 360,
        category: 'pasta',
    },
    {
        name: 'Альфредо',
        description: 'Феттучини в сливочном соусе с пармезаном',
        price: 420,
        category: 'pasta',
    },
    {
        name: 'Цезарь',
        description: 'Салат с куриной грудкой, листьями салата, соусом цезарь и сухариками',
        price: 320,
        category: 'salad',
    },
    {
        name: 'Греческий',
        description: 'Салат с томатами, огурцами, маслинами, фетой и оливковым маслом',
        price: 280,
        category: 'salad',
    },
    {
        name: 'Чизбургер',
        description: 'Классический бургер с говядиной, сыром, томатом и салатом',
        price: 350,
        category: 'burger',
    },
    {
        name: 'Чикен бургер',
        description: 'Бургер с куриной котлетой, соусом и овощами',
        price: 330,
        category: 'burger',
    },
    {
        name: 'Томатный суп',
        description: 'Крем-суп из томатов со сливками и базиликом',
        price: 220,
        category: 'soup',
    },
    {
        name: 'Борщ',
        description: 'Традиционный украинский суп со сметаной',
        price: 240,
        category: 'soup',
    },
    {
        name: 'Кока-Кола',
        description: 'Газированный напиток 0.5л',
        price: 80,
        category: 'drink',
    },
    {
        name: 'Апельсиновый сок',
        description: 'Свежевыжатый сок 0.3л',
        price: 120,
        category: 'drink',
    },
    {
        name: 'Тирамису',
        description: 'Классический итальянский десерт с маскарпоне и кофе',
        price: 280,
        category: 'dessert',
    },
];
async function seedMenu() {
    try {
        logger_1.logger.info('Starting menu seeding...');
        let adminUser = await client_1.prisma.user.findFirst({
            where: { isAdmin: true },
        });
        if (!adminUser) {
            logger_1.logger.info('No admin user found, creating test admin user...');
            adminUser = await client_1.prisma.user.create({
                data: {
                    telegramId: BigInt(123456789),
                    firstName: 'Test',
                    lastName: 'Admin',
                    username: 'testadmin',
                    isAdmin: true,
                },
            });
            logger_1.logger.info(`Test admin user created with ID: ${adminUser.id}`);
        }
        const existingItemsCount = await client_1.prisma.menuItem.count();
        if (existingItemsCount > 0) {
            logger_1.logger.warn(`Menu already has ${existingItemsCount} items. Skipping seed.`);
            logger_1.logger.info('To re-seed, delete existing items first.');
            return;
        }
        const created = [];
        for (const item of testMenuItems) {
            const menuItem = await client_1.prisma.menuItem.create({
                data: {
                    ...item,
                    createdBy: adminUser.id,
                    isActive: true,
                },
            });
            created.push(menuItem);
            logger_1.logger.info(`Created menu item: ${menuItem.name} (${menuItem.category})`);
        }
        logger_1.logger.info(`✅ Successfully seeded ${created.length} menu items!`);
        const categories = await client_1.prisma.menuItem.groupBy({
            by: ['category'],
            _count: true,
        });
        logger_1.logger.info('Menu items by category:');
        categories.forEach(cat => {
            logger_1.logger.info(`  ${cat.category}: ${cat._count} items`);
        });
    }
    catch (error) {
        logger_1.logger.error('Error seeding menu:', error);
        throw error;
    }
}
async function clearMenu() {
    try {
        logger_1.logger.warn('Clearing all menu items...');
        const deleted = await client_1.prisma.menuItem.deleteMany({});
        logger_1.logger.info(`Deleted ${deleted.count} menu items`);
    }
    catch (error) {
        logger_1.logger.error('Error clearing menu:', error);
        throw error;
    }
}
if (require.main === module) {
    const args = process.argv.slice(2);
    const shouldClear = args.includes('--clear');
    (async () => {
        try {
            if (shouldClear) {
                await clearMenu();
            }
            await seedMenu();
            await client_1.prisma.$disconnect();
            process.exit(0);
        }
        catch (error) {
            logger_1.logger.error('Seed script failed:', error);
            await client_1.prisma.$disconnect();
            process.exit(1);
        }
    })();
}
//# sourceMappingURL=seed-menu.js.map
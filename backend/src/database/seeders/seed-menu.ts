import { prisma } from '../client';
import { logger } from '../../utils/logger';

/**
 * Тестовые данные для меню
 */
const testMenuItems = [
  // Пицца
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
  
  // Паста
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
  
  // Салаты
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
  
  // Бургеры
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
  
  // Супы
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
  
  // Напитки
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
  
  // Десерты
  {
    name: 'Тирамису',
    description: 'Классический итальянский десерт с маскарпоне и кофе',
    price: 280,
    category: 'dessert',
  },
];

/**
 * Функция для заполнения меню тестовыми данными
 */
async function seedMenu() {
  try {
    logger.info('Starting menu seeding...');

    // Проверяем, есть ли хотя бы один пользователь (для createdBy)
    let adminUser = await prisma.user.findFirst({
      where: { isAdmin: true },
    });

    // Если нет админа, создаем тестового пользователя
    if (!adminUser) {
      logger.info('No admin user found, creating test admin user...');
      adminUser = await prisma.user.create({
        data: {
          telegramId: BigInt(123456789),
          firstName: 'Test',
          lastName: 'Admin',
          username: 'testadmin',
          isAdmin: true,
        },
      });
      logger.info(`Test admin user created with ID: ${adminUser.id}`);
    }

    // Проверяем, есть ли уже блюда в меню
    const existingItemsCount = await prisma.menuItem.count();
    
    if (existingItemsCount > 0) {
      logger.warn(`Menu already has ${existingItemsCount} items. Skipping seed.`);
      logger.info('To re-seed, delete existing items first.');
      return;
    }

    // Создаем блюда
    const created = [];
    for (const item of testMenuItems) {
      const menuItem = await prisma.menuItem.create({
        data: {
          ...item,
          createdBy: adminUser.id,
          isActive: true,
        },
      });
      created.push(menuItem);
      logger.info(`Created menu item: ${menuItem.name} (${menuItem.category})`);
    }

    logger.info(`✅ Successfully seeded ${created.length} menu items!`);
    
    // Вывод статистики по категориям
    const categories = await prisma.menuItem.groupBy({
      by: ['category'],
      _count: true,
    });
    
    logger.info('Menu items by category:');
    categories.forEach(cat => {
      logger.info(`  ${cat.category}: ${cat._count} items`);
    });

  } catch (error) {
    logger.error('Error seeding menu:', error);
    throw error;
  }
}

/**
 * Функция для очистки меню (опционально)
 */
async function clearMenu() {
  try {
    logger.warn('Clearing all menu items...');
    const deleted = await prisma.menuItem.deleteMany({});
    logger.info(`Deleted ${deleted.count} menu items`);
  } catch (error) {
    logger.error('Error clearing menu:', error);
    throw error;
  }
}

// Запуск если скрипт вызван напрямую
if (require.main === module) {
  const args = process.argv.slice(2);
  const shouldClear = args.includes('--clear');

  (async () => {
    try {
      if (shouldClear) {
        await clearMenu();
      }
      await seedMenu();
      await prisma.$disconnect();
      process.exit(0);
    } catch (error) {
      logger.error('Seed script failed:', error);
      await prisma.$disconnect();
      process.exit(1);
    }
  })();
}

export { seedMenu, clearMenu };

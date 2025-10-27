const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const testDishes = [
  {
    name: 'Борщ с говядиной',
    description: 'Классический украинский борщ с мясом, сметаной и чесноком',
    category: 'soup',
    price: 250,
    isActive: true,
  },
  {
    name: 'Цезарь с курицей',
    description: 'Салат с куриной грудкой, пармезаном, сухариками и соусом Цезарь',
    category: 'salad',
    price: 320,
    isActive: true,
  },
  {
    name: 'Стейк из лосося',
    description: 'Стейк лосося на гриле с овощами и лимонным соусом',
    category: 'main',
    price: 580,
    isActive: true,
  },
  {
    name: 'Паста Карбонара',
    description: 'Спагетти с беконом, яйцом, пармезаном и сливочным соусом',
    category: 'pasta',
    price: 380,
    isActive: true,
  },
  {
    name: 'Том Ям',
    description: 'Острый тайский суп с креветками, грибами и кокосовым молоком',
    category: 'soup',
    price: 420,
    isActive: true,
  },
  {
    name: 'Бургер BBQ',
    description: 'Сочный бургер с говяжьей котлетой, беконом, сыром чеддер и BBQ соусом',
    category: 'burger',
    price: 390,
    isActive: true,
  },
  {
    name: 'Греческий салат',
    description: 'Свежие овощи, сыр фета, маслины и оливковое масло',
    category: 'salad',
    price: 280,
    isActive: true,
  },
  {
    name: 'Ризотто с белыми грибами',
    description: 'Кремовое ризотто с белыми грибами и пармезаном',
    category: 'main',
    price: 450,
    isActive: true,
  },
  {
    name: 'Чизкейк Нью-Йорк',
    description: 'Классический американский чизкейк с ягодным соусом',
    category: 'dessert',
    price: 280,
    isActive: true,
  },
  {
    name: 'Утка по-пекински',
    description: 'Хрустящая утка с блинчиками, огурцом и соусом Хойсин',
    category: 'main',
    price: 720,
    isActive: true,
  },
];

async function addTestDishes() {
  try {
    console.log('🍽️  Добавление тестовых блюд...\n');
    
    // Находим админа или первого пользователя
    const admin = await prisma.user.findFirst({
      where: { isAdmin: true }
    });
    
    if (!admin) {
      console.error('❌ Не найден администратор! Сначала войдите в приложение.');
      process.exit(1);
    }
    
    console.log(`👤 Создатель: ${admin.firstName || admin.username} (ID: ${admin.id})\n`);
    
    let addedCount = 0;
    let skippedCount = 0;
    
    for (const dish of testDishes) {
      // Проверяем существует ли блюдо
      const existing = await prisma.menuItem.findFirst({
        where: { name: dish.name }
      });
      
      if (existing) {
        console.log(`⏭️  Пропущено (уже есть): ${dish.name}`);
        skippedCount++;
      } else {
        await prisma.menuItem.create({
          data: {
            ...dish,
            createdBy: admin.id
          }
        });
        console.log(`✅ Добавлено: ${dish.name} - ${dish.price}₽ (${dish.category})`);
        addedCount++;
      }
    }
    
    console.log('\n📊 Результат:');
    console.log(`   Добавлено: ${addedCount}`);
    console.log(`   Пропущено: ${skippedCount}`);
    console.log(`   Всего: ${testDishes.length}`);
    
    // Показываем общее количество блюд
    const totalCount = await prisma.menuItem.count();
    const activeCount = await prisma.menuItem.count({ where: { isActive: true } });
    
    console.log(`\n🗄️  В базе данных:`);
    console.log(`   Всего блюд: ${totalCount}`);
    console.log(`   Активных: ${activeCount}`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

addTestDishes();

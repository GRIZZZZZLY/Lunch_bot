import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Создаем тестового администратора
  const admin = await prisma.user.upsert({
    where: { telegramId: BigInt(555502880) },
    update: {
      isAdmin: true,
      firstName: 'Admin',
      username: 'admin',
    },
    create: {
      telegramId: BigInt(555502880),
      firstName: 'Admin',
      username: 'admin',
      isAdmin: true,
      isActive: true,
    },
  });

  console.log('✅ Admin user created:', admin.id);

  // Создаем тестовые блюда
  const menuItems = [
    // Пицца
    {
      name: '🍕 Маргарита',
      description: 'Классическая пицца с томатами, моцареллой и базиликом',
      price: 450,
      category: 'Пицца',
      isActive: true,
      createdBy: admin.id,
    },
    {
      name: '🍕 Пепперони',
      description: 'Пикантная пицца с колбасой пепперони и сыром',
      price: 520,
      category: 'Пицца',
      isActive: true,
      createdBy: admin.id,
    },
    {
      name: '🍕 Четыре сыра',
      description: 'Моцарелла, пармезан, горгонзола и сыр чеддер',
      price: 580,
      category: 'Пицца',
      isActive: true,
      createdBy: admin.id,
    },
    {
      name: '🍕 Гавайская',
      description: 'Ветчина, ананасы, моцарелла',
      price: 490,
      category: 'Пицца',
      isActive: true,
      createdBy: admin.id,
    },

    // Паста
    {
      name: '🍝 Карбонара',
      description: 'Спагетти с беконом, яйцом и пармезаном',
      price: 380,
      category: 'Паста',
      isActive: true,
      createdBy: admin.id,
    },
    {
      name: '🍝 Болоньезе',
      description: 'Паста с мясным соусом по-болонски',
      price: 390,
      category: 'Паста',
      isActive: true,
      createdBy: admin.id,
    },
    {
      name: '🍝 Альфредо',
      description: 'Феттучини в сливочном соусе с курицей',
      price: 420,
      category: 'Паста',
      isActive: true,
      createdBy: admin.id,
    },

    // Салаты
    {
      name: '🥗 Цезарь',
      description: 'Салат с курицей, пармезаном, сухариками и соусом',
      price: 320,
      category: 'Салаты',
      isActive: true,
      createdBy: admin.id,
    },
    {
      name: '🥗 Греческий',
      description: 'Свежие овощи, фета, оливки, оливковое масло',
      price: 290,
      category: 'Салаты',
      isActive: true,
      createdBy: admin.id,
    },

    // Бургеры
    {
      name: '🍔 Чизбургер',
      description: 'Говяжья котлета, сыр чеддер, овощи, соус',
      price: 350,
      category: 'Бургеры',
      isActive: true,
      createdBy: admin.id,
    },
    {
      name: '🍔 Двойной бургер',
      description: 'Две котлеты, двойной сыр, бекон, соус барбекю',
      price: 480,
      category: 'Бургеры',
      isActive: true,
      createdBy: admin.id,
    },

    // Десерты
    {
      name: '🍰 Тирамису',
      description: 'Классический итальянский десерт с маскарпоне',
      price: 250,
      category: 'Десерты',
      isActive: true,
      createdBy: admin.id,
    },
    {
      name: '🍰 Чизкейк',
      description: 'Нежный творожный торт с ягодным соусом',
      price: 280,
      category: 'Десерты',
      isActive: true,
      createdBy: admin.id,
    },

    // Напитки
    {
      name: '🥤 Кока-Кола',
      description: 'Освежающий напиток 0.5л',
      price: 120,
      category: 'Напитки',
      isActive: true,
      createdBy: admin.id,
    },
    {
      name: '☕ Капучино',
      description: 'Ароматный кофе с молочной пенкой',
      price: 180,
      category: 'Напитки',
      isActive: true,
      createdBy: admin.id,
    },
  ];

  console.log('📝 Creating menu items...');

  for (const item of menuItems) {
    const created = await prisma.menuItem.create({
      data: item,
    });
    console.log(`  ✅ ${created.name} - ${created.price}₽`);
  }

  console.log('\n✨ Seed completed successfully!');
  console.log(`📊 Created: 1 admin user, ${menuItems.length} menu items`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

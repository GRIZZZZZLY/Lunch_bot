/**
 * Генерация токена для существующего пользователя
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function generateToken() {
  try {
    // Получаем админа
    const admin = await prisma.user.findFirst({
      where: { isAdmin: true },
    });

    if (!admin) {
      console.error('❌ Админ не найден в базе!');
      process.exit(1);
    }

    console.log('\n👤 Пользователь найден:');
    console.log(`   Имя: ${admin.firstName}`);
    console.log(`   Username: @${admin.username}`);
    console.log(`   Telegram ID: ${admin.telegramId}`);
    console.log(`   Admin: ${admin.isAdmin ? 'Да' : 'Нет'}`);

    // Генерируем токен (такой же как в auth.controller.ts)
    const payload = {
      userId: typeof admin.id === 'bigint' ? Number(admin.id) : admin.id,
      telegramId: typeof admin.telegramId === 'bigint' ? admin.telegramId.toString() : admin.telegramId,
      isAdmin: admin.isAdmin,
      timestamp: Date.now(),
    };

    const token = Buffer.from(JSON.stringify(payload)).toString('base64');

    console.log('\n🔑 Сгенерированный токен:');
    console.log(`   ${token}`);

    console.log('\n📋 Скопируй и выполни в консоли браузера:');
    console.log(`\nlocalStorage.setItem('auth_token', '${token}');\nlocation.reload();\n`);

    console.log('\n✅ После этого токен будет установлен и можно добавлять блюда!');

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

generateToken();

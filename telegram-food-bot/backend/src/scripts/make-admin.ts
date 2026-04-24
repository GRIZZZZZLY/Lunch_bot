/**
 * Скрипт для установки админских прав пользователю
 * 
 * Использование:
 *   npm run make-admin <telegram_id>
 * 
 * Примеры:
 *   npm run make-admin 123456789
 *   npm run make-admin 987654321
 */

import { logger } from '../utils/logger';
import { prisma, disconnect } from '../database/client';

async function makeAdmin(telegramId: string) {
  try {
    console.log(`\n🔍 Searching for user with Telegram ID: ${telegramId}...`);
    
    // Проверяем существует ли пользователь
    const existingUser = await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
      select: {
        id: true,
        telegramId: true,
        username: true,
        firstName: true,
        lastName: true,
        isAdmin: true,
      },
    });

    if (!existingUser) {
      console.error(`❌ User with Telegram ID ${telegramId} not found!`);
      console.log('\n💡 Available users:');
      
      const allUsers = await prisma.user.findMany({
        select: {
          id: true,
          telegramId: true,
          username: true,
          firstName: true,
          isAdmin: true,
        },
        take: 10,
      });
      
      allUsers.forEach((u) => {
        console.log(`   - ID: ${u.id}, Telegram ID: ${u.telegramId}, Username: ${u.username || 'N/A'}, Name: ${u.firstName}, Admin: ${u.isAdmin ? '✅' : '❌'}`);
      });
      
      process.exit(1);
    }

    console.log(`\n✅ Found user:`);
    console.log(`   - ID: ${existingUser.id}`);
    console.log(`   - Telegram ID: ${existingUser.telegramId}`);
    console.log(`   - Username: ${existingUser.username || 'N/A'}`);
    console.log(`   - Name: ${existingUser.firstName} ${existingUser.lastName || ''}`);
    console.log(`   - Current admin status: ${existingUser.isAdmin ? '✅ YES' : '❌ NO'}`);

    if (existingUser.isAdmin) {
      console.log(`\n⚠️  User is already an admin. Nothing to do.`);
      process.exit(0);
    }

    // Устанавливаем админские права
    console.log(`\n🔄 Setting admin rights...`);
    
    const updatedUser = await prisma.user.update({
      where: { telegramId: BigInt(telegramId) },
      data: { 
        isAdmin: true,
        updatedAt: new Date(),
      },
    });

    console.log(`\n✅ SUCCESS! User is now an admin.`);
    console.log(`   - ID: ${updatedUser.id}`);
    console.log(`   - Telegram ID: ${updatedUser.telegramId}`);
    console.log(`   - Username: ${updatedUser.username || 'N/A'}`);
    console.log(`   - Name: ${updatedUser.firstName} ${updatedUser.lastName || ''}`);
    console.log(`   - Admin: ✅ YES`);
    
    logger.info(`Admin rights granted to user ${telegramId}`, {
      userId: updatedUser.id,
      telegramId: updatedUser.telegramId.toString(),
      username: updatedUser.username,
    });

    console.log(`\n📱 Next steps:`);
    console.log(`   ⚡ User needs to reopen the Mini App`);
    console.log(`   `);
    console.log(`   1. Open (or reopen) the Mini App`);
    console.log(`   2. Go to Profile page`);
    console.log(`   3. ✅ "Панель администратора" button will appear INSTANTLY!`);
    console.log(`   `);
    console.log(`   💡 The button appears in ~50ms based on JWT token.`);
    console.log(`   💡 If it doesn't appear - user needs to close/reopen the app.\n`);

  } catch (error) {
    console.error(`\n❌ Error:`, error);
    process.exit(1);
  } finally {
    await disconnect();
  }
}

// Получаем Telegram ID из аргументов командной строки
const telegramId = process.argv[2];

if (!telegramId) {
  console.error('\n❌ Error: Telegram ID is required!\n');
  console.log('Usage:');
  console.log('  npm run make-admin <telegram_id>\n');
  console.log('Example:');
  console.log('  npm run make-admin 123456789\n');
  process.exit(1);
}

// Проверяем что это число
if (!/^\d+$/.test(telegramId)) {
  console.error('\n❌ Error: Telegram ID must be a number!\n');
  console.log('Example:');
  console.log('  npm run make-admin 123456789\n');
  process.exit(1);
}

makeAdmin(telegramId);

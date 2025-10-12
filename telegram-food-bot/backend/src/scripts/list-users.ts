/**
 * Скрипт для просмотра всех пользователей в системе
 * 
 * Использование:
 *   npm run list-users
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listUsers() {
  try {
    console.log('\n📋 Users in database:\n');
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        telegramId: true,
        username: true,
        firstName: true,
        lastName: true,
        isAdmin: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (users.length === 0) {
      console.log('No users found. Open the Mini App to create the first user.\n');
      process.exit(0);
    }

    console.log('┌───────┬──────────────┬─────────────┬──────────────────────┬───────┬────────┐');
    console.log('│ ID    │ Telegram ID  │ Username    │ Name                 │ Admin │ Active │');
    console.log('├───────┼──────────────┼─────────────┼──────────────────────┼───────┼────────┤');

    users.forEach((user) => {
      const id = String(user.id).padEnd(5);
      const telegramId = String(user.telegramId).padEnd(12);
      const username = (user.username || 'N/A').padEnd(11);
      const name = `${user.firstName} ${user.lastName || ''}`.substring(0, 20).padEnd(20);
      const admin = user.isAdmin ? '✅ YES' : '❌ NO ';
      const active = user.isActive ? '✅ YES' : '❌ NO ';

      console.log(`│ ${id} │ ${telegramId} │ ${username} │ ${name} │ ${admin} │ ${active} │`);
    });

    console.log('└───────┴──────────────┴─────────────┴──────────────────────┴───────┴────────┘');

    const stats = {
      total: users.length,
      admins: users.filter(u => u.isAdmin).length,
      active: users.filter(u => u.isActive).length,
    };

    console.log(`\n📊 Stats: ${stats.total} total, ${stats.admins} admins, ${stats.active} active\n`);

    if (stats.admins === 0) {
      console.log('💡 To make a user admin, run:');
      console.log('   npm run make-admin <telegram_id>\n');
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

listUsers();

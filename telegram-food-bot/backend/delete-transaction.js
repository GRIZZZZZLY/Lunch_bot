/**
 * Скрипт для удаления транзакции из базы данных
 * Использование: node delete-transaction.js <transactionId>
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteTransaction(transactionId) {
  try {
    console.log(`🗑️  Удаление транзакции ID=${transactionId}...`);
    
    // Сначала получаем информацию о транзакции
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        fromUser: true,
        toUser: true,
        menuItem: true,
      },
    });
    
    if (!transaction) {
      console.log('❌ Транзакция не найдена');
      return;
    }
    
    // Показываем информацию
    console.log('\n📋 Информация о транзакции:');
    console.log(`   ID: ${transaction.id}`);
    console.log(`   Сумма: ${transaction.amount}₽`);
    console.log(`   Блюдо: ${transaction.menuItem?.name || 'N/A'}`);
    console.log(`   От: ${transaction.fromUser?.firstName || 'Unknown'} (ID: ${transaction.fromUserId})`);
    console.log(`   Кому: ${transaction.toUser?.firstName || 'Unknown'} (ID: ${transaction.toUserId})`);
    console.log(`   Статус: ${transaction.status}`);
    console.log(`   PollId: ${transaction.pollId}`);
    console.log(`   Создана: ${transaction.createdAt}`);
    
    // Удаляем
    await prisma.transaction.delete({
      where: { id: transactionId },
    });
    
    console.log('\n✅ Транзакция успешно удалена!');
  } catch (error) {
    console.error('❌ Ошибка при удалении транзакции:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Получаем ID из аргументов командной строки
const transactionId = parseInt(process.argv[2]);

if (!transactionId || isNaN(transactionId)) {
  console.log('❌ Использование: node delete-transaction.js <transactionId>');
  console.log('   Пример: node delete-transaction.js 1');
  process.exit(1);
}

deleteTransaction(transactionId);

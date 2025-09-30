const { PrismaClient } = require('@prisma/client');

async function testConnection() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://foodbot@127.0.0.1:5433/foodbot_db?schema=public'
      }
    },
    log: ['query', 'info', 'warn', 'error']
  });

  try {
    console.log('🔍 Testing database connection...');
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Connection successful!', result);
    
    const users = await prisma.user.findMany({ take: 1 });
    console.log('✅ Query successful! Users:', users.length);
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Details:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkMenuItems() {
  try {
    const items = await prisma.menuItem.findMany({
      orderBy: { id: 'asc' }
    });
    
    console.log('\n=== ALL MENU ITEMS ===');
    console.log('Total items:', items.length);
    console.log('');
    
    items.forEach(item => {
      console.log(`ID: ${item.id}`);
      console.log(`  Name: ${item.name}`);
      console.log(`  Category: ${item.category}`);
      console.log(`  isActive: ${item.isActive}`);
      console.log(`  Price: ${item.price || 'N/A'}`);
      console.log('');
    });
    
    const activeCount = items.filter(i => i.isActive).length;
    const inactiveCount = items.filter(i => !i.isActive).length;
    
    console.log('=== SUMMARY ===');
    console.log(`Active items: ${activeCount}`);
    console.log(`Inactive items: ${inactiveCount}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMenuItems();

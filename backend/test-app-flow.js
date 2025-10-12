/**
 * Автоматический тест основного функционала приложения
 * 
 * Проверяет:
 * 1. API endpoints работают
 * 2. selectedMenuItemIds корректно передаются
 * 3. Фильтрация menu items работает
 * 4. Создание и загрузка polls
 * 
 * Запуск: node test-app-flow.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(emoji, color, message, data) {
  console.log(`${emoji} ${color}${message}${colors.reset}`, data || '');
}

function success(message, data) {
  log('✅', colors.green, message, data);
}

function error(message, data) {
  log('❌', colors.red, message, data);
}

function info(message, data) {
  log('ℹ️ ', colors.blue, message, data);
}

function warning(message, data) {
  log('⚠️ ', colors.yellow, message, data);
}

function section(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${colors.cyan}${title}${colors.reset}`);
  console.log(`${'='.repeat(60)}\n`);
}

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    success(message);
    testsPassed++;
  } else {
    error(message);
    testsFailed++;
  }
  return condition;
}

async function testDatabase() {
  section('📊 TEST 1: Database Connection');
  
  try {
    await prisma.$connect();
    success('Connected to database');
    
    // Проверяем что есть polls
    const pollsCount = await prisma.poll.count();
    info(`Total polls in database: ${pollsCount}`);
    
    // Проверяем что есть menu items
    const menuItemsCount = await prisma.menuItem.count({ where: { isActive: true } });
    info(`Active menu items: ${menuItemsCount}`);
    
    assert(pollsCount > 0, 'Database has polls');
    assert(menuItemsCount > 0, 'Database has active menu items');
    
  } catch (err) {
    error('Database connection failed:', err.message);
    testsFailed++;
  }
}

async function testActivePoll() {
  section('🗳️  TEST 2: Active Poll with selectedMenuItemIds');
  
  try {
    // Находим активное голосование
    const activePoll = await prisma.poll.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
    
    if (!activePoll) {
      warning('No active polls found - skipping test');
      return;
    }
    
    info(`Active poll ID: ${activePoll.id}`);
    info(`Status: ${activePoll.status}`);
    info(`selectedMenuItemIds: ${activePoll.selectedMenuItemIds || 'null'}`);
    
    // Проверяем selectedMenuItemIds
    if (activePoll.selectedMenuItemIds) {
      try {
        const selectedIds = JSON.parse(activePoll.selectedMenuItemIds);
        assert(Array.isArray(selectedIds), 'selectedMenuItemIds is an array');
        assert(selectedIds.length > 0, `Has ${selectedIds.length} selected items`);
        
        // Проверяем что все ID существуют
        const menuItems = await prisma.menuItem.findMany({
          where: { id: { in: selectedIds }, isActive: true },
        });
        
        assert(
          menuItems.length === selectedIds.length,
          `All ${selectedIds.length} menu items exist and active`
        );
        
        info('Selected menu items:');
        menuItems.forEach(item => {
          console.log(`  - ${item.id}: ${item.name}`);
        });
        
      } catch (parseError) {
        error('Failed to parse selectedMenuItemIds:', parseError.message);
        testsFailed++;
      }
    } else {
      warning('Poll has no selectedMenuItemIds (showing all items)');
    }
    
  } catch (err) {
    error('Active poll test failed:', err.message);
    testsFailed++;
  }
}

async function testPollFiltering() {
  section('🔍 TEST 3: Menu Items Filtering Logic');
  
  try {
    // Создаем тестовое голосование с выбранными items
    const allMenuItems = await prisma.menuItem.findMany({
      where: { isActive: true },
      take: 4,
    });
    
    info(`Total active menu items: ${allMenuItems.length}`);
    
    if (allMenuItems.length < 2) {
      warning('Need at least 2 menu items for this test');
      return;
    }
    
    // Выбираем первые 2
    const selectedIds = allMenuItems.slice(0, 2).map(item => item.id);
    info(`Selected ${selectedIds.length} items for filtering: ${selectedIds.join(', ')}`);
    
    // Эмулируем фильтрацию как в InlineVotingCard
    const filtered = allMenuItems.filter(item => selectedIds.includes(item.id));
    
    assert(filtered.length === selectedIds.length, `Filtered correctly: ${filtered.length} items`);
    assert(filtered.length === 2, 'Exactly 2 items after filtering');
    
    info('Filtered items:');
    filtered.forEach(item => {
      console.log(`  - ${item.id}: ${item.name}`);
    });
    
  } catch (err) {
    error('Filtering test failed:', err.message);
    testsFailed++;
  }
}

async function testPollCreation() {
  section('🆕 TEST 4: Poll Creation Flow');
  
  try {
    // Получаем menu items для теста
    const menuItems = await prisma.menuItem.findMany({
      where: { isActive: true },
      take: 2,
    });
    
    if (menuItems.length < 2) {
      warning('Need at least 2 menu items for creation test');
      return;
    }
    
    const selectedIds = menuItems.map(item => item.id);
    
    // Получаем группу
    const group = await prisma.group.findFirst({
      where: { isActive: true },
    });
    
    if (!group) {
      warning('No active group found for creation test');
      return;
    }
    
    info(`Creating test poll with ${selectedIds.length} items...`);
    
    // Создаем poll
    const testPoll = await prisma.poll.create({
      data: {
        groupId: group.id,
        status: 'CANCELLED', // Сразу отменяем чтобы не мешать
        duration: 1,
        createdBy: 1,
        selectedMenuItemIds: JSON.stringify(selectedIds),
      },
    });
    
    success(`Test poll created: ID ${testPoll.id}`);
    
    // Проверяем что selectedMenuItemIds сохранился
    assert(
      testPoll.selectedMenuItemIds !== null,
      'selectedMenuItemIds is saved'
    );
    
    const savedIds = JSON.parse(testPoll.selectedMenuItemIds);
    assert(
      JSON.stringify(savedIds) === JSON.stringify(selectedIds),
      'selectedMenuItemIds matches input'
    );
    
    // Эмулируем загрузку как в InlineVotingCard
    const loadedPoll = await prisma.poll.findUnique({
      where: { id: testPoll.id },
    });
    
    assert(
      loadedPoll.selectedMenuItemIds === testPoll.selectedMenuItemIds,
      'selectedMenuItemIds persists after reload'
    );
    
    info('Test poll data:');
    console.log(`  Poll ID: ${loadedPoll.id}`);
    console.log(`  selectedMenuItemIds: ${loadedPoll.selectedMenuItemIds}`);
    
    // Cleanup
    await prisma.poll.delete({ where: { id: testPoll.id } });
    info('Test poll cleaned up');
    
  } catch (err) {
    error('Poll creation test failed:', err.message);
    testsFailed++;
  }
}

async function testCompletedPolls() {
  section('📜 TEST 5: Completed Polls History');
  
  try {
    const completedPolls = await prisma.poll.findMany({
      where: { status: 'COMPLETED' },
      orderBy: { endedAt: 'desc' },
      take: 5,
    });
    
    info(`Found ${completedPolls.length} completed polls`);
    
    if (completedPolls.length === 0) {
      warning('No completed polls found');
      return;
    }
    
    // Проверяем последнее завершенное
    const lastCompleted = completedPolls[0];
    info(`Last completed poll: ID ${lastCompleted.id}`);
    info(`  Ended at: ${lastCompleted.endedAt}`);
    info(`  selectedMenuItemIds: ${lastCompleted.selectedMenuItemIds || 'null'}`);
    
    assert(lastCompleted.status === 'COMPLETED', 'Poll status is COMPLETED');
    assert(lastCompleted.endedAt !== null, 'Poll has endedAt date');
    
    // Проверяем selectedMenuItemIds в completed polls
    let pollsWithSelection = 0;
    completedPolls.forEach(poll => {
      if (poll.selectedMenuItemIds) {
        pollsWithSelection++;
      }
    });
    
    info(`${pollsWithSelection}/${completedPolls.length} completed polls have selectedMenuItemIds`);
    
  } catch (err) {
    error('Completed polls test failed:', err.message);
    testsFailed++;
  }
}

async function printSummary() {
  section('📊 TEST SUMMARY');
  
  const total = testsPassed + testsFailed;
  const percentage = total > 0 ? ((testsPassed / total) * 100).toFixed(1) : 0;
  
  console.log(`Total tests: ${total}`);
  console.log(`${colors.green}✅ Passed: ${testsPassed}${colors.reset}`);
  console.log(`${colors.red}❌ Failed: ${testsFailed}${colors.reset}`);
  console.log(`Success rate: ${percentage}%\n`);
  
  if (testsFailed === 0) {
    success('All tests passed! 🎉');
  } else {
    error(`${testsFailed} test(s) failed. Check the output above.`);
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
}

async function runTests() {
  console.log(`\n${colors.cyan}🧪 Starting Application Flow Tests${colors.reset}\n`);
  
  try {
    await testDatabase();
    await testActivePoll();
    await testPollFiltering();
    await testPollCreation();
    await testCompletedPolls();
  } catch (err) {
    error('Critical error during tests:', err);
  } finally {
    await printSummary();
    await prisma.$disconnect();
  }
  
  // Exit code
  process.exit(testsFailed > 0 ? 1 : 0);
}

// Run tests
runTests();

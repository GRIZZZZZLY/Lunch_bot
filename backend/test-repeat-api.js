const axios = require('axios');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5001';

// Тестовый JWT токен (нужно получить реальный из localStorage)
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaXNBZG1pbiI6dHJ1ZSwiaWF0IjoxNzI4NzQ2MjY0fQ.wVQQ6DaPWRHbV3VHGHxhVzWyHh-2rMqtScOCJTWzBOg';

async function testLastCompletedEndpoint() {
  try {
    console.log('\n📡 Testing GET /api/polls/last-completed...\n');
    
    const response = await axios.get(`${BASE_URL}/api/polls/last-completed`, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Response Status:', response.status);
    console.log('📦 Response Data:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success && response.data.data) {
      const poll = response.data.data;
      console.log('\n✅ Last completed poll:');
      console.log(`   ID: ${poll.id}`);
      console.log(`   Status: ${poll.status}`);
      console.log(`   Ended at: ${poll.endedAt}`);
      console.log(`   Selected items: ${poll.selectedMenuItemIds}`);
      return poll.id;
    } else {
      console.log('❌ No completed polls found');
      return null;
    }
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    return null;
  }
}

async function testRepeatEndpoint(pollId) {
  try {
    console.log(`\n📡 Testing POST /api/polls/repeat/${pollId}...\n`);
    
    const response = await axios.post(
      `${BASE_URL}/api/polls/repeat/${pollId}`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Response Status:', response.status);
    console.log('📦 Response Data:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success && response.data.data) {
      const newPoll = response.data.data;
      console.log('\n✅ New poll created:');
      console.log(`   ID: ${newPoll.id}`);
      console.log(`   Status: ${newPoll.status}`);
      console.log(`   Group ID: ${newPoll.groupId}`);
      console.log(`   Selected items: ${newPoll.selectedMenuItemIds}`);
    }
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

async function main() {
  console.log('🚀 Testing "Repeat Yesterday" API endpoints\n');
  console.log('🔗 API Base URL:', BASE_URL);
  
  // Test 1: Get last completed poll
  const pollId = await testLastCompletedEndpoint();
  
  if (pollId) {
    // Test 2: Repeat the poll
    await testRepeatEndpoint(pollId);
  }
  
  console.log('\n✅ Testing complete!\n');
}

main();

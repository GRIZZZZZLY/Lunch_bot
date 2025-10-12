// Тест API для проверки getPollById
const fetch = require('node-fetch');

const API_URL = 'http://127.0.0.1:3001';
const POLL_ID = 72; // ID последнего poll

async function testGetPoll() {
  try {
    const response = await fetch(`${API_URL}/api/polls/${POLL_ID}`, {
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const data = await response.json();
    
    console.log('📡 API Response:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.data?.selectedMenuItemIds) {
      console.log('\n✅ selectedMenuItemIds in API response:');
      console.log(data.data.selectedMenuItemIds);
    } else {
      console.log('\n❌ selectedMenuItemIds NOT in API response');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testGetPoll();

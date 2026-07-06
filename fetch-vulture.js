const puppeteer = require('puppeteer');
const fs = require('fs');
const https = require('https');

(async () => {
  console.log('🎯 Starting Vulture data fetch...');
  
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.goto('https://whereisvulture.com/', { 
    waitUntil: 'networkidle2',
    timeout: 30000 
  });
  
  await page.waitForSelector('#cop-locations', { timeout: 10000 }).catch(() => {
    console.warn('⚠️ cop-locations not found');
  });
  
  // ดึงชื่อ location
  const locations = await page.evaluate(() => {
    const items = [];
    const listItems = document.querySelectorAll('#cop-locations li');
    
    listItems.forEach(li => {
      const text = li.innerText?.trim();
      if (text) {
        const name = text.replace(/^•\s*/, '').split('(')[0].trim();
        items.push(name);
      }
    });
    
    return items;
  });
  
  await browser.close();
  
  console.log('✅ Locations found:', locations);
  
  // บันทึกข้อมูลลง log
  logEvent('FETCH_COMPLETE', { locations });
  
  // ยิงข้อมูลไปยัง API (รอให้เสร็จ)
  if (locations.length > 0) {
    try {
      await sendToAPI(locations);
      logEvent('SUCCESS', { message: 'Data sent to API successfully' });
    } catch (apiErr) {
      logEvent('API_FAILED', { message: apiErr.message });
      throw apiErr;
    }
  } else {
    logEvent('ERROR', { message: 'No locations found' });
    process.exit(1);
  }
})().catch(err => {
  logEvent('FATAL_ERROR', { message: err.message });
  console.error('❌ Fatal Error:', err);
  process.exit(1);
});

// ฟังก์ชันบันทึก log
function logEvent(eventType, data) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${eventType} ${JSON.stringify(data)}\n`;
  
  try {
    fs.appendFileSync('vulture-log.txt', logEntry);
    console.log('✅ LOGGED:', logEntry.trim());
  } catch (err) {
    console.error('❌ LOG_WRITE_ERROR:', err.message);
  }
}

// ฟังก์ชัน POST ไปยัง API
function sendToAPI(cops) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.VULTURE_API_KEY;
    
    console.log('🔑 Checking API key...');
    
    if (!apiKey) {
      logEvent('ERROR', { message: 'VULTURE_API_KEY not found in environment' });
      reject(new Error('VULTURE_API_KEY environment variable not found'));
      return;
    }
    
    console.log('✅ API key found');
    
    const payload = JSON.stringify({
      data: {
        cops: cops
      }
    });
    
    console.log('📤 Preparing API request...');
    logEvent('API_REQUEST', { 
      host: 'gray-zone-warfare-handbook-api-production.up.railway.app',
      path: '/api/v1/where-is-vulture/available',
      payload: payload
    });
    
    const options = {
      hostname: 'gray-zone-warfare-handbook-api-production.up.railway.app',
      port: 443,
      path: '/api/v1/where-is-vulture/available',
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
        'Content-Length': payload.length
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      console.log(`📨 API Response Status: ${res.statusCode}`);
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('📥 Response body:', data);
        
        logEvent('API_RESPONSE', { 
          statusCode: res.statusCode,
          body: data
        });
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('✅ Success');
          resolve();
        } else {
          reject(new Error(`API returned status ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', err => {
      console.error('❌ Request Error:', err.message);
      logEvent('API_ERROR', { message: err.message });
      reject(err);
    });
    
    req.write(payload);
    req.end();
  });
}

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
  
  // ยิงข้อมูลไปยัง API
  if (locations.length > 0) {
    await sendToAPI(locations);
  } else {
    logEvent('ERROR', { message: 'No locations found' });
    process.exit(1);
  }
})().catch(err => {
  logEvent('ERROR', { message: err.message });
  console.error('❌ Error:', err);
  process.exit(1);
});

// ฟังก์ชันบันทึก log
function logEvent(eventType, data) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${eventType} ${JSON.stringify(data)}\n`;
  fs.appendFileSync('vulture-log.txt', logEntry);
  console.log(logEntry);
}

// ฟังก์ชัน POST ไปยัง API
function sendToAPI(cops) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.VULTURE_API_KEY;
    
    if (!apiKey) {
      logEvent('ERROR', { message: 'VULTURE_API_KEY not found' });
      reject(new Error('VULTURE_API_KEY environment variable not found'));
    }
    
    const payload = JSON.stringify({
      data: {
        cops: cops
      }
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
    
    logEvent('API_REQUEST', { 
      host: options.hostname,
      path: options.path,
      payload: payload
    });
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        logEvent('API_RESPONSE', { 
          statusCode: res.statusCode,
          body: data
        });
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('✅ Success');
          resolve();
        } else {
          reject(new Error(`API returned status ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', err => {
      logEvent('API_ERROR', { message: err.message });
      console.error('❌ Request failed:', err.message);
      reject(err);
    });
    
    req.write(payload);
    req.end();
  });
}

const puppeteer = require('puppeteer');
const fs = require('fs');

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
  
  // ดึงแค่ชื่อ location
  const locations = await page.evaluate(() => {
    const copElement = document.getElementById('cop-locations');
    if (!copElement) return 'No data found';
    
    const names = [];
    copElement.querySelectorAll('generic').forEach(el => {
      const text = el.innerText?.trim();
      // ดึงแค่ชื่อ (WESTMORE, BRONCO, etc) ไม่เอา coordinates และ status
      if (text && !text.includes(',') && text !== 'Active' && text !== 'CoP') {
        names.push(text);
      }
    });
    
    return names.length > 0 ? names.join(', ') : 'No locations found';
  });
  
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'UTC' });
  const logEntry = `[${timestamp}] ${locations}\n`;
  
  fs.appendFileSync('vulture-log.txt', logEntry);
  console.log('✅ Data saved:', locations);
  
  await browser.close();
})().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});

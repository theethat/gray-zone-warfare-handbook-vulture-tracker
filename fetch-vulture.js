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
  
  // ดึงแค่ชื่อ location (ตัด "Grid" ออก)
  const locations = await page.evaluate(() => {
    const items = [];
    const listItems = document.querySelectorAll('#cop-locations li');
    
    listItems.forEach(li => {
      const text = li.innerText?.trim();
      if (text) {
        // ตัด "Westmore (Grid 168:161)" เหลือแค่ "Westmore"
        const name = text.split('(')[0].trim();
        items.push(name);
      }
    });
    
    return items.length > 0 ? items.join(', ') : 'No locations found';
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

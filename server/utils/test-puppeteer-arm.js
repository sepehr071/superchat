/**
 * ARM64 Puppeteer Test Utility
 * 
 * This script provides a minimal test to verify Puppeteer works correctly
 * on ARM64 architecture. It creates a simple PDF without requiring the 
 * full application to run.
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Print system info
console.log('System Information:');
console.log(`Platform: ${os.platform()}`);
console.log(`Architecture: ${os.arch()}`);
console.log(`Node Version: ${process.version}`);
console.log(`Memory: ${Math.round(os.totalmem() / (1024 * 1024 * 1024))} GB total, ${Math.round(os.freemem() / (1024 * 1024 * 1024))} GB free`);
console.log(`PUPPETEER_EXECUTABLE_PATH: ${process.env.PUPPETEER_EXECUTABLE_PATH || 'not set'}`);
console.log(`CHROME_BIN: ${process.env.CHROME_BIN || 'not set'}`);
console.log('');

// Utility function to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Create simple HTML content with Persian text
const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ARM64 Puppeteer Test</title>
  <style>
    body {
      direction: rtl;
      font-family: Arial, sans-serif;
      margin: 40px;
      line-height: 1.6;
    }
    h1 {
      color: #2c3e50;
      text-align: center;
    }
    .test-box {
      border: 1px solid #ddd;
      padding: 20px;
      margin: 20px 0;
      border-radius: 5px;
      background-color: #f9f9f9;
    }
    .persian-text {
      font-size: 18px;
    }
    .table-container {
      margin: 30px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 12px;
      text-align: center;
    }
    th {
      background-color: #34495e;
      color: white;
    }
    tr:nth-child(even) {
      background-color: #f2f2f2;
    }
  </style>
</head>
<body>
  <h1>تست پاپترر روی ARM64</h1>
  
  <div class="test-box">
    <h2>اطلاعات سیستم</h2>
    <p>معماری: ${os.arch()}</p>
    <p>سیستم عامل: ${os.platform()} ${os.release()}</p>
    <p>نسخه Node.js: ${process.version}</p>
  </div>

  <div class="test-box">
    <h2>متن فارسی</h2>
    <p class="persian-text">
      این یک آزمایش ساده برای بررسی عملکرد صحیح پاپترر در معماری ARM64 است.
      اگر این متن به درستی در فایل PDF نمایش داده شود، پاپترر به درستی پیکربندی شده است.
    </p>
  </div>

  <div class="test-box table-container">
    <h2>جدول نمونه</h2>
    <table>
      <tr>
        <th>نام</th>
        <th>سن</th>
        <th>شهر</th>
      </tr>
      <tr>
        <td>علی محمدی</td>
        <td>۳۲</td>
        <td>تهران</td>
      </tr>
      <tr>
        <td>سارا احمدی</td>
        <td>۲۸</td>
        <td>اصفهان</td>
      </tr>
      <tr>
        <td>محمد رضایی</td>
        <td>۴۵</td>
        <td>شیراز</td>
      </tr>
    </table>
  </div>

  <div class="test-box">
    <h2>اطلاعات تست</h2>
    <p>این PDF در تاریخ و زمان ${new Date().toLocaleString()} ایجاد شده است.</p>
    <p>اگر شما این فایل را می‌بینید، تست موفقیت‌آمیز بوده است.</p>
  </div>
</body>
</html>
`;

// Main function to test Puppeteer
async function testPuppeteer() {
  console.log('Starting Puppeteer test on ARM64...');
  console.log('');
  
  let browser = null;
  let success = false;
  const outputPath = path.join(process.cwd(), 'arm64-puppeteer-test.pdf');
  
  try {
    console.log('1. Creating output directory if needed...');
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log('2. Launching browser with ARM64 optimized settings...');
    // ARM64 optimized browser settings
    const browserOptions = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu-sandbox',
        '--use-gl=egl',
        '--single-process',
        '--disable-accelerated-2d-canvas'
      ]
    };
    
    // Use environment-provided executable path if available
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      console.log(`  Using PUPPETEER_EXECUTABLE_PATH: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
      browserOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    } else if (process.env.CHROME_BIN) {
      console.log(`  Using CHROME_BIN: ${process.env.CHROME_BIN}`);
      browserOptions.executablePath = process.env.CHROME_BIN;
    } else {
      console.log('  No executable path set, using default Chromium');
    }

    browser = await puppeteer.launch(browserOptions);
    console.log('3. Browser launched successfully...');
    
    console.log('4. Creating a new page...');
    const page = await browser.newPage();
    
    console.log('5. Setting viewport...');
    await page.setViewport({
      width: 1200,
      height: 1600,
      deviceScaleFactor: 1.5
    });
    
    console.log('6. Setting content...');
    await page.setContent(htmlContent, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    console.log('7. Waiting for content to fully render...');
    await wait(1000); // Small wait to ensure content is fully rendered
    
    console.log('8. Generating PDF...');
    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '1cm',
        right: '1cm',
        bottom: '1cm',
        left: '1cm'
      }
    });
    
    console.log('9. Closing page...');
    await page.close();
    
    console.log('\n✅ Success! PDF was generated successfully.');
    console.log(`PDF saved to: ${outputPath}`);
    success = true;
    
  } catch (error) {
    console.error('\n❌ Error during Puppeteer test:');
    console.error(error);
    
    // Additional debug information
    if (error.message.includes('executable path')) {
      console.error('\nPossible solution: Make sure Chromium is installed and the path is correct');
      console.error('Try installing Chromium with: sudo apt-get install -y chromium-browser');
    }
    
    if (error.message.includes('EACCES') || error.message.includes('permission')) {
      console.error('\nPossible solution: Permission issue. Try running with sudo or fix permissions');
    }
    
    if (error.message.includes('crashed')) {
      console.error('\nPossible solution: Browser crashed. This often happens due to memory issues or missing dependencies');
      console.error('1. Increase swap space: sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile');
      console.error('2. Install required libraries: sudo apt-get install -y libatk-bridge2.0-0t64 libatk1.0-0t64 libcups2t64 libgbm1 libglib2.0-0t64 libgtk-3-0t64');
    }
    
  } finally {
    if (browser) {
      console.log('Closing browser...');
      await browser.close();
    }
    
    console.log('\nTest completed.');
    console.log(success ? 'RESULT: PASS ✓' : 'RESULT: FAIL ✗');
    
    if (success && fs.existsSync(outputPath)) {
      console.log(`PDF file was created successfully (${Math.round(fs.statSync(outputPath).size / 1024)} KB)`);
      console.log(`You can view it at: ${outputPath}`);
    }
  }
}

// Run the test
testPuppeteer().catch(console.error);
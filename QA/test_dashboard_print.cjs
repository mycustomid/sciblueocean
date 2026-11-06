const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to Studio login...');
  await page.goto('https://sciblueocean.vercel.app/studio/', { waitUntil: 'networkidle' });
  await page.fill('input[name=username]', 'manager');
  await page.fill('input[name=password]', 'demo-only-change-me');
  await page.click('button[type=submit]');
  await page.waitForURL('**/studio/dashboard/**');
  await page.waitForTimeout(2000);

  // Check print button on Dashboard
  const printBtn = await page.$('button[data-action="print-report"]');
  if (!printBtn) throw new Error('Print button missing from Dashboard!');
  console.log('PASS: Print button present on Dashboard.');

  // Emulate print media
  await page.emulateMedia({ media: 'print' });
  await page.screenshot({ path: path.join(__dirname, 'dashboard_print_preview.png'), fullPage: true });
  console.log('Captured dashboard_print_preview.png in print media mode.');

  // Generate PDF
  await page.pdf({
    path: path.join(__dirname, 'dashboard_report.pdf'),
    format: 'A4',
    printBackground: true,
    margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' }
  });
  console.log('Generated dashboard_report.pdf.');

  // Reset to screen media and test Reports page
  await page.emulateMedia({ media: 'screen' });
  await page.goto('https://sciblueocean.vercel.app/studio/reports/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const reportPrintBtn = await page.$('button[data-action="print-report"]');
  if (!reportPrintBtn) throw new Error('Print button missing from Reports page!');
  console.log('PASS: Print button present on Reports page.');

  await page.emulateMedia({ media: 'print' });
  await page.screenshot({ path: path.join(__dirname, 'reports_print_preview.png'), fullPage: true });
  console.log('Captured reports_print_preview.png in print media mode.');

  await browser.close();
  console.log('--- PRINT TEST COMPLETED SUCCESSFULLY ---');
})().catch(err => {
  console.error(err);
  process.exit(1);
});

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'https://sciblueocean.vercel.app';
const QA_DIR = __dirname;

async function run() {
  console.log('--- STARTING MULTI-ROLE PRINT PROOF GENERATOR ---');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('dialog', async d => {
    console.log(`[Browser Dialog] "${d.message()}" -> Accepting`);
    await d.accept();
  });

  // Helper to save PDF and screenshot in print mode
  async function capturePrintProof(pdfName, pngName) {
    await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(QA_DIR, pngName), fullPage: true });
    await page.pdf({
      path: path.join(QA_DIR, pdfName),
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', bottom: '12mm', left: '15mm', right: '15mm' }
    });
    console.log(`  -> Saved: ${pdfName} and ${pngName}`);
    await page.emulateMedia({ media: 'screen' });
  }

  // 1. CUSTOMER: Booking Tracking Voucher
  console.log('\n[1/7] Testing CUSTOMER Role (Booking Voucher)...');
  await page.goto(`${BASE_URL}/experience/manage/`, { waitUntil: 'networkidle' });
  // Enter a known reference from test booking
  await page.fill('input[name=reference]', 'BO-4A0B0A27');
  await page.fill('input[name=email]', 'jean.paul@example.com');
  await page.click('button[type=submit]');
  await page.waitForSelector('[data-form-result] strong', { timeout: 8000 }).catch(() => null);
  await page.waitForTimeout(1000);
  await capturePrintProof('customer_booking_voucher.pdf', 'customer_booking_voucher.png');

  // Helper for staff login
  async function staffLogin(username) {
    await page.goto(`${BASE_URL}/studio/`, { waitUntil: 'networkidle' });
    await page.fill('input[name=username]', username);
    await page.fill('input[name=password]', 'demo-only-change-me');
    await page.click('button[type=submit]');
    await page.waitForURL('**/studio/dashboard/**', { timeout: 10000 });
    await page.waitForTimeout(1500);
  }

  // 2. RECEPTION: Arrivals Manifest & Official Struk Penginapan
  console.log('\n[2/7] Testing RECEPTION Role (Arrivals & Struk Penginapan)...');
  await staffLogin('reception');
  await page.goto(`${BASE_URL}/studio/arrivals/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await capturePrintProof('reception_arrivals_manifest.pdf', 'reception_arrivals_manifest.png');

  // Trigger Struk Penginapan (Lodging Receipt) modal
  const receiptBtn = await page.$('.receipt-button');
  if (receiptBtn) {
    console.log('  -> Opening Official Struk Penginapan modal...');
    await receiptBtn.click();
    await page.waitForSelector('.printable-receipt', { timeout: 5000 });
    await page.waitForTimeout(1000);

    // Apply receipt print mode
    await page.evaluate(() => document.body.classList.add('printing-receipt'));
    await capturePrintProof('reception_lodging_receipt.pdf', 'reception_lodging_receipt.png');
    await page.evaluate(() => document.body.classList.remove('printing-receipt'));
    await page.click('[data-dialog-close]').catch(() => {});
  } else {
    console.log('  -> Warning: No confirmed booking available for Struk receipt button in arrivals.');
  }

  // 3. HOUSEKEEPING: Room Status & Task Sheet
  console.log('\n[3/7] Testing HOUSEKEEPING Role (Cleaning & Task Sheet)...');
  await staffLogin('housekeeping');
  await page.goto(`${BASE_URL}/studio/housekeeping/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await capturePrintProof('housekeeping_tasks_sheet.pdf', 'housekeeping_tasks_sheet.png');

  // 4. FINANCE: Folios Ledger & Payment Journal
  console.log('\n[4/7] Testing FINANCE Role (Folios Ledger & Payment Journal)...');
  await staffLogin('finance');
  await page.goto(`${BASE_URL}/studio/folios/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await capturePrintProof('finance_folios_ledger.pdf', 'finance_folios_ledger.png');

  await page.goto(`${BASE_URL}/studio/payments/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await capturePrintProof('finance_payments_journal.pdf', 'finance_payments_journal.png');

  // 5. MAINTENANCE: Work Orders & Repairs Sheet
  console.log('\n[5/7] Testing MAINTENANCE Role (Technical Work Orders)...');
  await staffLogin('maintenance');
  await page.goto(`${BASE_URL}/studio/maintenance/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await capturePrintProof('maintenance_work_orders.pdf', 'maintenance_work_orders.png');

  // 6. MANAGER: Operations Summary & Reservation Register
  console.log('\n[6/7] Testing MANAGER Role (Daily Operations & Reservations Register)...');
  await staffLogin('manager');
  await page.goto(`${BASE_URL}/studio/dashboard/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await capturePrintProof('manager_operations_summary.pdf', 'manager_operations_summary.png');

  await page.goto(`${BASE_URL}/studio/bookings/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await capturePrintProof('manager_reservations_register.pdf', 'manager_reservations_register.png');

  // 7. OWNER: Executive Revenue & Analytics Report
  console.log('\n[7/7] Testing OWNER Role (Executive Analytics Report)...');
  await staffLogin('owner');
  await page.goto(`${BASE_URL}/studio/reports/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await capturePrintProof('owner_executive_report.pdf', 'owner_executive_report.png');

  await browser.close();
  console.log('\n=== ALL 7 ROLES PRINT VERIFICATION SUCCESSFULLY COMPLETED ===');
}

run().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});

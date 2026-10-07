const mysql = require('./node_modules/mysql2/promise');

const API_BASE = 'http://localhost:8080';

async function runAllCategoriesBillingTests() {
  console.log('========================================================================');
  console.log('TEST SUITE: BILLING AUTO-FILL & AUTHORITATIVE TARIFFS FOR ALL CATEGORIES');
  console.log('========================================================================\n');

  const pool = mysql.createPool({ host: 'localhost', user: 'root', password: 'root', database: 'carebridge_db' });
  const conn = await pool.getConnection();

  const cleanupItemIds = [];
  const balanceDeductions = {};

  try {
    // --------------------------------------------------------------------
    // TEST 1: CHARGE PREVIEW ENDPOINT FOR ALL 5 CATEGORIES (26MED001)
    // --------------------------------------------------------------------
    console.log('--- TEST 1: CHARGE PREVIEWS FOR PATIENT 26MED001 (Priya, Private Room 501) ---');
    const categoriesToTest = ['Room Rent', 'Consultation', 'Pharmacy', 'Diagnostics', 'Procedures'];

    const expected26MED001 = {
      'Room Rent': { minRate: 3500, maxRate: 3500, descMatch: 'Private Room 501 — Room Rent' },
      'Consultation': { minRate: 5000, maxRate: 5000, descMatch: 'Dr. Marcus Vance' },
      'Pharmacy': { minRate: 135, maxRate: 135, descMatch: 'Ondansetron' },
      'Diagnostics': { minRate: 8000, maxRate: 8000, descMatch: 'CT Scan Thorax' },
      'Procedures': { minRate: 3500, maxRate: 3500, descMatch: 'IV Infusion' }
    };

    for (const cat of categoriesToTest) {
      const res = await fetch(`${API_BASE}/api/hms/admissions/26MED001/charge-preview?category=${encodeURIComponent(cat)}`);
      const data = await res.json();

      if (!res.ok || !data.configured) {
        throw new Error(`Test 1 Failed for category "${cat}": ${JSON.stringify(data)}`);
      }

      const exp = expected26MED001[cat];
      const amount = Number(data.amount);
      if (amount < exp.minRate || amount > exp.maxRate) {
        throw new Error(`Test 1 Rate Mismatch for "${cat}": expected ₹${exp.minRate}, got ₹${amount}`);
      }
      if (!data.description.includes(exp.descMatch)) {
        throw new Error(`Test 1 Description Mismatch for "${cat}": expected substring "${exp.descMatch}", got "${data.description}"`);
      }

      console.log(`[PASS] 26MED001 [${cat}]: ₹${amount.toFixed(2)} | "${data.description}"`);
      console.log(`       Helper: ${data.helperText}`);
    }
    console.log('');

    // --------------------------------------------------------------------
    // TEST 2: CHARGE PREVIEW ENDPOINT FOR ICU PATIENT (26CAR004)
    // --------------------------------------------------------------------
    console.log('--- TEST 2: CHARGE PREVIEWS FOR ICU PATIENT 26CAR004 (Sunita Patel, ICU Room 303) ---');
    const expected26CAR004 = {
      'Room Rent': { minRate: 12000, maxRate: 12000, descMatch: 'ICU Room 303 — Room Rent' },
      'Consultation': { minRate: 12000, maxRate: 12000, descMatch: 'Dr. Aris Thorne' },
      'Pharmacy': { minRate: 90, maxRate: 90, descMatch: 'Amoxicillin' },
      'Diagnostics': { minRate: 8000, maxRate: 8000, descMatch: 'Electrolytes Panel' },
      'Procedures': { minRate: 3500, maxRate: 3500, descMatch: 'Standard Inpatient Clinical Procedure' }
    };

    for (const cat of categoriesToTest) {
      const res = await fetch(`${API_BASE}/api/hms/admissions/26CAR004/charge-preview?category=${encodeURIComponent(cat)}`);
      const data = await res.json();

      if (!res.ok || !data.configured) {
        throw new Error(`Test 2 Failed for category "${cat}": ${JSON.stringify(data)}`);
      }

      const exp = expected26CAR004[cat];
      const amount = Number(data.amount);
      if (amount < exp.minRate || amount > exp.maxRate) {
        throw new Error(`Test 2 Rate Mismatch for "${cat}": expected ₹${exp.minRate}, got ₹${amount}`);
      }
      if (!data.description.includes(exp.descMatch)) {
        throw new Error(`Test 2 Description Mismatch for "${cat}": expected substring "${exp.descMatch}", got "${data.description}"`);
      }

      console.log(`[PASS] 26CAR004 [${cat}]: ₹${amount.toFixed(2)} | "${data.description}"`);
      console.log(`       Helper: ${data.helperText}`);
    }
    console.log('');

    // --------------------------------------------------------------------
    // TEST 3: BACKEND TAMPER-PROOFING FOR ALL CATEGORIES
    // Client attempts to submit manipulated amount (e.g. ₹0.50).
    // Backend must override client amount with authoritative tariff rate.
    // --------------------------------------------------------------------
    console.log('--- TEST 3: BACKEND REJECTS / OVERRIDES CLIENT-MANIPULATED AMOUNTS ---');
    const testCases = [
      { cat: 'Room Rent', adm: '26MED001', expectedRate: 3500, testDesc: 'Tampered Room Rent Test' },
      { cat: 'Consultation', adm: '26MED001', expectedRate: 5000, testDesc: 'Tampered Consultation Test' },
      { cat: 'Pharmacy', adm: '26MED001', expectedRate: 135, testDesc: 'Tampered Pharmacy Test' },
      { cat: 'Diagnostics', adm: '26MED001', expectedRate: 8000, testDesc: 'Tampered Diagnostics Test' },
      { cat: 'Procedures', adm: '26MED001', expectedRate: 3500, testDesc: 'Tampered Procedures Test' }
    ];

    for (const tc of testCases) {
      const payload = {
        admissionId: tc.adm,
        category: tc.cat,
        description: tc.testDesc,
        amount: 0.50 // Client manipulates amount to ₹0.50
      };

      const res = await fetch(`${API_BASE}/api/hms/billing/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(`Test 3 API Call Failed for "${tc.cat}": ${JSON.stringify(data)}`);
      }

      if (data.amount !== tc.expectedRate) {
        throw new Error(`Test 3 Failed: Server accepted manipulated amount ₹${data.amount} instead of ₹${tc.expectedRate} for ${tc.cat}`);
      }

      // Verify authoritative amount recorded in database
      const [dbRows] = await conn.query(
        "SELECT id, amount FROM bill_items WHERE admission_id = ? AND description = ? ORDER BY id DESC LIMIT 1",
        [tc.adm, tc.testDesc]
      );
      if (dbRows.length === 0 || Number(dbRows[0].amount) !== tc.expectedRate) {
        throw new Error(`Test 3 DB Verification Failed for ${tc.cat}: expected ${tc.expectedRate}, got ${dbRows[0]?.amount}`);
      }

      cleanupItemIds.push(dbRows[0].id);
      balanceDeductions[tc.adm] = (balanceDeductions[tc.adm] || 0) + tc.expectedRate;

      console.log(`[PASS] ${tc.cat}: Client amount (₹0.50) successfully overridden with DB tariff rate ₹${data.amount.toFixed(2)} in DB (Item #${dbRows[0].id}).`);
    }
    console.log('');

    // --------------------------------------------------------------------
    // TEST 4: UNCONFIGURED CATEGORY REJECTION
    // --------------------------------------------------------------------
    console.log('--- TEST 4: UNCONFIGURED CATEGORY REJECTION ---');
    const unconfRes = await fetch(`${API_BASE}/api/hms/billing/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        admissionId: '26MED001',
        category: 'NonExistentCategory',
        description: 'Random non-existent charge',
        amount: 500
      })
    });
    const unconfData = await unconfRes.json();

    if (unconfRes.status !== 400 || unconfData.code !== 'CATEGORY_TARIFF_NOT_CONFIGURED') {
      throw new Error(`Test 4 Failed: Expected HTTP 400 CATEGORY_TARIFF_NOT_CONFIGURED, got ${unconfRes.status}: ${JSON.stringify(unconfData)}`);
    }
    console.log(`[PASS] Unconfigured category safely rejected with HTTP 400: "${unconfData.error}"\n`);

    // --------------------------------------------------------------------
    // TEST 5: DUPLICATE CHARGE GUARD ENFORCEMENT
    // --------------------------------------------------------------------
    console.log('--- TEST 5: DUPLICATE CHARGE GUARD ENFORCEMENT ---');
    const dupRes = await fetch(`${API_BASE}/api/hms/billing/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        admissionId: '26MED001',
        category: 'Procedures',
        description: 'Tampered Procedures Test',
        amount: 3500
      })
    });
    const dupData = await dupRes.json();

    if (dupRes.status !== 409 || dupData.code !== 'DUPLICATE_BILLING_ITEM') {
      throw new Error(`Test 5 Failed: Duplicate item was not rejected with HTTP 409: ${JSON.stringify(dupData)}`);
    }
    console.log(`[PASS] Duplicate charge guarded with HTTP 409: "${dupData.error}"\n`);

    // --------------------------------------------------------------------
    // TEST 6: PRESERVE BACKWARD COMPATIBILITY (ROOM RENT ENDPOINT & TEST 6)
    // --------------------------------------------------------------------
    console.log('--- TEST 6: BACKWARD COMPATIBILITY AUDIT ---');
    const rrRes = await fetch(`${API_BASE}/api/hms/admissions/26MED001/room-tariff`);
    const rrData = await rrRes.json();
    if (!rrData.tariffConfigured || rrData.dailyRate !== 3500) {
      throw new Error(`Test 6 Failed: room-tariff endpoint broken: ${JSON.stringify(rrData)}`);
    }
    console.log(`[PASS] Legacy /room-tariff endpoint fully intact: ₹${rrData.dailyRate} for ${rrData.currentRoom}\n`);

    console.log('========================================================================');
    console.log('ALL TESTS PASSED: AUTO-FILL & PRICING VERIFIED FOR ALL CATEGORIES!');
    console.log('========================================================================\n');

  } catch (err) {
    console.error('TEST SUITE RUNTIME ERROR:', err);
    process.exit(1);
  } finally {
    // --------------------------------------------------------------------
    // CLEAN UP TEST CHARGES (DATA INTEGRITY PRESERVATION)
    // --------------------------------------------------------------------
    console.log('--- CLEANING UP TEST CHARGES ---');
    for (const id of cleanupItemIds) {
      await conn.query('DELETE FROM bill_items WHERE id = ?', [id]);
    }
    for (const [admId, deduction] of Object.entries(balanceDeductions)) {
      await conn.query(
        'UPDATE billing_summary SET total_bill = total_bill - ?, remaining_payable = remaining_payable - ? WHERE admission_id = ?',
        [deduction, deduction, admId]
      );
    }
    console.log(`Cleaned up ${cleanupItemIds.length} test records. Restored balances in billing_summary.`);

    conn.release();
    pool.end();
  }
}

runAllCategoriesBillingTests();

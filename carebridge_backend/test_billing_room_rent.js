const mysql = require('./node_modules/mysql2/promise');

const API_BASE = 'http://localhost:8080';

async function runBillingTests() {
  console.log('============================================================');
  console.log('BILLING PORTAL — AUTO-FILL ROOM RENT TEST SUITE');
  console.log('============================================================\n');

  const pool = mysql.createPool({ host: 'localhost', user: 'root', password: 'root', database: 'carebridge_db' });
  const conn = await pool.getConnection();

  let testBillItemId1 = null;
  let testBillItemId2 = null;

  try {
    await conn.query("DELETE FROM bill_items WHERE description = 'Hacked Room Rent'");

    // ------------------------------------------------------------
    // TEST 1 — TARIFF LOOKUP FOR CONFIGURED ROOM (ICU Room 303)
    // ------------------------------------------------------------
    console.log('--- TEST 1: TARIFF LOOKUP FOR CONFIGURED ROOM (26CAR004 in ICU Room 303) ---');
    const res1 = await fetch(`${API_BASE}/api/hms/admissions/26CAR004/room-tariff`);
    const data1 = await res1.json();

    if (!res1.ok || !data1.tariffConfigured || data1.dailyRate !== 12000) {
      throw new Error(`Test 1 Failed: Expected tariffConfigured=true, dailyRate=12000. Got: ${JSON.stringify(data1)}`);
    }
    console.log(`[PASS] Test 1: Current room correctly identified as "${data1.currentRoom}"`);
    console.log(`[PASS] Test 1: Configured daily rate returned as ₹${data1.dailyRate.toFixed(2)}`);
    console.log(`[PASS] Test 1: Auto-generated description: "${data1.description}"\n`);

    // ------------------------------------------------------------
    // TEST 2 — TARIFF LOOKUP FOR UNCONFIGURED ROOM (26CAR003 in Room 205)
    // ------------------------------------------------------------
    console.log('--- TEST 2: TARIFF LOOKUP FOR UNCONFIGURED ROOM (26CAR003 in Room 205) ---');
    const res2 = await fetch(`${API_BASE}/api/hms/admissions/26CAR003/room-tariff`);
    const data2 = await res2.json();

    if (data2.tariffConfigured !== false || data2.dailyRate !== null) {
      throw new Error(`Test 2 Failed: Expected tariffConfigured=false, dailyRate=null. Got: ${JSON.stringify(data2)}`);
    }
    console.log(`[PASS] Test 2: Unconfigured room handled safely: "${data2.error}"`);
    console.log(`[PASS] Test 2: No guessed/invented rate used (dailyRate is null).\n`);

    // ------------------------------------------------------------
    // TEST 3 — BACKEND VALIDATION & TAMPER PROOFING
    // Attempt to submit a manipulated amount (e.g. ₹1.00) via API
    // ------------------------------------------------------------
    console.log('--- TEST 3: BACKEND REJECTS / OVERRIDES CLIENT-MANIPULATED AMOUNT ---');
    console.log('Submitting client payload with manipulated amount: ₹1.00 for Room Rent...');
    const tamperedPayload = {
      admissionId: '26CAR004',
      description: 'Hacked Room Rent',
      category: 'Room Rent',
      amount: 1.00 // Client tries to pay only ₹1.00!
    };

    const res3 = await fetch(`${API_BASE}/api/hms/billing/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tamperedPayload)
    });
    const data3 = await res3.json();

    if (!res3.ok || !data3.success) {
      throw new Error(`Test 3 Failed: API call failed: ${JSON.stringify(data3)}`);
    }

    if (data3.amount !== 12000.00) {
      throw new Error(`Test 3 Failed: Backend accepted manipulated amount! Got: ${data3.amount}, expected: 12000.00`);
    }

    console.log(`[PASS] Test 3: Backend ignored client amount (₹1.00) and authoritatively charged configured rate ₹${data3.amount.toFixed(2)}.`);

    // Verify in database
    const [dbRows3] = await conn.query("SELECT * FROM bill_items WHERE admission_id = '26CAR004' AND category = 'Room Rent' ORDER BY id DESC LIMIT 1");
    if (dbRows3.length === 0 || Number(dbRows3[0].amount) !== 12000.00) {
      throw new Error(`Test 3 DB Check Failed: Database row does not have 12000.00! Got: ${dbRows3[0]?.amount}`);
    }
    testBillItemId1 = dbRows3[0].id;
    console.log(`[PASS] Test 3 DB: bill_items table row id=${testBillItemId1} has amount ₹${dbRows3[0].amount} (authoritative rate enforced in DB).\n`);

    // ------------------------------------------------------------
    // TEST 4 — BACKEND REJECTS ROOM RENT FOR UNCONFIGURED ROOM
    // ------------------------------------------------------------
    console.log('--- TEST 4: BACKEND REJECTS ROOM RENT CHARGE FOR UNCONFIGURED ROOM ---');
    console.log('Attempting to create Room Rent charge for 26CAR003 in Room 205 (unconfigured)...');
    const unconfPayload = {
      admissionId: '26CAR003',
      description: 'Room 205 Rent',
      category: 'Room Rent',
      amount: 5000.00
    };

    const res4 = await fetch(`${API_BASE}/api/hms/billing/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(unconfPayload)
    });
    const data4 = await res4.json();

    if (res4.status !== 400 || data4.code !== 'ROOM_TARIFF_NOT_CONFIGURED') {
      throw new Error(`Test 4 Failed: Expected HTTP 400 with ROOM_TARIFF_NOT_CONFIGURED, got ${res4.status}: ${JSON.stringify(data4)}`);
    }
    console.log(`[PASS] Test 4: Backend rejected unconfigured room charge with HTTP 400: "${data4.error}"\n`);

    // ------------------------------------------------------------
    // TEST 5 — ROOM TRANSFER COMPATIBILITY
    // Transfer patient 26CAR003 from Room 205 to ICU Room 101, verify tariff, then transfer back
    // ------------------------------------------------------------
    console.log('--- TEST 5: ROOM TRANSFER COMPATIBILITY ---');
    console.log('Transferring 26CAR003 from Room 205 to ICU Room 101...');
    const transferRes = await fetch(`${API_BASE}/api/hms/admissions/26CAR003/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomNumber: 'ICU Room 101',
        attendingDoctor: 'Dr. Elena Rostova (Pulmonology)',
        reason: 'Temporary transfer for billing validation test',
        transferredBy: 'Test Suite'
      })
    });
    const transferData = await transferRes.json();
    if (!transferRes.ok || !transferData.success) {
      throw new Error(`Test 5 Transfer Failed: ${JSON.stringify(transferData)}`);
    }

    // Now check tariff after transfer
    const res5 = await fetch(`${API_BASE}/api/hms/admissions/26CAR003/room-tariff`);
    const data5 = await res5.json();

    if (!data5.tariffConfigured || data5.dailyRate !== 12000 || data5.currentRoom !== 'ICU Room 101') {
      throw new Error(`Test 5 Failed: Expected tariff 12000 for ICU Room 101, got: ${JSON.stringify(data5)}`);
    }
    console.log(`[PASS] Test 5: After transfer to ICU Room 101, tariff is now automatically configured at ₹${data5.dailyRate.toFixed(2)}/day.`);

    // Transfer back to Room 205
    console.log('Restoring 26CAR003 back to Room 205...');
    await fetch(`${API_BASE}/api/hms/admissions/26CAR003/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        department: 'Pulmonology',
        roomNumber: 'Room 205',
        attendingDoctor: 'Dr. Elena Rostova (Pulmonology)',
        reason: 'Restoring Room 205',
        transferredBy: 'Test Suite'
      })
    });

    const res5_restored = await fetch(`${API_BASE}/api/hms/admissions/26CAR003/room-tariff`);
    const data5_restored = await res5_restored.json();
    if (data5_restored.currentRoom !== 'Room 205' || data5_restored.tariffConfigured !== false) {
      throw new Error(`Test 5 Failed: Room was not restored to Room 205 properly: ${JSON.stringify(data5_restored)}`);
    }
    console.log(`[PASS] Test 5: Restored 26CAR003 back to Room 205 (tariff configured: ${data5_restored.tariffConfigured}).\n`);

    // ------------------------------------------------------------
    // TEST 6 — NON-ROOM RENT CATEGORIES PRESERVE EXISTING BEHAVIOR
    // ------------------------------------------------------------
    console.log('--- TEST 6: NON-ROOM-RENT CATEGORIES PRESERVE EXISTING BEHAVIOR ---');
    const consultPayload = {
      admissionId: '26CAR004',
      description: 'Senior Consultant Cardiology Review',
      category: 'Consultation',
      amount: 2500.00
    };

    const res6 = await fetch(`${API_BASE}/api/hms/billing/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(consultPayload)
    });
    const data6 = await res6.json();

    if (!res6.ok || !data6.success || data6.amount !== 2500.00) {
      throw new Error(`Test 6 Failed: ${JSON.stringify(data6)}`);
    }
    testBillItemId2 = (await conn.query("SELECT id FROM bill_items WHERE admission_id = '26CAR004' AND category = 'Consultation' AND amount = 2500.00 ORDER BY id DESC LIMIT 1"))[0][0]?.id;
    console.log(`[PASS] Test 6: Consultation charge of ₹${data6.amount.toFixed(2)} added as entered without modification.\n`);

    // ------------------------------------------------------------
    // CLEAN UP TEST CHARGES (PRESERVE ORIGINAL DATA INTEGRITY)
    // ------------------------------------------------------------
    console.log('--- CLEANING UP TEST CHARGES ---');
    if (testBillItemId1) {
      await conn.query("DELETE FROM bill_items WHERE id = ?", [testBillItemId1]);
      await conn.query("UPDATE billing_summary SET total_bill = total_bill - 12000.00, remaining_payable = remaining_payable - 12000.00 WHERE admission_id = '26CAR004'");
    }
    if (testBillItemId2) {
      await conn.query("DELETE FROM bill_items WHERE id = ?", [testBillItemId2]);
      await conn.query("UPDATE billing_summary SET total_bill = total_bill - 2500.00, remaining_payable = remaining_payable - 2500.00 WHERE admission_id = '26CAR004'");
    }
    console.log('[PASS] Test charges cleaned up. Billing summary balances restored.\n');

    console.log('============================================================');
    console.log('ALL 6 BILLING ROOM RENT TESTS PASSED WITH 100% SUCCESS!');
    console.log('============================================================');

  } catch (err) {
    console.error('TEST SUITE ERROR:', err);
    process.exit(1);
  } finally {
    conn.release();
    pool.end();
  }
}

runBillingTests();

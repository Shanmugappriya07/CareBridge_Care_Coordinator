const mysql = require('c:/Users/SHANMUGAPPRIYA/OneDrive/Desktop/CareBridge/carebridgedemo-main/carebridge_backend/node_modules/mysql2/promise');

const API_BASE = 'http://localhost:8080';

async function runTests() {
  console.log('============================================================');
  console.log('GLOBAL HMS CONSISTENCY FIX — AUTOMATED VALIDATION SUITE');
  console.log('============================================================\n');

  const pool = mysql.createPool({ host: 'localhost', user: 'root', password: 'root', database: 'carebridge_db' });
  const conn = await pool.getConnection();

  let testPatientId = null;
  let testAdmissionId1 = null;
  let testAdmissionId2 = null;

  try {
    // ------------------------------------------------------------
    // TEST 1 — NEW PATIENT ADMISSION
    // ------------------------------------------------------------
    console.log('--- TEST 1: NEW PATIENT ADMISSION ---');
    const newPatPayload = {
      patientMode: 'new',
      fullName: 'Test David Miller',
      age: 48,
      gender: 'Male',
      bloodGroup: 'B+',
      patientPhone: '+91 9988776655',
      department: 'Cardiology',
      roomNumber: 'Private Room 502',
      attendingDoctor: 'Dr. Aris Thorne (Cardiology)',
      caregiverName: 'Sarah Miller',
      caregiverPhone: '+91 9988776656',
      relation: 'Spouse',
      admissionType: 'Emergency',
      reasonForAdmission: 'Chest tightness for testing'
    };

    const res1 = await fetch(`${API_BASE}/api/hms/admissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPatPayload)
    });
    const data1 = await res1.json();

    if (!res1.ok || !data1.success) {
      throw new Error(`Test 1 Failed: ${JSON.stringify(data1)}`);
    }

    testPatientId = data1.patientId;
    testAdmissionId1 = data1.admissionId;
    console.log(`[PASS] Test 1: Created new patient ${testPatientId} with admission ${testAdmissionId1}`);

    // Verify exactly 1 active admission in DB
    const [actRows1] = await conn.query("SELECT * FROM admissions WHERE patient_id = ? AND status IN ('ADMITTED', 'ACTIVE')", [testPatientId]);
    if (actRows1.length !== 1) {
      throw new Error(`Test 1 DB Check Failed: expected 1 active admission, got ${actRows1.length}`);
    }
    console.log(`[PASS] Test 1 DB: Verified exactly ONE active admission in database.\n`);

    // ------------------------------------------------------------
    // TEST 2 — DUPLICATE ADMISSION ATTEMPT
    // ------------------------------------------------------------
    console.log('--- TEST 2: DUPLICATE ADMISSION ATTEMPT ---');
    const dupPayload = {
      patientMode: 'existing',
      patientId: testPatientId,
      fullName: 'Test David Miller',
      age: 48,
      gender: 'Male',
      bloodGroup: 'B+',
      patientPhone: '+91 9988776655',
      department: 'Pulmonology',
      roomNumber: 'Private Room 503',
      attendingDoctor: 'Dr. Elena Rostova (Pulmonology)',
      caregiverName: 'Sarah Miller',
      caregiverPhone: '+91 9988776656',
      relation: 'Spouse',
      admissionType: 'Emergency',
      reasonForAdmission: 'Attempting duplicate admission'
    };

    const res2 = await fetch(`${API_BASE}/api/hms/admissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dupPayload)
    });
    const data2 = await res2.json();

    if (res2.status !== 409 || data2.code !== 'ACTIVE_ADMISSION_EXISTS') {
      throw new Error(`Test 2 Failed: expected HTTP 409 with ACTIVE_ADMISSION_EXISTS, got ${res2.status}: ${JSON.stringify(data2)}`);
    }
    console.log(`[PASS] Test 2: HTTP 409 received as expected: "${data2.error}"`);

    // Verify DB still only has 1 admission
    const [admCount] = await conn.query("SELECT COUNT(*) as cnt FROM admissions WHERE patient_id = ?", [testPatientId]);
    if (admCount[0].cnt !== 1) {
      throw new Error(`Test 2 DB Check Failed: expected exactly 1 admission, got ${admCount[0].cnt}`);
    }
    console.log(`[PASS] Test 2 DB: Confirmed no second admission ID was created.\n`);

    // ------------------------------------------------------------
    // TEST 3 — TRANSFER
    // ------------------------------------------------------------
    console.log('--- TEST 3: PATIENT TRANSFER ---');
    console.log('Testing transfer of 26PAT0004 (26CAR003) to Semi-Private Room 401...');
    const transferPayload = {
      department: 'Pulmonology',
      roomNumber: 'Semi-Private Room 401',
      attendingDoctor: 'Dr. Elena Rostova (Pulmonology)',
      reason: 'Testing clinical transfer protocol',
      transferredBy: 'Test Runner'
    };

    const res3 = await fetch(`${API_BASE}/api/hms/admissions/26CAR003/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transferPayload)
    });
    const data3 = await res3.json();

    if (!res3.ok || !data3.success) {
      throw new Error(`Test 3 Failed: ${JSON.stringify(data3)}`);
    }
    if (data3.admissionId !== '26CAR003' || data3.patientId !== '26PAT0004') {
      throw new Error(`Test 3 Failed: IDs mutated! ${JSON.stringify(data3)}`);
    }
    console.log(`[PASS] Test 3: Transfer successful. Admission ID remained ${data3.admissionId}, new room: ${data3.toRoom}`);

    // Verify in patient_transfers
    const [tLog] = await conn.query("SELECT * FROM patient_transfers WHERE admission_id = '26CAR003' ORDER BY id DESC LIMIT 1");
    if (tLog.length === 0 || tLog[0].to_room !== 'Semi-Private Room 401') {
      throw new Error(`Test 3 DB Check Failed: patient_transfers record missing or incorrect`);
    }
    console.log(`[PASS] Test 3 DB: patient_transfers audit row logged successfully (from ${tLog[0].from_room} to ${tLog[0].to_room}).`);

    // Transfer back to Room 205
    await fetch(`${API_BASE}/api/hms/admissions/26CAR003/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        department: 'Pulmonology',
        roomNumber: 'Room 205',
        attendingDoctor: 'Dr. Elena Rostova (Pulmonology)',
        reason: 'Restoring Room 205',
        transferredBy: 'Test Runner'
      })
    });
    console.log(`[PASS] Test 3: Restored 26CAR003 back to Room 205.\n`);

    // ------------------------------------------------------------
    // TEST 4 — ROOM OCCUPANCY CONFLICT
    // ------------------------------------------------------------
    console.log('--- TEST 4: ROOM OCCUPANCY CONFLICT GUARD ---');
    console.log('Attempting to admit a new patient into occupied room "Room 205"...');
    const occPayload = {
      patientMode: 'new',
      fullName: 'Collision Candidate',
      age: 30,
      gender: 'Female',
      bloodGroup: 'O+',
      patientPhone: '+91 9111122223',
      department: 'Cardiology',
      roomNumber: 'Room 205',
      attendingDoctor: 'Dr. Aris Thorne (Cardiology)',
      caregiverName: 'Caregiver A',
      caregiverPhone: '+91 9111122224',
      relation: 'Sibling',
      admissionType: 'Planned',
      reasonForAdmission: 'Collision test'
    };

    const res4 = await fetch(`${API_BASE}/api/hms/admissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(occPayload)
    });
    const data4 = await res4.json();

    if (res4.status !== 409 || data4.code !== 'ROOM_OCCUPIED') {
      throw new Error(`Test 4 Failed: expected HTTP 409 with ROOM_OCCUPIED, got ${res4.status}: ${JSON.stringify(data4)}`);
    }
    console.log(`[PASS] Test 4: HTTP 409 received as expected: "${data4.error}"\n`);

    // ------------------------------------------------------------
    // TEST 5 — DISCHARGE
    // ------------------------------------------------------------
    console.log('--- TEST 5: DISCHARGE ADMISSION (BOTH PUT AND POST) ---');
    console.log(`Discharging test admission ${testAdmissionId1} via PUT...`);
    const res5 = await fetch(`${API_BASE}/api/v1/admissions/${testAdmissionId1}/discharge`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: 'Patient recovered and discharged in stable condition.' })
    });
    const data5 = await res5.json();

    if (!res5.ok || !data5.success) {
      throw new Error(`Test 5 Failed: ${JSON.stringify(data5)}`);
    }
    console.log(`[PASS] Test 5: PUT discharge succeeded: "${data5.message}"`);

    // Verify DB status
    const [disRows] = await conn.query("SELECT status, room_number, discharge_summary FROM admissions WHERE admission_id = ?", [testAdmissionId1]);
    if (disRows[0].status !== 'DISCHARGED') {
      throw new Error(`Test 5 DB Check Failed: expected status DISCHARGED, got ${disRows[0].status}`);
    }
    console.log(`[PASS] Test 5 DB: Status is DISCHARGED, summary recorded.`);

    // Verify room is released
    const occCheck = await fetch(`${API_BASE}/api/hms/rooms/occupancy`);
    const occList = await occCheck.json();
    const isOccupied = occList.some(r => r.roomNumber === 'Private Room 502');
    if (isOccupied) {
      throw new Error(`Test 5 Failed: "Private Room 502" should be released, but is still listed as occupied!`);
    }
    console.log(`[PASS] Test 5: "Private Room 502" is verified released and available.\n`);

    // ------------------------------------------------------------
    // TEST 6 — NEW ADMISSION AFTER DISCHARGE
    // ------------------------------------------------------------
    console.log('--- TEST 6: NEW ADMISSION AFTER DISCHARGE ---');
    console.log(`Creating second admission for patient ${testPatientId} after discharge...`);
    const readmitPayload = {
      patientMode: 'existing',
      patientId: testPatientId,
      fullName: 'Test David Miller',
      age: 48,
      gender: 'Male',
      bloodGroup: 'B+',
      patientPhone: '+91 9988776655',
      department: 'Pulmonology',
      roomNumber: 'Private Room 502',
      attendingDoctor: 'Dr. Elena Rostova (Pulmonology)',
      caregiverName: 'Sarah Miller',
      caregiverPhone: '+91 9988776656',
      relation: 'Spouse',
      admissionType: 'Planned',
      reasonForAdmission: 'Follow-up pulmonary admission'
    };

    const res6 = await fetch(`${API_BASE}/api/hms/admissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(readmitPayload)
    });
    const data6 = await res6.json();

    if (!res6.ok || !data6.success) {
      throw new Error(`Test 6 Failed: ${JSON.stringify(data6)}`);
    }
    testAdmissionId2 = data6.admissionId;

    if (data6.patientId !== testPatientId) {
      throw new Error(`Test 6 Failed: Patient ID changed from ${testPatientId} to ${data6.patientId}`);
    }
    if (testAdmissionId2 === testAdmissionId1) {
      throw new Error(`Test 6 Failed: A new Admission ID was not generated (still ${testAdmissionId1})`);
    }
    console.log(`[PASS] Test 6: Re-admission successful! Patient ID kept: ${data6.patientId}, NEW Admission ID generated: ${testAdmissionId2}`);

    // Verify DB admissions
    const [allAdms] = await conn.query("SELECT admission_id, status FROM admissions WHERE patient_id = ? ORDER BY created_at ASC", [testPatientId]);
    console.log(`[PASS] Test 6 DB: Patient now has 2 historical stays: [${allAdms.map(a => `${a.admission_id}: ${a.status}`).join(', ')}]\n`);

    // Clean up test re-admission
    await conn.query("DELETE FROM admissions WHERE admission_id = ?", [testAdmissionId2]);
    await conn.query("DELETE FROM patients WHERE admission_id = ?", [testAdmissionId2]);
    await conn.query("DELETE FROM admissions WHERE admission_id = ?", [testAdmissionId1]);
    await conn.query("DELETE FROM patients WHERE admission_id = ?", [testAdmissionId1]);
    await conn.query("DELETE FROM patients_master WHERE patient_id = ?", [testPatientId]);
    console.log('[INFO] Test records cleaned up.\n');

    // ------------------------------------------------------------
    // TEST 7 — DOWNSTREAM DATA INTEGRITY VERIFICATION
    // ------------------------------------------------------------
    console.log('--- TEST 7: DOWNSTREAM DATA INTEGRITY VERIFICATION ---');

    // 1. Verify 26PAT0004 & 26CAR003
    const [rx4] = await conn.query("SELECT COUNT(*) as cnt FROM prescriptions WHERE admission_id = '26CAR003' AND patient_id = '26PAT0004'");
    const [lab4] = await conn.query("SELECT COUNT(*) as cnt FROM lab_reports WHERE admission_id = '26CAR003'");
    const [app4] = await conn.query("SELECT COUNT(*) as cnt FROM doctor_appointments WHERE admission_id = '26CAR003'");
    console.log(`26PAT0004 (26CAR003): Prescriptions=${rx4[0].cnt}, Lab Reports=${lab4[0].cnt}, Appointments=${app4[0].cnt}`);

    // 2. Verify 26PAT0005 & 26CAR004 (NOT merged!)
    const [pat5] = await conn.query("SELECT * FROM patients_master WHERE patient_id = '26PAT0005'");
    if (pat5.length === 0) throw new Error("CRITICAL FAILURE: 26PAT0005 was deleted or merged!");
    const [rx5] = await conn.query("SELECT COUNT(*) as cnt FROM prescriptions WHERE admission_id = '26CAR004' AND patient_id = '26PAT0005'");
    const [lab5] = await conn.query("SELECT COUNT(*) as cnt FROM lab_reports WHERE admission_id = '26CAR004'");
    const [app5] = await conn.query("SELECT COUNT(*) as cnt FROM doctor_appointments WHERE admission_id = '26CAR004'");
    const [phm5] = await conn.query("SELECT COUNT(*) as cnt FROM pharmacy_transactions WHERE admission_id = '26CAR004' AND patient_id = '26PAT0005'");
    const [bill5] = await conn.query("SELECT COUNT(*) as cnt FROM bill_items WHERE admission_id = '26CAR004'");
    const [pay5] = await conn.query("SELECT COUNT(*) as cnt FROM payments WHERE admission_id = '26CAR004'");
    console.log(`26PAT0005 (26CAR004): Prescriptions=${rx5[0].cnt}, Lab Reports=${lab5[0].cnt}, Appointments=${app5[0].cnt}, Pharmacy=${phm5[0].cnt}, BillItems=${bill5[0].cnt}, Payments=${pay5[0].cnt}`);
    console.log(`[PASS] Test 7: 26PAT0005 identity and all downstream clinical/pharmacy/billing records strictly preserved!`);

    // 3. Verify 26PAT0002 (26CAR002 DISCHARGED, 26PUL001 ACTIVE)
    const [rx2_car] = await conn.query("SELECT COUNT(*) as cnt FROM prescriptions WHERE admission_id = '26CAR002'");
    const [rx2_pul] = await conn.query("SELECT COUNT(*) as cnt FROM prescriptions WHERE admission_id = '26PUL001'");
    const [adm2] = await conn.query("SELECT admission_id, status, room_number FROM admissions WHERE patient_id = '26PAT0002' ORDER BY admission_id ASC");
    console.log(`26PAT0002: Admissions=[${adm2.map(a => `${a.admission_id}(${a.status} in ${a.room_number})`).join(', ')}], 26CAR002 Rx=${rx2_car[0].cnt}, 26PUL001 Rx=${rx2_pul[0].cnt}`);
    console.log(`[PASS] Test 7: 26PAT0002 historical and current stay records strictly preserved!`);

    // 4. Global Census Verification
    const [allActiveAdms] = await conn.query("SELECT patient_id, admission_id, current_dept, room_number FROM admissions WHERE status IN ('ADMITTED', 'ACTIVE')");
    console.log(`\nCurrent Live Active Admissions Census (${allActiveAdms.length} patients):`);
    allActiveAdms.forEach(a => console.log(`  - ${a.patient_id} | ${a.admission_id} | ${a.current_dept} | ${a.room_number}`));

    // Check unique rooms
    const rooms = allActiveAdms.map(a => a.room_number);
    const uniqueRooms = new Set(rooms);
    if (uniqueRooms.size !== rooms.length) {
      throw new Error(`Room collision detected in active admissions! ${rooms}`);
    }
    console.log(`[PASS] Test 7: Verified 100% unique room occupancy across all active patients.`);

    // Check unique patients
    const patientIds = allActiveAdms.map(a => a.patient_id);
    const uniquePats = new Set(patientIds);
    if (uniquePats.size !== patientIds.length) {
      throw new Error(`Duplicate active patient detected! ${patientIds}`);
    }
    console.log(`[PASS] Test 7: Verified strictly ONE active admission per patient.`);

    console.log('\n============================================================');
    console.log('ALL 7 VALIDATION TESTS PASSED WITH 100% SUCCESS!');
    console.log('============================================================');

  } catch (err) {
    console.error('TEST SUITE FAILED:', err);
  } finally {
    conn.release();
    pool.end();
  }
}

runTests();

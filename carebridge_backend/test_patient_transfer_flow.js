/**
 * Test Suite: Patient Transfer Flow Validation
 * Verifies that:
 * 1. Target Department cannot be changed (remains strictly unchanged).
 * 2. Cross-department rooms are rejected by backend (HTTP 400).
 * 3. Cross-department doctors are rejected by backend (HTTP 400).
 * 4. Compatible department-specific rooms and general rooms succeed.
 * 5. Attending doctor can be updated only to doctors in patient's department.
 * 6. Audit trail is preserved in patient_transfers table.
 * 7. Frontend assets conform to requirements.
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:8080';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING PATIENT TRANSFER FLOW TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // 1. Verify Frontend Asset Structure
  console.log('--- Step 1: Checking Frontend HTML & JS Implementation ---');
  const indexPath = path.join(__dirname, '..', 'hms_staff_portal', 'index.html');
  const hmsAppPath = path.join(__dirname, '..', 'hms_staff_portal', 'hms_app.js');
  const customDropdownPath = path.join(__dirname, '..', 'hms_staff_portal', 'custom_dropdown.js');

  const indexHtml = fs.readFileSync(indexPath, 'utf8');
  const hmsAppJs = fs.readFileSync(hmsAppPath, 'utf8');
  const customDropdownJs = fs.readFileSync(customDropdownPath, 'utf8');

  assert(indexHtml.includes('id="transferDept"') && indexHtml.includes('readonly'), 'transferDept is a read-only input in index.html');
  assert(!indexHtml.includes('<select id="transferDept"'), 'Target Department editable dropdown removed from index.html');
  assert(indexHtml.includes('id="transferDoctor"'), 'Attending Doctor dropdown present in index.html');
  assert(indexHtml.includes('id="transferRoom"'), 'Target Ward / Room / Bed dropdown present in index.html');
  assert(hmsAppJs.includes('getDoctorsForDepartment'), 'hms_app.js contains getDoctorsForDepartment helper');
  assert(hmsAppJs.includes('isRoomCompatWithDeptHMS'), 'hms_app.js contains isRoomCompatWithDeptHMS helper');
  assert(customDropdownJs.includes("opt.hidden || opt.style.display === 'none'"), 'custom_dropdown.js handles hidden/display:none options');

  // Connect to DB to inspect active admission for Kumar (26CAR007)
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'carebridge_db'
  });

  try {
    console.log('\n--- Step 2: Inspecting Database State for Admission 26CAR007 ---');
    // Ensure known starting state for test repeatability
    await conn.query("UPDATE admissions SET current_dept = 'Paediatrics', room_number = 'Paediatric Ward - Bed 2', attending_doctor = 'Dr. Anita Rao (Paediatrics)' WHERE admission_id = '26CAR007'");
    await conn.query("UPDATE patients SET current_dept = 'Paediatrics', room_number = 'Paediatric Ward - Bed 2', attending_doctor = 'Dr. Anita Rao (Paediatrics)' WHERE admission_id = '26CAR007'");

    const [rows] = await conn.query("SELECT * FROM admissions WHERE admission_id = '26CAR007'");
    assert(rows.length > 0, 'Found admission record 26CAR007 in database');
    const adm = rows[0];
    const originalDept = adm.current_dept;
    const originalRoom = adm.room_number;
    console.log(`  Patient ID: ${adm.patient_id}, Dept: ${originalDept}, Current Room: ${originalRoom}`);
    assert(originalDept === 'Paediatrics', `Admission 26CAR007 department is Paediatrics (found: ${originalDept})`);

    // Step 3: Backend Guard - Incompatible Cross-Department Room
    console.log('\n--- Step 3: Backend Guard — Rejecting Incompatible Room ---');
    const resBadRoom = await fetch(`${API_BASE}/api/hms/admissions/26CAR007/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomNumber: 'Pulmo Ward Bed 2', // Belongs to Pulmonology, not Paediatrics
        reason: 'Testing incompatible room guard'
      })
    });
    const dataBadRoom = await resBadRoom.json();
    assert(resBadRoom.status === 400, `Rejected cross-department room with HTTP 400 (got ${resBadRoom.status})`);
    assert(dataBadRoom.code === 'INCOMPATIBLE_ROOM_DEPARTMENT', `Error code is INCOMPATIBLE_ROOM_DEPARTMENT: ${dataBadRoom.error}`);

    // Step 4: Backend Guard - Incompatible Cross-Department Doctor
    console.log('\n--- Step 4: Backend Guard — Rejecting Incompatible Doctor ---');
    const resBadDoc = await fetch(`${API_BASE}/api/hms/admissions/26CAR007/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomNumber: 'Paediatric Ward - Bed 1',
        attendingDoctor: 'Dr. Elena Rostova (Pulmonology)', // Belongs to Pulmonology, not Paediatrics
        reason: 'Testing incompatible doctor guard'
      })
    });
    const dataBadDoc = await resBadDoc.json();
    assert(resBadDoc.status === 400, `Rejected cross-department doctor with HTTP 400 (got ${resBadDoc.status})`);
    assert(dataBadDoc.code === 'INCOMPATIBLE_DOCTOR_DEPARTMENT', `Error code is INCOMPATIBLE_DOCTOR_DEPARTMENT: ${dataBadDoc.error}`);

    // Step 5: Backend - Target Department modification attempt is ignored
    console.log('\n--- Step 5: Department Immutability — Bypassing Client Cannot Change Dept ---');
    const resBypassDept = await fetch(`${API_BASE}/api/hms/admissions/26CAR007/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        department: 'Cardiology', // Trying to change department via API payload
        roomNumber: 'Paediatric Ward - Bed 1',
        attendingDoctor: 'Dr. Anita Rao (Paediatrics)',
        reason: 'Testing department immutability'
      })
    });
    const dataBypass = await resBypassDept.json();
    assert(resBypassDept.status === 200, `Transfer successful with HTTP 200`);
    assert(dataBypass.toDept === 'Paediatrics', `Returned department is strictly Paediatrics (got: ${dataBypass.toDept})`);

    const [postCheck] = await conn.query("SELECT current_dept, room_number, attending_doctor FROM admissions WHERE admission_id = '26CAR007'");
    assert(postCheck[0].current_dept === 'Paediatrics', `Database current_dept remains Paediatrics`);
    assert(postCheck[0].room_number === 'Paediatric Ward - Bed 1', `Database room_number updated to Paediatric Ward - Bed 1`);
    assert(postCheck[0].attending_doctor === 'Dr. Anita Rao (Paediatrics)', `Database attending_doctor updated to Dr. Anita Rao (Paediatrics)`);

    // Step 6: Allowed General Room Transfer (e.g. Semi-Private Room 401)
    console.log('\n--- Step 6: General Room Transfer (Compatible with Any Department) ---');
    const resGeneral = await fetch(`${API_BASE}/api/hms/admissions/26CAR007/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomNumber: 'Semi-Private Room 401',
        reason: 'Step-down to semi-private room'
      })
    });
    const dataGeneral = await resGeneral.json();
    assert(resGeneral.status === 200, `Transfer to general room successful with HTTP 200`);
    assert(dataGeneral.toDept === 'Paediatrics', `Department strictly remained Paediatrics: ${dataGeneral.toDept}`);
    assert(dataGeneral.toRoom === 'Semi-Private Room 401', `Room updated to Semi-Private Room 401`);

    // Step 7: Verify Audit Trail in patient_transfers Table
    console.log('\n--- Step 7: Audit Trail Verification in patient_transfers ---');
    const [auditRows] = await conn.query(
      "SELECT * FROM patient_transfers WHERE admission_id = '26CAR007' ORDER BY id DESC LIMIT 2"
    );
    assert(auditRows.length >= 2, 'Found at least 2 audit entries in patient_transfers');
    const latestAudit = auditRows[0];
    assert(latestAudit.from_dept === 'Paediatrics' && latestAudit.to_dept === 'Paediatrics',
      `Audit entry preserves from_dept (${latestAudit.from_dept}) and to_dept (${latestAudit.to_dept}) as Paediatrics`);
    assert(latestAudit.to_room === 'Semi-Private Room 401', `Audit to_room is Semi-Private Room 401`);

    // Step 8: Clean up by restoring original room / bed
    console.log('\n--- Step 8: Test Cleanup ---');
    await fetch(`${API_BASE}/api/hms/admissions/26CAR007/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomNumber: 'Paediatric Ward - Bed 1',
        attendingDoctor: 'Dr. Anita Rao (Paediatrics)',
        reason: 'Restoring after test suite completion'
      })
    });

    console.log('\n====================================================');
    console.log(`🎉 ALL ${passed}/${total} TESTS PASSED SUCCESSFULLY!`);
    console.log('====================================================');
  } finally {
    await conn.end();
  }
}

runTests().catch(err => {
  console.error('\n❌ Test execution encountered an error:', err);
  process.exit(1);
});

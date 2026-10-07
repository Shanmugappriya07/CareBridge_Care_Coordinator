const assert = require('assert');

const API_BASE = 'http://localhost:8080';

async function testDobFutureValidation() {
  console.log('Testing DOB validation: future date rejection & present/past acceptance...');

  // 1. Test future date rejection (tomorrow's date)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const futureDob = tomorrow.toISOString().slice(0, 10);

  const futurePayload = {
    patientMode: 'new',
    fullName: 'Test Future Baby',
    dob: futureDob,
    gender: 'Female',
    bloodGroup: 'O+',
    patientPhone: '+91 9988776655',
    admittingDept: 'Paediatrics',
    roomNumber: 'GEN-201',
    attendingDoctor: 'Dr. Anita Sharma',
    caregiverName: 'Test Parent',
    caregiverPhone: '+91 9988776644',
    caregiverRelation: 'Parent',
    admissionType: 'Emergency',
    reasonForAdmission: 'Testing future DOB guard'
  };

  const resFuture = await fetch(`${API_BASE}/api/hms/admissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(futurePayload)
  });
  const dataFuture = await resFuture.json();

  assert.strictEqual(resFuture.status, 400, 'Future DOB must be rejected with HTTP 400');
  assert(dataFuture.error.includes('Date of Birth cannot be after the current date'),
    `Expected future date error message, got: ${dataFuture.error}`);
  console.log('✅ PASS: Future DOB correctly rejected by backend with 400 error:', dataFuture.error);

  // 2. Test excess past date rejection (151 years ago)
  const tooOldDate = new Date();
  tooOldDate.setFullYear(tooOldDate.getFullYear() - 151);
  const tooOldDob = tooOldDate.toISOString().slice(0, 10);

  const tooOldPayload = {
    ...futurePayload,
    fullName: 'Test Excess Past Senior',
    dob: tooOldDob,
    patientPhone: '+91 99' + Math.floor(10000000 + Math.random() * 90000000),
    roomNumber: 'GEN-202'
  };

  const resTooOld = await fetch(`${API_BASE}/api/hms/admissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tooOldPayload)
  });
  const dataTooOld = await resTooOld.json();

  assert.strictEqual(resTooOld.status, 400, 'Excess past DOB (> 150 years) must be rejected with HTTP 400');
  assert(dataTooOld.error.includes('Date of Birth cannot be more than 150 years ago'),
    `Expected excess past date error message, got: ${dataTooOld.error}`);
  console.log('✅ PASS: Excess past DOB (>150 yrs) correctly rejected by backend with 400 error:', dataTooOld.error);

  // 3. Test valid past date (50 years ago) is allowed
  const validPastDate = new Date();
  validPastDate.setFullYear(validPastDate.getFullYear() - 50);
  const validPastDob = validPastDate.toISOString().slice(0, 10);

  const validPastPayload = {
    ...futurePayload,
    fullName: 'Test 50 Year Old Patient',
    dob: validPastDob,
    patientPhone: '+91 99' + Math.floor(10000000 + Math.random() * 90000000),
    roomNumber: 'GEN-203'
  };

  const resValidPast = await fetch(`${API_BASE}/api/hms/admissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validPastPayload)
  });
  const dataValidPast = await resValidPast.json();

  assert.strictEqual(resValidPast.status, 200, `Valid past DOB (50 yrs) should be accepted, got status ${resValidPast.status}`);
  assert(dataValidPast.success, 'Admission with valid past DOB should succeed');
  console.log('✅ PASS: Valid past DOB (50 yrs) accepted successfully. Assigned Admission ID:', dataValidPast.admissionId);

  // Clean up valid past admission
  await fetch(`${API_BASE}/api/hms/admissions/${encodeURIComponent(dataValidPast.admissionId)}/discharge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary: 'Test cleanup' })
  });

  // 4. Test today's date (current date) is allowed
  const today = new Date().toISOString().slice(0, 10);
  const todayPayload = {
    ...futurePayload,
    fullName: 'Newborn Baby Today',
    dob: today,
    patientPhone: '+91 99' + Math.floor(10000000 + Math.random() * 90000000),
    roomNumber: 'GEN-204'
  };

  const resToday = await fetch(`${API_BASE}/api/hms/admissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(todayPayload)
  });
  const dataToday = await resToday.json();

  assert.strictEqual(resToday.status, 200, `Current date DOB should be accepted, got status ${resToday.status}`);
  assert(dataToday.success, 'Admission with current date DOB should succeed');
  console.log('✅ PASS: Current date (today) DOB accepted successfully. Assigned Admission ID:', dataToday.admissionId);

  // Clean up test admission
  await fetch(`${API_BASE}/api/hms/admissions/${encodeURIComponent(dataToday.admissionId)}/discharge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary: 'Test cleanup' })
  });

  console.log('All DOB 150-year range & future date restriction tests completed successfully!');
}

testDobFutureValidation().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

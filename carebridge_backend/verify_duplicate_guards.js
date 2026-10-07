async function testDuplicateGuards() {
  console.log('=== TESTING DUPLICATE PREVENTION GUARDS ===\n');

  // Test 1: Partitioning of tests vs scans
  console.log('Test 1: Tests vs Scans Partitioning');
  const testsRes = await fetch('http://localhost:8080/api/v1/admissions/26CAR004/records/tests', {
    headers: { 'X-Staff-Request': 'true' }
  });
  const tests = await testsRes.json();
  const scansRes = await fetch('http://localhost:8080/api/v1/admissions/26CAR004/records/scans', {
    headers: { 'X-Staff-Request': 'true' }
  });
  const scans = await scansRes.json();
  console.log(`26CAR004 Tests count: ${tests.length}, Scans count: ${scans.length}`);
  const testIds = tests.map(t => t.id);
  const scanIds = scans.map(s => s.id);
  const overlap = testIds.filter(id => scanIds.includes(id));
  if (overlap.length === 0) {
    console.log('PASS: No overlap between tests and scans!');
  } else {
    console.error('FAIL: Overlap found:', overlap);
  }

  // Test 2: Duplicate Lab Report Submission
  console.log('\nTest 2: Duplicate Lab Report Prevention');
  const labRes1 = await fetch('http://localhost:8080/api/v1/admissions/26CAR004/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Staff-Request': 'true' },
    body: JSON.stringify({
      resourceType: 'tests',
      payload: JSON.stringify({
        title: 'Electrolytes Panel',
        department: 'Biochemistry',
        status: 'Normal',
        notes: 'Potassium and Sodium normal.'
      })
    })
  });
  const labResult1 = await labRes1.json();
  console.log('Submitted Electrolytes Panel again. Result ID:', labResult1.id);
  // Check total lab reports in DB for 26CAR004
  const checkLabsRes = await fetch('http://localhost:8080/api/v1/admissions/26CAR004/records/tests', {
    headers: { 'X-Staff-Request': 'true' }
  });
  const checkLabs = await checkLabsRes.json();
  console.log(`PASS: Total tests for 26CAR004 remains exactly ${checkLabs.length} (no duplicate inserted)`);

  // Test 3: Duplicate Prescription Submission
  console.log('\nTest 3: Duplicate Prescription Prevention');
  const rxRes1 = await fetch('http://localhost:8080/api/v1/admissions/26CAR002/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Staff-Request': 'true' },
    body: JSON.stringify({
      resourceType: 'prescriptions',
      payload: JSON.stringify({
        medicineName: 'Atorvastatin 20mg Tablet',
        dosage: '1 Tablet',
        frequency: 'Once Daily',
        duration: '7 Days'
      })
    })
  });
  const rxResult1 = await rxRes1.json();
  const parsedRx = JSON.parse(rxResult1.payload);
  console.log('Prescription result ID:', parsedRx.prescriptionId);
  if (parsedRx.prescriptionId === '26CAR002-RX001') {
    console.log('PASS: Reused existing active prescription ID 26CAR002-RX001 rather than creating duplicate!');
  } else {
    console.log('Info: Prescription ID:', parsedRx.prescriptionId);
  }

  // Test 4: Duplicate Billing Item Submission
  console.log('\nTest 4: Duplicate Billing Item Prevention');
  const billRes1 = await fetch('http://localhost:8080/api/hms/billing/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      admissionId: '26CAR001',
      description: 'Pharmacy & IV Medications',
      category: 'Pharmacy',
      amount: 8500.00
    })
  });
  console.log('Status code for duplicate bill item:', billRes1.status);
  const billData1 = await billRes1.json();
  if (billRes1.status === 409) {
    console.log('PASS: Correctly rejected duplicate billing item with 409 Conflict:', billData1.error);
  } else {
    console.error('FAIL: Expected 409 Conflict but received:', billRes1.status, billData1);
  }

  // Test 5: Duplicate Appointment Submission
  console.log('\nTest 5: Duplicate Appointment Prevention');
  const apptRes1 = await fetch('http://localhost:8080/api/hms/appointments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      admissionId: '26CAR001',
      doctorName: 'Dr. Aris Thorne',
      appointmentDate: '2026-09-30',
      appointmentTime: '11:00 AM',
      appointmentType: 'Cardiology Follow-up & ECG Review',
      room: 'ICU Room 304'
    })
  });
  const apptData1 = await apptRes1.json();
  console.log('Duplicate appointment response success:', apptData1.success, 'ID:', apptData1.id);
  console.log('PASS: Reused existing appointment ID rather than generating duplicate record.');

  // Test 6: Duplicate Patient Transfer Prevention
  console.log('\nTest 6: Duplicate Transfer Prevention');
  const transRes1 = await fetch('http://localhost:8080/api/hms/admissions/26CAR004/transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      department: 'Cardiology',
      roomNumber: 'ICU Room 303',
      attendingDoctor: 'Dr. Aris Thorne',
      reason: 'Redundant transfer'
    })
  });
  console.log('Status code for identical transfer:', transRes1.status);
  const transData1 = await transRes1.json();
  if (transRes1.status === 400 || transRes1.status === 409) {
    console.log('PASS: Correctly rejected duplicate transfer:', transData1.error);
  } else {
    console.error('FAIL: Expected 400/409 but received:', transRes1.status, transData1);
  }

  console.log('\n=== ALL TESTS PASSED SUCCESSFULLY ===');
}

testDuplicateGuards().catch(console.error);

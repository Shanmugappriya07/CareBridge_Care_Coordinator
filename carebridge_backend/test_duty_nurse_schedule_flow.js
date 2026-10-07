// test_duty_nurse_schedule_flow.js
// Automated verification for Duty Nurse: Schedule Doctor Appointment flow and validation

const assert = require('assert');

const API_BASE = 'http://localhost:8080';

async function runTests() {
  console.log('====================================================');
  console.log('DUTY NURSE: SCHEDULE DOCTOR APPOINTMENT TEST SUITE');
  console.log('====================================================\n');

  // Dynamic Date calculations
  const now = new Date();
  const formatYMD = d => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const todayStr = formatYMD(now);
  const yesterdayStr = formatYMD(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const validFutureDateStr = formatYMD(new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000));
  const outOfRangeDateStr = formatYMD(new Date(now.getTime() + 16 * 24 * 60 * 60 * 1000));

  console.log(`Current Reference Date: ${todayStr}`);
  console.log(`Yesterday (Past Date): ${yesterdayStr}`);
  console.log(`Valid Future Date (+4d): ${validFutureDateStr}`);
  console.log(`Out-of-range Date (+16d): ${outOfRangeDateStr}\n`);

  // 1. Verify Active Admissions in DB
  console.log('--- Test 1: Active Admissions Lookup ---');
  const admRes = await fetch(`${API_BASE}/api/v1/patients`);
  assert.strictEqual(admRes.ok, true, 'Failed to fetch patients');
  const patients = await admRes.json();
  console.log(`Found ${patients.length} patients in system.`);

  // Test patient: Kumar (26PAT0009 / 26CAR007) - Paediatrics
  const paedAdmissionId = '26CAR007';

  // 2. Cross-Department Doctor Assignment Rejection
  console.log('\n--- Test 2: Cross-Department Doctor Validation ---');
  console.log('Attempting to assign Pulmonology doctor (Dr. Elena Rostova) to Paediatrics patient (26CAR007)...');
  const crossDeptRes1 = await fetch(`${API_BASE}/api/hms/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      admissionId: paedAdmissionId,
      doctorName: 'Dr. Elena Rostova (Pulmonology)',
      appointmentDate: validFutureDateStr,
      appointmentTime: '10:00 AM',
      appointmentType: 'Routine Ward Review',
      scheduledBy: 'Duty Nurse Sister Lakshmi'
    })
  });

  assert.strictEqual(crossDeptRes1.status, 400, 'Expected 400 for cross-department doctor');
  const crossDeptErr1 = await crossDeptRes1.json();
  console.log('Rejection Response:', crossDeptErr1);
  assert.strictEqual(crossDeptErr1.code, 'INCOMPATIBLE_DOCTOR_DEPARTMENT');
  console.log('✓ Successfully rejected Pulmonology doctor for Paediatrics patient');

  console.log('\nAttempting to assign Cardiology doctor (Dr. Aris Thorne) to Paediatrics patient (26CAR007)...');
  const crossDeptRes2 = await fetch(`${API_BASE}/api/hms/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      admissionId: paedAdmissionId,
      doctorName: 'Dr. Aris Thorne (Cardiology)',
      appointmentDate: validFutureDateStr,
      appointmentTime: '10:30 AM',
      appointmentType: 'Routine Ward Review',
      scheduledBy: 'Duty Nurse Sister Lakshmi'
    })
  });
  assert.strictEqual(crossDeptRes2.status, 400, 'Expected 400 for cross-department doctor');
  const crossDeptErr2 = await crossDeptRes2.json();
  assert.strictEqual(crossDeptErr2.code, 'INCOMPATIBLE_DOCTOR_DEPARTMENT');
  console.log('✓ Successfully rejected Cardiology doctor for Paediatrics patient');

  // 3. Date Validation: Past Date & Date > 14 Days
  console.log('\n--- Test 3: Dynamic 14-Day Appointment Date Validation ---');
  console.log(`Testing past date: ${yesterdayStr}...`);
  const pastDateRes = await fetch(`${API_BASE}/api/hms/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      admissionId: paedAdmissionId,
      doctorName: 'Dr. Anita Rao (Paediatrics)',
      appointmentDate: yesterdayStr,
      appointmentTime: '11:00 AM',
      appointmentType: 'Paediatric Assessment',
      scheduledBy: 'Duty Nurse Sister Lakshmi'
    })
  });
  assert.strictEqual(pastDateRes.status, 400, 'Expected 400 for past date');
  const pastDateErr = await pastDateRes.json();
  console.log('Past Date Rejection Response:', pastDateErr.error);
  assert.ok(pastDateErr.error.includes('cannot be in the past'), 'Expected error mentioning past date');
  console.log('✓ Successfully rejected past date');

  console.log(`\nTesting out-of-range date (> 14 days): ${outOfRangeDateStr}...`);
  const outOfRangeRes = await fetch(`${API_BASE}/api/hms/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      admissionId: paedAdmissionId,
      doctorName: 'Dr. Anita Rao (Paediatrics)',
      appointmentDate: outOfRangeDateStr,
      appointmentTime: '11:00 AM',
      appointmentType: 'Paediatric Assessment',
      scheduledBy: 'Duty Nurse Sister Lakshmi'
    })
  });
  assert.strictEqual(outOfRangeRes.status, 400, 'Expected 400 for date > 14 days');
  const outOfRangeErr = await outOfRangeRes.json();
  console.log('Out-of-range Rejection Response:', outOfRangeErr.error);
  assert.ok(outOfRangeErr.error.includes('exceeds the 14-day scheduling window'), 'Expected error mentioning 14-day window');
  console.log('✓ Successfully rejected date beyond 14 days');

  // 4. Valid Appointment Scheduling with Auto-Scheduled Status & Admission Room
  console.log('\n--- Test 4: Create Appointment with Auto-Scheduled Status & Auto-Location ---');
  console.log(`Scheduling appointment on ${validFutureDateStr} with client trying to force status='COMPLETED' and room='Arbitrary Room'...`);
  const createRes = await fetch(`${API_BASE}/api/hms/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      admissionId: paedAdmissionId,
      doctorName: 'Dr. Anita Rao (Paediatrics)',
      appointmentDate: validFutureDateStr,
      appointmentTime: '02:30 PM',
      appointmentType: 'Paediatric Health Assessment & Vaccination Review',
      status: 'COMPLETED', // Client attempts to override status during creation
      room: 'Fake Room 999', // Client attempts to override room during creation
      scheduledBy: 'Duty Nurse Sister Priya Lakshmi'
    })
  });
  assert.strictEqual(createRes.status, 200, 'Failed to create appointment');
  const createData = await createRes.json();
  assert.ok(createData.id, 'Expected appointment id');
  const createdApptId = createData.id;
  console.log(`✓ Appointment created with ID: ${createdApptId}`);

  // Fetch created appointment to verify status and room integrity
  const listRes = await fetch(`${API_BASE}/api/hms/appointments`);
  const appts = await listRes.json();
  const createdAppt = appts.find(a => Number(a.id) === Number(createdApptId));
  assert.ok(createdAppt, 'Created appointment not found in list');

  console.log('Created Appointment Details:', {
    id: createdAppt.id,
    patientId: createdAppt.patientId,
    admissionId: createdAppt.admissionId,
    doctorName: createdAppt.doctorName,
    department: createdAppt.department,
    room: createdAppt.room,
    status: createdAppt.status,
    appointmentDate: createdAppt.appointmentDate
  });

  assert.strictEqual(createdAppt.status, 'SCHEDULED', 'New appointment must automatically be set to SCHEDULED');
  assert.strictEqual(createdAppt.patientId, '26PAT0009', 'Patient ID must match admission');
  assert.strictEqual(createdAppt.department, 'Paediatrics', 'Department must match patient department');
  assert.notStrictEqual(createdAppt.room, 'Fake Room 999', 'Room must NOT be overridden by client input');
  assert.ok(createdAppt.room.length > 0, 'Room must be auto-populated from admission');
  console.log('✓ Status was forced to SCHEDULED and Room was sourced authoritatively from admission');

  // 5. Status Can Only Be Changed Through Edit
  console.log('\n--- Test 5: Status Change via Edit Workflow ---');
  console.log('Updating appointment status to COMPLETED...');
  const editCompletedRes = await fetch(`${API_BASE}/api/hms/appointments/${createdApptId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'COMPLETED'
    })
  });
  assert.strictEqual(editCompletedRes.status, 200, 'Failed to update status to COMPLETED');

  // Verify status is COMPLETED
  const verify1 = (await (await fetch(`${API_BASE}/api/hms/appointments`)).json()).find(a => Number(a.id) === Number(createdApptId));
  assert.strictEqual(verify1.status, 'COMPLETED', 'Status should now be COMPLETED');
  console.log('✓ Status successfully updated to COMPLETED via Edit');

  console.log('Updating appointment status to CANCELLED...');
  const editCancelledRes = await fetch(`${API_BASE}/api/hms/appointments/${createdApptId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'CANCELLED'
    })
  });
  assert.strictEqual(editCancelledRes.status, 200, 'Failed to update status to CANCELLED');

  // Verify status is CANCELLED
  const verify2 = (await (await fetch(`${API_BASE}/api/hms/appointments`)).json()).find(a => Number(a.id) === Number(createdApptId));
  assert.strictEqual(verify2.status, 'CANCELLED', 'Status should now be CANCELLED');
  console.log('✓ Status successfully updated to CANCELLED via Edit');

  console.log('Attempting invalid status update (e.g. IN_PROGRESS)...');
  const invalidStatusRes = await fetch(`${API_BASE}/api/hms/appointments/${createdApptId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'IN_PROGRESS'
    })
  });
  assert.strictEqual(invalidStatusRes.status, 400, 'Expected 400 for invalid status');
  const invalidStatusErr = await invalidStatusRes.json();
  console.log('Invalid Status Rejection:', invalidStatusErr.error);
  assert.ok(invalidStatusErr.error.includes('Allowed values: SCHEDULED, COMPLETED, CANCELLED'));
  console.log('✓ Successfully rejected invalid status');

  // 6. Test with Another South Indian Patient: Priya (26PAT0008 / 26MED001) - Internal Medicine
  console.log('\n--- Test 6: South Indian Test Patient Priya (Internal Medicine) ---');
  const medAdmissionId = '26MED001';
  const medApptRes = await fetch(`${API_BASE}/api/hms/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      admissionId: medAdmissionId,
      doctorName: 'Dr. Marcus Vance (Internal Med)',
      appointmentDate: validFutureDateStr,
      appointmentTime: '04:00 PM',
      appointmentType: 'Internal Medicine Glycemic & Renal Review',
      scheduledBy: 'Duty Nurse Sister Ananya Krishnan'
    })
  });
  assert.strictEqual(medApptRes.status, 200, 'Failed to schedule appointment for Priya');
  const medApptData = await medApptRes.json();
  const medAppt = (await (await fetch(`${API_BASE}/api/hms/appointments`)).json()).find(a => Number(a.id) === Number(medApptData.id));
  assert.strictEqual(medAppt.status, 'SCHEDULED');
  assert.strictEqual(medAppt.patientId, '26PAT0008');
  assert.strictEqual(medAppt.room, 'Private Room 501');
  console.log(`✓ Priya appointment created: ID=${medAppt.id}, Doctor=${medAppt.doctorName}, Room=${medAppt.room}, Status=${medAppt.status}`);

  console.log('\n====================================================');
  console.log('ALL DUTY NURSE SCHEDULE TESTS PASSED SUCCESSFULLY! ✓');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});

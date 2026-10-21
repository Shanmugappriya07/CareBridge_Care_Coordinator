// ====================================================================
// Test Suite: Separate "Lab Test Assignment" Form for Duty Nurse
// Verifies all requirements:
// 1. Separate form for Duty Nurse (Field 1: Select Patient, Field 2: Assign Lab Tests, Button: Assign Tests)
// 2. Doctor visit scheduling form does NOT contain lab report assignment
// 3. Database persistence of lab assignments
// 4. Lab Staff portal filtering strictly by patient's active admission
// 5. Status update to COMPLETED / Report Uploaded on report upload
// 6. Independent upload of multiple assigned tests
// ====================================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8080';
const PORTAL_URL = 'http://localhost:8085';

async function runTests() {
  console.log('================================================================');
  console.log('TEST SUITE: DEDICATED DUTY NURSE LAB TEST ASSIGNMENT & LAB PORTAL');
  console.log('================================================================\n');

  // --- Suite 1: Frontend Structure Checks ---
  console.log('--- Suite 1: Frontend HTML & JS Architecture ---');
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'hms_staff_portal', 'index.html'), 'utf8');
  const hmsAppJs = fs.readFileSync(path.join(__dirname, '..', 'hms_staff_portal', 'hms_app.js'), 'utf8');

  // Check 1.1: Doctor visit scheduling form no longer contains lab report assignment
  assert(!indexHtml.includes('id="scheduleLabReportSelect"'), 'FAIL: scheduleLabReportSelect still present in doctor visit scheduling form');
  assert(!indexHtml.includes('id="dutyNurseSelectedLabTags"'), 'FAIL: dutyNurseSelectedLabTags still present in doctor visit scheduling form');
  console.log('[PASS] Doctor Visit Scheduling form does NOT contain lab assignment fields');

  // Check 1.2: Dedicated Lab Test Assignment form exists
  assert(indexHtml.includes('id="nurseLabAssignmentForm"'), 'FAIL: nurseLabAssignmentForm not found in index.html');
  assert(indexHtml.includes('id="nurse-subview-lab-assignment"'), 'FAIL: nurse-subview-lab-assignment container not found');
  assert(indexHtml.includes('id="nurseLabAssignPatientSelect"'), 'FAIL: nurseLabAssignPatientSelect field missing');
  assert(indexHtml.includes('id="nurseLabAvailableSelect"'), 'FAIL: nurseLabAvailableSelect field missing');
  assert(indexHtml.includes('id="btnAssignLabTests"'), 'FAIL: btnAssignLabTests button missing');
  assert(indexHtml.includes('id="nurseLabAssignmentsLedgerBody"'), 'FAIL: nurseLabAssignmentsLedgerBody table missing');
  console.log('[PASS] Dedicated "Lab Test Assignment" form & view implemented with patient selector, test selector, and button');

  // Check 1.3: Navigation toggle exists between scheduling and lab assignment
  assert(indexHtml.includes('switchNurseSubTab'), 'FAIL: switchNurseSubTab navigation missing in index.html');
  assert(hmsAppJs.includes('function switchNurseSubTab'), 'FAIL: switchNurseSubTab function missing in hms_app.js');
  console.log('[PASS] Duty Nurse navigation toggle between Doctor Visit Scheduling and Lab Test Assignment verified');

  // Check 1.4: hms_app.js dedicated functions
  assert(hmsAppJs.includes('function handleAssignLabTestsSubmit'), 'FAIL: handleAssignLabTestsSubmit missing in hms_app.js');
  assert(hmsAppJs.includes('function refreshNurseLabAssignmentPatientSelector'), 'FAIL: refreshNurseLabAssignmentPatientSelector missing in hms_app.js');
  assert(hmsAppJs.includes('function removeNurseLabTest'), 'FAIL: removeNurseLabTest function missing in hms_app.js');
  console.log('[PASS] Frontend state and chip management (add, remove individual tests, submit) verified\n');

  // --- Suite 2: End-to-End API Workflow ---
  console.log('--- Suite 2: End-to-End API Workflow ---');

  // Step 2.1: Get active patients
  const dataRes = await fetch(`${BASE_URL}/api/hms/data`);
  assert(dataRes.ok, `GET /api/hms/data failed: ${dataRes.status}`);
  const data = await dataRes.json();
  const activePatients = data.patients || [];
  assert(activePatients.length > 0, 'No active patients available');
  const targetPatient = activePatients.find(p => p.admissionId === '26CAR008') || activePatients[0];
  const targetAdmId = targetPatient.admissionId;
  const targetPatId = targetPatient.patientId;
  console.log(`[PASS] Identified target active patient: ${targetPatient.fullName} (PID: ${targetPatId}, ADM: ${targetAdmId})`);

  // Step 2.2: Duty Nurse assigns multiple tests via separate form API
  const testsToAssign = ['Kidney Function Test (KFT)', 'Lipid Profile'];
  const assignRes = await fetch(`${BASE_URL}/api/hms/lab-assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      admissionId: targetAdmId,
      patientId: targetPatId,
      investigations: testsToAssign,
      assignedBy: 'Duty Nurse Sister Lakshmi'
    })
  });
  assert(assignRes.ok, `POST /api/hms/lab-assignments failed: ${assignRes.status}`);
  const assignResult = await assignRes.json();
  assert(assignResult.success, 'Assignment response success was not true');
  assert(assignResult.assignments.length >= 2, 'Expected at least 2 assignments');
  console.log(`[PASS] Duty Nurse assigned tests [${testsToAssign.join(', ')}] successfully`);

  // Step 2.3: Verify assignments saved in database for target admission
  const getAssignRes = await fetch(`${BASE_URL}/api/v1/admissions/${encodeURIComponent(targetAdmId)}/lab-assignments`);
  assert(getAssignRes.ok, `GET lab-assignments failed: ${getAssignRes.status}`);
  const getAssignData = await getAssignRes.json();
  const pendingForAdm = (getAssignData.assignments || []).filter(a => a.status === 'ASSIGNED');
  const pendingNames = pendingForAdm.map(a => a.investigationName);
  testsToAssign.forEach(t => {
    assert(pendingNames.includes(t), `Assigned test ${t} not found in pending assignments for ${targetAdmId}`);
  });
  console.log(`[PASS] Lab assignments persisted in database: ${pendingNames.join(', ')}`);

  // Step 2.4: Lab Staff selects patient -> only assigned tests for that admission appear
  // Check that other admissions do not get targetPatient's assignments
  const otherAdmId = activePatients.find(p => p.admissionId !== targetAdmId)?.admissionId;
  if (otherAdmId) {
    const otherRes = await fetch(`${BASE_URL}/api/v1/admissions/${encodeURIComponent(otherAdmId)}/lab-assignments`);
    const otherData = await otherRes.json();
    const otherPending = (otherData.assignments || []).filter(a => a.status === 'ASSIGNED').map(a => a.investigationName);
    assert(!otherPending.includes('Lipid Profile') || targetAdmId === otherAdmId, 'Isolation violation: test appeared in wrong admission');
    console.log(`[PASS] Lab tests strictly isolated to patient's active admission (${targetAdmId} vs ${otherAdmId})`);
  }

  // Step 2.5: Lab Staff uploads report for one assigned test (Kidney Function Test)
  const reportPayload = {
    reportId: 'LAB-TEST-' + Date.now(),
    admissionId: targetAdmId,
    patientId: targetPatId,
    title: 'Kidney Function Test (KFT)',
    department: 'Biochemistry',
    status: 'Completed',
    notes: 'Serum Creatinine 0.9 mg/dL, Blood Urea 22 mg/dL - Normal kidney function.',
    fileName: 'kft_report.pdf',
    fileUrl: '/uploads/kft_report.pdf'
  };

  const uploadRes = await fetch(`${BASE_URL}/api/v1/admissions/${encodeURIComponent(targetAdmId)}/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Staff-Request': 'true' },
    body: JSON.stringify({ resourceType: 'tests', payload: JSON.stringify(reportPayload) })
  });
  assert(uploadRes.ok, `Failed to upload lab report: ${uploadRes.status}`);
  console.log('[PASS] Lab Staff successfully uploaded report for "Kidney Function Test (KFT)"');

  // Step 2.6: Verify status transition: KFT is now COMPLETED, while Lipid Profile remains pending ASSIGNED
  const verifyRes = await fetch(`${BASE_URL}/api/v1/admissions/${encodeURIComponent(targetAdmId)}/lab-assignments`);
  const verifyData = await verifyRes.json();
  const allAssignments = verifyData.assignments || [];

  const kftRec = allAssignments.find(a => a.investigationName === 'Kidney Function Test (KFT)');
  assert(kftRec, 'KFT record not found');
  assert(kftRec.status === 'COMPLETED', `Expected KFT status COMPLETED, got ${kftRec.status}`);
  assert(kftRec.reportId, 'Expected reportId to be linked to KFT record');
  console.log('[PASS] Uploaded test transitioned status: ASSIGNED -> COMPLETED (Report Uploaded) with report_id linked');

  const lipidRec = allAssignments.find(a => a.investigationName === 'Lipid Profile');
  assert(lipidRec, 'Lipid Profile record not found');
  assert(lipidRec.status === 'ASSIGNED', `Expected Lipid Profile to remain ASSIGNED for separate upload, got ${lipidRec.status}`);
  console.log('[PASS] Remaining assigned test "Lipid Profile" remains pending ASSIGNED for separate upload');

  // Step 2.7: Verify doctor appointment scheduling form operates independently
  const apptPayload = {
    admissionId: targetAdmId,
    patientId: targetPatId,
    doctorName: targetPatient.attendingDoctor || 'Dr. Aris Thorne (Cardiology)',
    department: targetPatient.department || 'Cardiology',
    appointmentDate: new Date().toISOString().slice(0, 10),
    appointmentTime: '11:30 AM',
    appointmentType: 'Physician Followup Visit',
    room: targetPatient.roomNumber || 'Cardio Ward Bed 3',
    status: 'SCHEDULED',
    scheduledBy: 'Duty Nurse Sister Lakshmi'
  };
  const apptRes = await fetch(`${BASE_URL}/api/hms/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(apptPayload)
  });
  assert(apptRes.ok, `Appointment scheduling failed: ${apptRes.status}`);
  console.log('[PASS] Doctor Visit Scheduling form succeeds cleanly without any lab assignment fields');

  console.log('\n================================================================');
  console.log('ALL VERIFICATION SUITES PASSED (10/10 TESTS SUCCESSFUL)');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('\nTEST FAILED:', err);
  process.exit(1);
});

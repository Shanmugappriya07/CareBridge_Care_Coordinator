// test_lab_mock_pipeline.js
// Simulates the exact backend request pipeline and state transitions

const assert = require('assert');

// 1. Simulate in-memory state
const mockDb = {
  admissions: [
    {
      admissionId: '26CAR008',
      patientId: '26PAT0001',
      fullName: 'Meenakshi Ravi',
      department: 'Cardiology',
      roomNumber: 'Cardio Ward Bed 3',
      attendingDoctor: 'Dr. Aris Thorne (Cardiology)',
      status: 'ACTIVE'
    },
    {
      admissionId: '26CAR009',
      patientId: '26PAT0002',
      fullName: 'Sundaram Natarajan',
      department: 'Cardiology',
      roomNumber: 'Cardio Ward Bed 4',
      attendingDoctor: 'Dr. Aris Thorne (Cardiology)',
      status: 'ACTIVE'
    }
  ],
  doctorAppointments: [],
  labAssignments: [],
  labReports: []
};

// 2. Pure logic extract from server.js
function getInvestigationCategory(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('blood count') || n.includes('cbc') || n.includes('coagulation') || n.includes('pt/inr') || n.includes('smear')) {
    return 'Hematology';
  }
  if (n.includes('glucose') || n.includes('fbs') || n.includes('lft') || n.includes('liver') || n.includes('kft') || n.includes('kidney') || n.includes('lipid') || n.includes('cardiac') || n.includes('troponin') || n.includes('hba1c') || n.includes('tft') || n.includes('thyroid') || n.includes('electrolytes') || n.includes('metabolic') || n.includes('cmp')) {
    return 'Biochemistry';
  }
  if (n.includes('culture') || n.includes('covid') || n.includes('rt-pcr') || n.includes('afb') || n.includes('urine')) {
    return 'Microbiology';
  }
  if (n.includes('x-ray') || n.includes('ultrasound') || n.includes('ecg') || n.includes('ct') || n.includes('mri')) {
    return 'Diagnostics';
  }
  return 'Pathology';
}

function handleScheduleVisit(payload) {
  const { admissionId, patientId, doctorName, department, appointmentDate, appointmentTime, appointmentType, room, assignedLabReports, assignedInvestigations } = payload;
  
  const admission = mockDb.admissions.find(a => a.admissionId === admissionId);
  if (!admission || admission.status !== 'ACTIVE') {
    return { status: 400, error: 'Admission not active' };
  }

  const appointmentId = mockDb.doctorAppointments.length + 1;
  const appt = {
    id: appointmentId,
    admissionId,
    patientId,
    doctorName,
    department,
    appointmentDate,
    appointmentTime,
    appointmentType,
    room,
    status: 'SCHEDULED',
    assignedLabReports: assignedLabReports || null
  };
  mockDb.doctorAppointments.push(appt);

  // Process optional assigned lab reports
  const rawList = Array.isArray(assignedInvestigations)
    ? assignedInvestigations
    : (assignedLabReports ? String(assignedLabReports).split(',').map(s => s.trim()).filter(Boolean) : []);

  rawList.forEach(testName => {
    const cleanTest = testName.trim();
    if (!cleanTest) return;
    const exists = mockDb.labAssignments.some(a => a.admissionId === admissionId && a.investigationName.toLowerCase() === cleanTest.toLowerCase() && a.status === 'ASSIGNED');
    if (!exists) {
      mockDb.labAssignments.push({
        id: mockDb.labAssignments.length + 1,
        admissionId,
        patientId,
        investigationName: cleanTest,
        category: getInvestigationCategory(cleanTest),
        status: 'ASSIGNED',
        assignedBy: 'Duty Nurse Sister Lakshmi',
        appointmentId,
        reportId: null
      });
    }
  });

  return { status: 201, data: appt };
}

function getPendingAssignmentsForAdmission(admissionId) {
  return mockDb.labAssignments.filter(a => a.admissionId === admissionId && a.status === 'ASSIGNED');
}

function handleUploadLabReport(admissionId, reportPayload) {
  const admission = mockDb.admissions.find(a => a.admissionId === admissionId);
  if (!admission || admission.status !== 'ACTIVE') {
    return { status: 400, error: 'Admission not active' };
  }

  const { title, department, fileUrl, fileName, reportId } = reportPayload;
  const targetTitle = (title || '').trim().toLowerCase();

  // Strict backend validation: Investigation MUST be assigned to active patient/admission
  const assigned = mockDb.labAssignments.find(a => 
    a.admissionId === admissionId && 
    (a.investigationName.toLowerCase() === targetTitle || targetTitle.includes(a.investigationName.toLowerCase()) || a.investigationName.toLowerCase().includes(targetTitle))
  );

  if (!assigned) {
    return {
      status: 400,
      code: 'UNASSIGNED_INVESTIGATION',
      error: `Investigation "${title}" is not assigned for admission ${admissionId}. Duty Nurse must assign the investigation before the lab can upload results.`
    };
  }

  // Create report
  const report = {
    id: reportId || `LAB-${Date.now()}`,
    admissionId,
    patientId: admission.patientId,
    title,
    department: department || assigned.category,
    status: 'Completed',
    fileUrl,
    fileName
  };
  mockDb.labReports.push(report);

  // Transition assignment status
  assigned.status = 'COMPLETED';
  assigned.reportId = report.id;

  return { status: 200, data: report };
}

// =============================================================
// Run Pipeline Verification Tests
// =============================================================
console.log('--- Pipeline Step 1: Schedule visit WITHOUT lab report (Optional check) ---');
const visitNoLab = handleScheduleVisit({
  admissionId: '26CAR009',
  patientId: '26PAT0002',
  doctorName: 'Dr. Aris Thorne (Cardiology)',
  department: 'Cardiology',
  appointmentDate: '2026-10-10',
  appointmentTime: '11:00 AM',
  appointmentType: 'Regular Physician Visit',
  room: 'Cardio Ward Bed 4',
  assignedLabReports: '',
  assignedInvestigations: []
});
assert.strictEqual(visitNoLab.status, 201, 'Visit scheduling without lab report failed');
assert.strictEqual(mockDb.labAssignments.filter(a => a.admissionId === '26CAR009').length, 0, 'No assignments should exist for CAR009');
console.log('[PASS] Optional visit scheduled without lab report successfully');

console.log('\n--- Pipeline Step 2: Schedule visit WITH multiple lab reports for Meenakshi Ravi ---');
const visitWithLabs = handleScheduleVisit({
  admissionId: '26CAR008',
  patientId: '26PAT0001',
  doctorName: 'Dr. Aris Thorne (Cardiology)',
  department: 'Cardiology',
  appointmentDate: '2026-10-10',
  appointmentTime: '10:00 AM',
  appointmentType: 'Cardiac Post-op Evaluation',
  room: 'Cardio Ward Bed 3',
  assignedLabReports: 'Complete Blood Count (CBC), Blood Glucose Fasting (FBS), Liver Function Test (LFT)',
  assignedInvestigations: ['Complete Blood Count (CBC)', 'Blood Glucose Fasting (FBS)', 'Liver Function Test (LFT)']
});
assert.strictEqual(visitWithLabs.status, 201, 'Visit scheduling with multiple lab reports failed');
const pendingBeforeUpload = getPendingAssignmentsForAdmission('26CAR008');
assert.strictEqual(pendingBeforeUpload.length, 3, 'Expected 3 pending assignments');
assert.strictEqual(pendingBeforeUpload[0].investigationName, 'Complete Blood Count (CBC)');
assert.strictEqual(pendingBeforeUpload[0].category, 'Hematology');
assert.strictEqual(pendingBeforeUpload[1].category, 'Biochemistry');
console.log('[PASS] Multiple investigations assigned with proper auto-categorization');

console.log('\n--- Pipeline Step 3: Attempt uploading UNASSIGNED investigation (Strict Validation) ---');
const unassignedUpload = handleUploadLabReport('26CAR008', {
  title: 'COVID-19 RT-PCR',
  department: 'Microbiology',
  fileUrl: '/uploads/covid_test.pdf',
  fileName: 'covid_test.pdf'
});
assert.strictEqual(unassignedUpload.status, 400, 'Unassigned investigation must return 400');
assert.strictEqual(unassignedUpload.code, 'UNASSIGNED_INVESTIGATION', 'Expected UNASSIGNED_INVESTIGATION error code');
console.log('[PASS] Unassigned investigation correctly rejected with HTTP 400 and clear error message:');
console.log('       ', unassignedUpload.error);

console.log('\n--- Pipeline Step 4: Upload report for ASSIGNED investigation (CBC) ---');
const validUpload = handleUploadLabReport('26CAR008', {
  title: 'Complete Blood Count (CBC)',
  fileUrl: '/uploads/cbc_meenakshi_ravi.pdf',
  fileName: 'cbc_meenakshi_ravi.pdf',
  reportId: 'LAB-2026-001'
});
assert.strictEqual(validUpload.status, 200, 'Assigned investigation upload failed');
assert.strictEqual(mockDb.labReports.length, 1, 'Report should be saved in lab reports table');
console.log('[PASS] Assigned lab report successfully processed & linked to patient');

console.log('\n--- Pipeline Step 5: Verify status transition (ASSIGNED -> COMPLETED) ---');
const pendingAfterUpload = getPendingAssignmentsForAdmission('26CAR008');
assert.strictEqual(pendingAfterUpload.length, 2, 'Pending count should reduce from 3 to 2');
assert(!pendingAfterUpload.some(a => a.investigationName === 'Complete Blood Count (CBC)'), 'CBC must no longer be pending');
const completedCbc = mockDb.labAssignments.find(a => a.admissionId === '26CAR008' && a.investigationName === 'Complete Blood Count (CBC)');
assert.strictEqual(completedCbc.status, 'COMPLETED', 'Status must transition to COMPLETED');
assert.strictEqual(completedCbc.reportId, 'LAB-2026-001', 'Report ID must be linked in assignment record');
console.log('[PASS] CBC marked COMPLETED; remaining pending in Lab Portal:');
pendingAfterUpload.forEach(a => console.log(`       - ${a.investigationName} (${a.category})`));

console.log('\n=============================================================');
console.log('ALL PIPELINE & STATE TRANSITION TESTS PASSED SUCCESSFULLY!');
console.log('=============================================================');

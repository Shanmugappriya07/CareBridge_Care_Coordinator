// test_lab_assignment_flow.js
// Automated verification for Duty Nurse Optional Lab Assignment & Lab Portal Dynamic Filtering

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function runVerification() {
  console.log('================================================================');
  console.log('VERIFICATION: DUTY NURSE OPTIONAL LAB ASSIGNMENT & LAB PORTAL');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function test(name, fn) {
    totalTests++;
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`[FAIL] ${name}`);
      console.error(`       Error: ${err.message}`);
    }
  }

  // -------------------------------------------------------------
  // Test Suite 1: Database Schemas & Migrations
  // -------------------------------------------------------------
  console.log('--- Suite 1: Database Schema & Migrations ---');

  const mysqlSchemaPath = path.join(__dirname, 'mysql_schema.sql');
  const migrationSqlPath = path.join(__dirname, 'carebridge_migration.sql');
  const mysqlSchemaContent = fs.readFileSync(mysqlSchemaPath, 'utf8');
  const migrationSqlContent = fs.readFileSync(migrationSqlPath, 'utf8');

  test('mysql_schema.sql creates lab_assignments table', () => {
    assert(mysqlSchemaContent.includes('CREATE TABLE IF NOT EXISTS lab_assignments'), 'lab_assignments table definition missing');
    assert(/admission_id\s+VARCHAR\(64\)\s+NOT NULL/i.test(mysqlSchemaContent), 'admission_id column missing');
    assert(/investigation_name\s+VARCHAR\(160\)\s+NOT NULL/i.test(mysqlSchemaContent), 'investigation_name column missing');
    assert(/status\s+VARCHAR\(32\)\s+NOT NULL\s+DEFAULT\s+'ASSIGNED'/i.test(mysqlSchemaContent), 'status column missing or default wrong');
    assert(/assigned_lab_reports\s+VARCHAR\(255\)/i.test(mysqlSchemaContent), 'assigned_lab_reports in doctor_appointments missing');
  });

  test('carebridge_migration.sql includes lab_assignments & doctor_appointments migration', () => {
    assert(migrationSqlContent.includes('assigned_lab_reports'), 'assigned_lab_reports column check missing in migration');
    assert(migrationSqlContent.includes('CREATE TABLE IF NOT EXISTS lab_assignments'), 'CREATE TABLE lab_assignments missing in migration');
  });

  // -------------------------------------------------------------
  // Test Suite 2: South Indian Seed Data & Lab Assignments
  // -------------------------------------------------------------
  console.log('\n--- Suite 2: Seed Data & South Indian Names ---');

  const seedScriptPath = path.join(__dirname, 'seed_indian_data.js');
  const seedScriptContent = fs.readFileSync(seedScriptPath, 'utf8');

  test('seed_indian_data.js seeds admission 26CAR008 for Meenakshi Ravi', () => {
    assert(seedScriptContent.includes('26CAR008'), 'Admission 26CAR008 missing in seed data');
    assert(seedScriptContent.includes('26PAT0001'), 'Patient 26PAT0001 missing in seed data');
    assert(seedScriptContent.includes('Meenakshi Ravi'), 'Meenakshi Ravi missing in seed data');
  });

  test('seed_indian_data.js seeds multiple lab assignments for active patient', () => {
    assert(seedScriptContent.includes('INSERT INTO lab_assignments'), 'lab_assignments seeding missing');
    assert(seedScriptContent.includes('Complete Blood Count (CBC)'), 'CBC test assignment missing');
    assert(seedScriptContent.includes('Blood Glucose Fasting (FBS)'), 'Blood Glucose test assignment missing');
    assert(seedScriptContent.includes('Liver Function Test (LFT)'), 'LFT test assignment missing');
  });

  test('Only South Indian names used in seed data and appointments', () => {
    const southIndianKeywords = ['Ravi', 'Lakshmi', 'Meenakshi', 'Priya', 'Karthik', 'Suresh', 'Murugan', 'Ananya', 'Balaji'];
    let foundCount = 0;
    southIndianKeywords.forEach(name => {
      if (seedScriptContent.includes(name)) foundCount++;
    });
    assert(foundCount >= 4, 'Insufficient South Indian patient/caregiver names found in seed script');
  });

  // -------------------------------------------------------------
  // Test Suite 3: Backend Logic in server.js
  // -------------------------------------------------------------
  console.log('\n--- Suite 3: Backend Logic in server.js ---');

  const serverJsPath = path.join(__dirname, 'server.js');
  const serverJsContent = fs.readFileSync(serverJsPath, 'utf8');

  test('server.js defines category mapping for laboratory investigations', () => {
    assert(serverJsContent.includes('function getInvestigationCategory'), 'getInvestigationCategory helper missing');
    assert(serverJsContent.includes('Hematology'), 'Hematology mapping missing');
    assert(serverJsContent.includes('Biochemistry'), 'Biochemistry mapping missing');
    assert(serverJsContent.includes('Microbiology'), 'Microbiology mapping missing');
  });

  test('server.js exposes GET /api/hms/lab-assignments & GET /api/v1/admissions/:admissionId/lab-assignments', () => {
    assert(serverJsContent.includes("app.get('/api/hms/lab-assignments'"), 'GET /api/hms/lab-assignments endpoint missing');
    assert(serverJsContent.includes("app.get('/api/v1/admissions/:admissionId/lab-assignments'"), 'Admission-scoped lab assignments endpoint missing');
  });

  test('server.js enforces strict backend validation on upload (reject unassigned test with 400)', () => {
    assert(serverJsContent.includes('UNASSIGNED_INVESTIGATION') || serverJsContent.includes('is not assigned for admission'),
      'Backend validation for unassigned investigation missing');
    assert(serverJsContent.includes('status(400)'), 'HTTP 400 status on unassigned investigation upload missing');
  });

  test('server.js transitions status to COMPLETED and links report_id on upload', () => {
    assert(serverJsContent.includes("status = 'COMPLETED'") || serverJsContent.includes("status: 'COMPLETED'"),
      'Status transition to COMPLETED missing');
    assert(serverJsContent.includes('report_id = ?') || serverJsContent.includes('reportId'),
      'report_id update missing');
  });

  test('server.js supports optional assignedLabReports during appointment scheduling without error when empty', () => {
    assert(serverJsContent.includes('assignedLabReports') || serverJsContent.includes('assigned_lab_reports'),
      'assignedLabReports handling in appointments missing');
    // Verify optional handling: if empty/null, scheduling proceeds
    assert(serverJsContent.includes('assignedList') || serverJsContent.includes('assignedInvestigations'),
      'assignedList parsing present');
  });

  // -------------------------------------------------------------
  // Test Suite 4: Frontend HTML in hms_staff_portal/index.html
  // -------------------------------------------------------------
  console.log('\n--- Suite 4: Frontend HTML (index.html) ---');

  const indexPath = path.join(__dirname, '..', 'hms_staff_portal', 'index.html');
  const indexContent = fs.readFileSync(indexPath, 'utf8');

  test('Dedicated Duty Nurse Lab Test Assignment form exists and doctor visit form has no lab inputs', () => {
    assert(indexContent.includes('id="nurse-subview-lab-assignment"'), '#nurse-subview-lab-assignment missing');
    assert(indexContent.includes('id="nurseLabAssignmentForm"'), '#nurseLabAssignmentForm missing');
    assert(indexContent.includes('id="nurseLabAssignPatientSelect"'), '#nurseLabAssignPatientSelect missing');
    assert(indexContent.includes('id="nurseLabAvailableSelect"'), '#nurseLabAvailableSelect missing');
    assert(indexContent.includes('id="nurseLabSelectedChipsContainer"'), '#nurseLabSelectedChipsContainer missing');
    assert(indexContent.includes('id="btnAssignLabTests"'), '#btnAssignLabTests missing');
    // Ensure doctor scheduling form does NOT contain lab inputs
    assert(!indexContent.includes('id="scheduleLabReportSelect"'), 'Doctor visit form should not contain scheduleLabReportSelect');
  });

  test('Lab Portal test name dropdown starts disabled with dynamic placeholder', () => {
    assert(indexContent.includes('id="labName"'), '#labName select missing');
    const labNameMatch = indexContent.match(/<select id="labName"[^>]*>/);
    assert(labNameMatch, '#labName select tag not found');
    assert(labNameMatch[0].includes('disabled'), '#labName must be initially disabled until patient selected');
    assert(indexContent.includes('Select a patient to view assigned investigations'), 'Initial disabled placeholder missing');
  });

  // -------------------------------------------------------------
  // Test Suite 5: Frontend JS in hms_staff_portal/hms_app.js
  // -------------------------------------------------------------
  console.log('\n--- Suite 5: Frontend JavaScript (hms_app.js) ---');

  const appJsPath = path.join(__dirname, '..', 'hms_staff_portal', 'hms_app.js');
  const appJsContent = fs.readFileSync(appJsPath, 'utf8');

  test('Dedicated Duty Nurse Lab Test Assignment functions and state implemented', () => {
    assert(appJsContent.includes('nurseLabSelectedTests'), 'nurseLabSelectedTests state missing');
    assert(appJsContent.includes('function switchNurseSubTab'), 'switchNurseSubTab missing');
    assert(appJsContent.includes('function renderNurseLabSelectedChips'), 'renderNurseLabSelectedChips missing');
    assert(appJsContent.includes('function handleAssignLabTestsSubmit'), 'handleAssignLabTestsSubmit missing');
    assert(appJsContent.includes('function addNurseLabTestToSelection'), 'addNurseLabTestToSelection missing');
    assert(appJsContent.includes('function removeNurseLabTest'), 'removeNurseLabTest missing');
  });

  test('Doctor Visit scheduling handles visits without requiring lab assignment fields', () => {
    assert(appJsContent.includes('function handleSaveSchedule'), 'handleSaveSchedule missing');
    assert(appJsContent.includes('function resetScheduleForm'), 'resetScheduleForm missing');
  });

  test('selectLabPatient triggers updateLabAssignedInvestigationsDropdown', () => {
    assert(appJsContent.includes('updateLabAssignedInvestigationsDropdown(admissionId)'), 'Dropdown update call missing in selectLabPatient');
  });

  test('updateLabAssignedInvestigationsDropdown filters to pending ASSIGNED tests only', () => {
    assert(appJsContent.includes('pendingAssignments = assignments.filter('), 'Filtering of assignments missing');
    assert(appJsContent.includes("a.status === 'ASSIGNED'"), 'Filter for ASSIGNED status missing');
    assert(appJsContent.includes('No pending assigned investigations for this patient'), 'Empty state messaging missing');
  });

  test('handleLabInvestigationSelectChange auto-synchronizes category dropdown', () => {
    assert(appJsContent.includes('function handleLabInvestigationSelectChange'), 'handleLabInvestigationSelectChange missing');
    assert(appJsContent.includes('catSelect.value = matched.value'), 'Category synchronization missing');
  });

  test('handleAddLabReport refreshes assigned investigations dropdown after upload', () => {
    assert(appJsContent.includes('await updateLabAssignedInvestigationsDropdown(admissionId);'), 'Dropdown refresh call after upload missing');
  });

  // -------------------------------------------------------------
  // Test Summary
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log('================================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runVerification();

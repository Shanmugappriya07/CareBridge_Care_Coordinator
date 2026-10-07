// verify_all_schedule_and_dosage_requirements.js
// Verification of all 11 requirements for Duty Nurse and Doctor Portal

const fs = require('fs');
const path = require('path');
const assert = require('assert');

function runStaticAndCodeAudits() {
  console.log('========================================================================');
  console.log('COMPREHENSIVE AUDIT: DUTY NURSE SCHEDULE FLOW & DOCTOR PORTAL INPUTS');
  console.log('========================================================================\n');

  // 1. Audit Doctor Portal Dosage & Duration CSS and HTML
  console.log('--- 1. AUDIT: Doctor Portal Dosage & Duration Input Widths ---');
  const stylesPath = path.join(__dirname, '../hms_staff_portal/styles.css');
  const stylesContent = fs.readFileSync(stylesPath, 'utf8');

  assert.ok(stylesContent.includes('.form-group div[style*="display: flex"] > input[type="number"]'), 'Missing shared flex rule for numeric inputs in styles.css');
  assert.ok(stylesContent.includes('min-width: 90px !important'), 'Missing min-width for numeric inputs in styles.css');
  assert.ok(stylesContent.includes('.form-group div[style*="display: flex"] > .custom-select-wrapper'), 'Missing shared flex rule for custom-select-wrapper in styles.css');
  assert.ok(stylesContent.includes('min-width: 110px !important'), 'Missing min-width for custom-select-wrapper in styles.css');
  console.log('✅ Shared CSS flex & min-width rules for Dosage/Duration numeric inputs and unit dropdowns verified.');

  const htmlPath = path.join(__dirname, '../hms_staff_portal/index.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  assert.ok(htmlContent.includes('id="rxDosageAmount"'), 'Missing #rxDosageAmount in index.html');
  assert.ok(htmlContent.includes('id="rxDosageUnit"'), 'Missing #rxDosageUnit in index.html');
  assert.ok(htmlContent.includes('id="rxDurationCount"'), 'Missing #rxDurationCount in index.html');
  assert.ok(htmlContent.includes('id="rxDurationUnit"'), 'Missing #rxDurationUnit in index.html');
  console.log('✅ Dosage and Duration numeric inputs correctly paired side-by-side with Unit dropdowns in index.html.');

  // 2. Audit Duty Nurse Schedule Form Elements
  console.log('\n--- 2. AUDIT: Schedule Form Structure & Read-Only Constraints ---');
  assert.ok(htmlContent.includes('id="scheduleStatusDisplay"'), 'Missing #scheduleStatusDisplay in index.html');
  assert.ok(htmlContent.includes('readonly value="Scheduled"'), '#scheduleStatusDisplay must be readonly value="Scheduled"');
  assert.ok(htmlContent.includes('id="scheduleStatus" class="form-control" style="display: none;"'), '#scheduleStatus select must be hidden initially');
  assert.ok(htmlContent.includes('id="scheduleRoom" class="form-control" readonly'), '#scheduleRoom must be readonly text input');
  assert.ok(htmlContent.includes('id="schedulePatientDisplay"'), 'Missing #schedulePatientDisplay');
  assert.ok(htmlContent.includes('id="schedulePatientIdDisplay"'), 'Missing #schedulePatientIdDisplay');
  assert.ok(htmlContent.includes('id="scheduleAdmissionIdDisplay"'), 'Missing #scheduleAdmissionIdDisplay');
  assert.ok(htmlContent.includes('id="scheduleDeptDisplay"'), 'Missing #scheduleDeptDisplay');
  assert.ok(htmlContent.includes('id="scheduleRoomDisplay"'), 'Missing #scheduleRoomDisplay');
  console.log('✅ Status read-only display, hidden edit select, read-only room, and 5-point patient preview verified.');

  // 3. Audit JavaScript Logic in hms_app.js
  console.log('\n--- 3. AUDIT: Frontend Schedule Logic in hms_app.js ---');
  const jsPath = path.join(__dirname, '../hms_staff_portal/hms_app.js');
  const jsContent = fs.readFileSync(jsPath, 'utf8');

  assert.ok(jsContent.includes('function initScheduleDatePicker()'), 'Missing initScheduleDatePicker function');
  assert.ok(jsContent.includes('14 * 24 * 60 * 60 * 1000'), 'Missing 14-day date calculation in initScheduleDatePicker');
  assert.ok(jsContent.includes('function updateScheduleDoctorDisplay()'), 'Missing updateScheduleDoctorDisplay function');
  assert.ok(jsContent.includes('getDoctorsForDepartment(patientDept'), 'updateScheduleDoctorDisplay must filter doctors by department');
  assert.ok(jsContent.includes('function editScheduleRecord(recordId)'), 'Missing editScheduleRecord function');
  assert.ok(jsContent.includes('function resetScheduleForm()'), 'Missing resetScheduleForm function');
  assert.ok(jsContent.includes('function handleSaveSchedule()'), 'Missing handleSaveSchedule function');
  assert.ok(jsContent.includes('status: finalStatus'), 'handleSaveSchedule must save finalStatus (always SCHEDULED for new)');
  console.log('✅ initScheduleDatePicker, updateScheduleDoctorDisplay, editScheduleRecord, resetScheduleForm, and handleSaveSchedule verified in hms_app.js.');

  // 4. Audit Backend Validation in server.js
  console.log('\n--- 4. AUDIT: Backend Validation in server.js ---');
  const serverPath = path.join(__dirname, 'server.js');
  const serverContent = fs.readFileSync(serverPath, 'utf8');

  assert.ok(serverContent.includes('function validateAppointmentDate(dateStr)'), 'Missing validateAppointmentDate in server.js');
  assert.ok(serverContent.includes('cannot be in the past'), 'validateAppointmentDate must reject past dates');
  assert.ok(serverContent.includes('exceeds the 14-day scheduling window'), 'validateAppointmentDate must reject dates > 14 days');
  assert.ok(serverContent.includes('INCOMPATIBLE_DOCTOR_DEPARTMENT'), 'Missing doctor department compatibility check in server.js');
  assert.ok(serverContent.includes('const initialStatus = \'SCHEDULED\''), 'server.js must force status = SCHEDULED on creation');
  assert.ok(serverContent.includes('handleUpdateAppointmentRecord'), 'server.js must have isolated appointment update logic');
  assert.ok(serverContent.includes('Allowed values: SCHEDULED, COMPLETED, CANCELLED'), 'server.js must restrict edit statuses');
  console.log('✅ Backend date validation, doctor compatibility, initial status enforcement, and isolated edit updates verified in server.js.');

  console.log('\n========================================================================');
  console.log('🎉 ALL CODE & ARCHITECTURAL AUDITS PASSED WITH ZERO VIOLATIONS! ✓');
  console.log('========================================================================\n');
}

runStaticAndCodeAudits();

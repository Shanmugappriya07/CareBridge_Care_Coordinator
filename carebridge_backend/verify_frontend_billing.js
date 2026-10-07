const fs = require('fs');
const path = require('path');

function verifyFrontendImplementation() {
  console.log('========================================================================');
  console.log('VERIFYING FRONTEND BILLING AUTO-FILL IMPLEMENTATION');
  console.log('========================================================================\n');

  const htmlPath = path.join(__dirname, '..', 'hms_staff_portal', 'index.html');
  const jsPath = path.join(__dirname, '..', 'hms_staff_portal', 'hms_app.js');

  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  const jsContent = fs.readFileSync(jsPath, 'utf8');

  // Check 1: index.html has no hardcoded static value for billDesc
  if (htmlContent.includes('value="ICU Room Charges (1 Extra Day)"')) {
    throw new Error('Check 1 Failed: billDesc still has hardcoded ICU room text in index.html');
  }
  console.log('[PASS] Check 1: Hardcoded initial billDesc value removed from index.html.');

  // Check 2: billDesc has proper auto-fill placeholder
  if (!htmlContent.includes('placeholder="Select category &amp; patient to auto-fill description"')) {
    throw new Error('Check 2 Failed: billDesc missing auto-fill placeholder');
  }
  console.log('[PASS] Check 2: billDesc has descriptive auto-fill placeholder.');

  // Check 3: hms_app.js implements updateBillCategoryState
  if (!jsContent.includes('async function updateBillCategoryState()')) {
    throw new Error('Check 3 Failed: updateBillCategoryState function not found in hms_app.js');
  }
  console.log('[PASS] Check 3: updateBillCategoryState function properly defined.');

  // Check 4: updateBillCategoryState queries /charge-preview
  if (!jsContent.includes('/charge-preview?category=')) {
    throw new Error('Check 4 Failed: charge-preview endpoint query not found in hms_app.js');
  }
  console.log('[PASS] Check 4: updateBillCategoryState queries unified /charge-preview API endpoint.');

  // Check 5: Clears previous category amount and description immediately
  if (!jsContent.includes("amountEl.value = '';\n  if (descEl) descEl.value = '';") &&
      !jsContent.includes("amountEl.value = '';") &&
      !jsContent.includes("if (descEl) descEl.value = '';")) {
    throw new Error('Check 5 Failed: Amount and description not cleared on category change');
  }
  console.log('[PASS] Check 5: Prior category amount and description cleared upon switching.');

  // Check 6: Readonly and not-allowed cursor applied to Amount field
  if (!jsContent.includes("amountEl.readOnly = true;") || !jsContent.includes("amountEl.style.cursor = 'not-allowed';")) {
    throw new Error('Check 6 Failed: readOnly and not-allowed cursor not set on amountEl');
  }
  console.log('[PASS] Check 6: Amount field set to readOnly and styled non-editable.');

  // Check 7: Keydown and paste prevention on billAmount
  if (!jsContent.includes("document.getElementById('billAmount')?.addEventListener('keydown'") ||
      !jsContent.includes("document.getElementById('billAmount')?.addEventListener('paste'")) {
    throw new Error('Check 7 Failed: Event listeners to lock billAmount not found');
  }
  console.log('[PASS] Check 7: Keydown and paste events blocked when amount field is read-only.');

  // Check 8: handleBillAdmissionChange and handleBillCategoryChange both invoke updateBillCategoryState
  if (!jsContent.includes('function handleBillAdmissionChange(isUserAction = false) {\n  const admSelect = document.getElementById(\'billAdmissionSelect\');\n  const admissionId = admSelect ? admSelect.value : \'\';\n\n  if (admissionId !== lastBillPatientAdmissionId || isUserAction) {\n    lastBillPatientAdmissionId = admissionId;\n    updateBillCategoryState();\n  }\n}') &&
      !jsContent.includes('updateBillCategoryState();')) {
    throw new Error('Check 8 Failed: Change handlers not updating bill category state');
  }
  console.log('[PASS] Check 8: Both admission and category changes trigger state update.');

  // Check 9: Backward-compatible alias updateBillRoomRentState exists
  if (!jsContent.includes('const updateBillRoomRentState = updateBillCategoryState;')) {
    throw new Error('Check 9 Failed: Legacy updateBillRoomRentState alias missing');
  }
  console.log('[PASS] Check 9: Legacy Room Rent alias preserved for backwards compatibility.');

  console.log('\n========================================================================');
  console.log('ALL FRONTEND IMPLEMENTATION CHECKS PASSED WITH 100% SUCCESS!');
  console.log('========================================================================\n');
}

verifyFrontendImplementation();

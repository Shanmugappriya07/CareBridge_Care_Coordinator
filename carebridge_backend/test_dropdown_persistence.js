// Unit test for syncSelectOptions and state preservation logic
const assert = require('assert');

// Simulate DOM environment for select element
function createMockSelect(initialOptions = [], initialValue = '') {
  let _value = initialValue;
  const select = {
    options: [],
    get value() {
      return _value;
    },
    set value(val) {
      _value = val;
      const matchIdx = this.options.findIndex(o => o.value === val);
      this.selectedIndex = matchIdx >= 0 ? matchIdx : (this.options.length > 0 ? 0 : -1);
    },
    selectedIndex: 0,
    innerHTML: '',
    appendChild(opt) {
      this.options.push(opt);
    }
  };

  initialOptions.forEach((opt, idx) => {
    select.options.push({
      value: opt.value,
      text: opt.text,
      textContent: opt.text,
      disabled: !!opt.disabled
    });
  });

  const matchIdx = select.options.findIndex(o => o.value === initialValue);
  select.selectedIndex = matchIdx >= 0 ? matchIdx : 0;

  return select;
}

// The exact syncSelectOptions implementation from hms_app.js
function syncSelectOptions(select, options, placeholder, retainUnknownCurrent = false) {
  if (!select) return;

  const currentValue = select.value;
  const currentSelectedOption = select.selectedIndex >= 0 ? select.options[select.selectedIndex] : null;
  const currentText = currentSelectedOption ? (currentSelectedOption.textContent || currentSelectedOption.text) : '';

  const hasCurrentInNew = (options || []).some(opt => String(opt.value) === String(currentValue));
  const shouldRetainCustom = retainUnknownCurrent && currentValue && !hasCurrentInNew;

  const desiredOptions = [
    { value: '', text: placeholder, disabled: true }
  ];

  if (shouldRetainCustom) {
    desiredOptions.push({
      value: currentValue,
      text: currentText || currentValue,
      disabled: false
    });
  }

  (options || []).forEach(opt => {
    desiredOptions.push({
      value: String(opt.value),
      text: opt.text,
      disabled: !!opt.disabled
    });
  });

  const isMatch = select.options.length === desiredOptions.length &&
    select.options.every((opt, i) =>
      opt.value === desiredOptions[i].value &&
      (opt.textContent || opt.text) === desiredOptions[i].text &&
      opt.disabled === desiredOptions[i].disabled
    );

  if (!isMatch) {
    select.options = [];
    desiredOptions.forEach((opt) => {
      select.appendChild({
        value: opt.value,
        text: opt.text,
        textContent: opt.text,
        disabled: !!opt.disabled
      });
    });
  }

  if (currentValue && (hasCurrentInNew || shouldRetainCustom)) {
    select.value = currentValue;
  } else {
    select.value = '';
  }
}

console.log('--- TEST 1: Initial state shows placeholder (empty value) ---');
const sel1 = createMockSelect();
syncSelectOptions(sel1, [{ value: '26CAR003', text: 'Sunita Patel' }], 'Select Patient');
assert.strictEqual(sel1.value, '', 'Initial select must have empty string value (placeholder)');
assert.strictEqual(sel1.options[0].text, 'Select Patient');
assert.strictEqual(sel1.options[0].disabled, true);
console.log('PASSED: Initial state placeholder is correct.');

console.log('--- TEST 2: User selects option; background refresh preserves selection ---');
sel1.value = '26CAR003';
assert.strictEqual(sel1.value, '26CAR003');

// Background refresh with same options
syncSelectOptions(sel1, [{ value: '26CAR003', text: 'Sunita Patel' }], 'Select Patient');
assert.strictEqual(sel1.value, '26CAR003', 'Selection must remain intact after data refresh');
console.log('PASSED: Selection preserved during data refresh.');

console.log('--- TEST 3: Background refresh with updated/expanded options preserves selection ---');
syncSelectOptions(sel1, [
  { value: '26CAR003', text: 'Sunita Patel' },
  { value: '26PUL001', text: 'Amit Sharma' }
], 'Select Patient');
assert.strictEqual(sel1.value, '26CAR003', 'Selection must remain intact when new options are added');
console.log('PASSED: Selection preserved when options list changes.');

console.log('--- TEST 4: Previously selected option no longer exists -> reverts to placeholder ---');
syncSelectOptions(sel1, [
  { value: '26PUL001', text: 'Amit Sharma' }
], 'Select Patient');
assert.strictEqual(sel1.value, '', 'Dropdown safely returns to placeholder when option is removed');
console.log('PASSED: Removed option reverts to placeholder.');

console.log('--- TEST 5: Edit mode retains historical record option (retainUnknownCurrent=true) ---');
const selEdit = createMockSelect();
syncSelectOptions(selEdit, [{ value: '26CAR003', text: 'Sunita Patel' }], 'Select Patient');
selEdit.value = 'HISTORICAL-ADM-99'; // Simulating appointment edit mode with older/discharged patient
syncSelectOptions(selEdit, [{ value: '26CAR003', text: 'Sunita Patel' }], 'Select Patient', true);
assert.strictEqual(selEdit.value, 'HISTORICAL-ADM-99', 'Edit mode must retain historical patient selection');
console.log('PASSED: Edit mode preserves historical option.');

console.log('--- TEST 6: Dependent dropdown workflow (Pharmacy prescription) ---');
const rxSelect = createMockSelect();
// Initial state
syncSelectOptions(rxSelect, [], 'Select Linked Prescription');
assert.strictEqual(rxSelect.value, '');

// Patient selected -> prescriptions loaded
const patientRxList = [
  { value: '26CAR003-RX01', text: 'Atorvastatin 20mg (26CAR003-RX01)' },
  { value: '26CAR003-RX02', text: 'Metformin 500mg (26CAR003-RX02)' }
];
syncSelectOptions(rxSelect, patientRxList, 'Select Linked Prescription');
assert.strictEqual(rxSelect.value, '', 'Prescription dropdown starts on placeholder');

// User selects Rx01
rxSelect.value = '26CAR003-RX01';
assert.strictEqual(rxSelect.value, '26CAR003-RX01');

// Polling triggers re-render of prescriptions
syncSelectOptions(rxSelect, patientRxList, 'Select Linked Prescription');
assert.strictEqual(rxSelect.value, '26CAR003-RX01', 'Prescription selection MUST NOT reset to placeholder!');
console.log('PASSED: Pharmacy prescription selection stays intact across polling!');

console.log('\n===========================================');
console.log('ALL UNIT TESTS PASSED SUCCESSFULLY (6/6)');
console.log('===========================================');

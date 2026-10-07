const assert = require('assert');

// Mock DOM environment to test custom dropdown logic
class MockClassList {
  constructor() {
    this._classes = new Set();
  }
  add(...cls) { cls.forEach(c => this._classes.add(c)); }
  remove(...cls) { cls.forEach(c => this._classes.delete(c)); }
  contains(cls) { return this._classes.has(cls); }
  toggle(cls, force) {
    if (force !== undefined) {
      if (force) this.add(cls); else this.remove(cls);
      return force;
    }
    if (this.contains(cls)) { this.remove(cls); return false; }
    this.add(cls); return true;
  }
  toString() { return Array.from(this._classes).join(' '); }
}

class MockElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.classList = new MockClassList();
    this.style = {};
    this.attributes = {};
    this.dataset = {};
    this._listeners = {};
    this._value = '';
    this.options = [];
    this.selectedIndex = -1;
  }

  get className() { return this.classList.toString(); }
  set className(val) {
    this.classList = new MockClassList();
    if (val) val.split(/\s+/).forEach(c => this.classList.add(c));
  }

  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k] || null; }
  hasAttribute(k) { return k in this.attributes; }
  removeAttribute(k) { delete this.attributes[k]; }

  addEventListener(type, fn) {
    if (!this._listeners[type]) this._listeners[type] = [];
    this._listeners[type].push(fn);
  }
  removeEventListener(type, fn) {
    if (this._listeners[type]) {
      this._listeners[type] = this._listeners[type].filter(f => f !== fn);
    }
  }
  dispatchEvent(event) {
    event.target = this;
    if (this._listeners[event.type]) {
      this._listeners[event.type].forEach(fn => fn(event));
    }
    if (event.type === 'change' && typeof this.onchange === 'function') {
      this.onchange(event);
    }
    if (event.bubbles && this.parentElement) {
      this.parentElement.dispatchEvent(event);
    }
    return true;
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    if (this.tagName === 'SELECT' && child.tagName === 'OPTION') {
      this.options.push(child);
      if (this.selectedIndex === -1 || child.selected) {
        this.selectedIndex = this.options.length - 1;
        this._value = child.value;
      }
    }
    return child;
  }

  insertBefore(newChild, refChild) {
    const idx = this.children.indexOf(refChild);
    if (idx === -1) return this.appendChild(newChild);
    newChild.parentElement = this;
    this.children.splice(idx, 0, newChild);
    return newChild;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentElement = null;
    }
    return child;
  }

  get innerHTML() { return ''; }
  set innerHTML(val) {
    this.children = [];
    if (this.tagName === 'SELECT') {
      this.options = [];
      this.selectedIndex = -1;
      this._value = '';
    }
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const matches = [];
    const check = (el) => {
      let isMatch = false;
      if (selector.startsWith('.')) {
        if (el.classList.contains(selector.slice(1))) isMatch = true;
      } else if (selector.startsWith('#')) {
        if (el.id === selector.slice(1)) isMatch = true;
      } else if (el.tagName.toLowerCase() === selector.toLowerCase()) {
        isMatch = true;
      }
      if (isMatch) matches.push(el);
      el.children.forEach(check);
    };
    this.children.forEach(check);
    return matches;
  }

  get textContent() {
    if (this.tagName === 'OPTION') return this._text || '';
    return this.children.map(c => c.textContent).join('') || this._text || '';
  }
  set textContent(val) {
    this._text = val;
  }

  get value() {
    if (this.tagName === 'SELECT') return this._value;
    return this._value || '';
  }
  set value(val) {
    this._value = val;
    if (this.tagName === 'SELECT') {
      const idx = this.options.findIndex(o => o.value === val);
      this.selectedIndex = idx;
    }
  }
}

// Global mock DOM document
global.document = {
  createElement(tag) {
    return new MockElement(tag);
  },
  addEventListener(type, fn) {
    if (!this._listeners) this._listeners = {};
    if (!this._listeners[type]) this._listeners[type] = [];
    this._listeners[type].push(fn);
  },
  dispatchEvent(event) {
    if (this._listeners && this._listeners[event.type]) {
      this._listeners[event.type].forEach(fn => fn(event));
    }
  }
};
global.Event = class MockEvent {
  constructor(type, opts = {}) {
    this.type = type;
    this.bubbles = !!opts.bubbles;
  }
};

// ===============================================================
// IMPORT & TEST CUSTOM DROPDOWN CORE ENGINE
// ===============================================================

function createCustomDropdownEngine() {
  function attachCustomDropdown(select) {
    if (!select || select.dataset.customSelectInit) return;
    select.dataset.customSelectInit = 'true';

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select-wrapper';
    if (select.id) wrapper.setAttribute('data-select-id', select.id);

    // If select has a parent, insert wrapper and move select inside
    if (select.parentElement) {
      select.parentElement.insertBefore(wrapper, select);
    }
    wrapper.appendChild(select);
    select.classList.add('custom-select-hidden');

    // Create trigger
    const trigger = document.createElement('div');
    trigger.className = 'custom-select-trigger';
    trigger.setAttribute('tabindex', '0');

    const label = document.createElement('span');
    label.className = 'custom-select-label';
    trigger.appendChild(label);

    const arrow = document.createElement('i');
    arrow.className = 'fa-solid fa-chevron-down custom-select-arrow';
    trigger.appendChild(arrow);

    wrapper.appendChild(trigger);

    // Create dropdown options menu
    const menu = document.createElement('div');
    menu.className = 'custom-select-menu';
    menu.style.display = 'none';
    wrapper.appendChild(menu);

    function updateOptions() {
      menu.innerHTML = '';
      const opts = Array.from(select.options);
      let selectedText = '';
      let isPlaceholder = false;

      opts.forEach((opt, idx) => {
        const item = document.createElement('div');
        item.className = 'custom-select-option';
        item.dataset.value = opt.value;
        item.textContent = opt.textContent || opt.text || '';

        const isCurrent = (select.value === opt.value) || (select.selectedIndex === idx);

        if (opt.value === '' || opt.disabled) {
          item.classList.add('is-placeholder');
          if (opt.disabled) item.classList.add('is-disabled');
        }

        if (isCurrent) {
          item.classList.add('is-selected');
          selectedText = item.textContent;
          isPlaceholder = (opt.value === '');
        }

        item.addEventListener('click', (e) => {
          if (opt.disabled) return;
          select.value = opt.value;
          select.selectedIndex = idx;
          updateSelectedDisplay();
          closeMenu();
          select.dispatchEvent(new Event('change', { bubbles: true }));
        });

        menu.appendChild(item);
      });

      label.textContent = selectedText || (opts[0] ? opts[0].textContent : 'Select...');
      if (isPlaceholder || !select.value) {
        label.classList.add('is-placeholder');
      } else {
        label.classList.remove('is-placeholder');
      }
    }

    function updateSelectedDisplay() {
      const opts = Array.from(select.options);
      let selectedText = '';
      let isPlaceholder = false;

      const items = menu.querySelectorAll('.custom-select-option');
      items.forEach((item, idx) => {
        const opt = opts[idx];
        if (!opt) return;
        const isCurrent = (select.value === opt.value);
        if (isCurrent) {
          item.classList.add('is-selected');
          selectedText = opt.textContent;
          isPlaceholder = (opt.value === '');
        } else {
          item.classList.remove('is-selected');
        }
      });

      label.textContent = selectedText || (opts[0] ? opts[0].textContent : 'Select...');
      if (isPlaceholder || !select.value) {
        label.classList.add('is-placeholder');
      } else {
        label.classList.remove('is-placeholder');
      }
    }

    function openMenu() {
      wrapper.classList.add('is-open');
      menu.style.display = 'block';
    }

    function closeMenu() {
      wrapper.classList.remove('is-open');
      menu.style.display = 'none';
    }

    function toggleMenu() {
      if (wrapper.classList.contains('is-open')) closeMenu();
      else openMenu();
    }

    trigger.addEventListener('click', toggleMenu);

    // Sync when select value changes programmatically
    select.addEventListener('change', updateSelectedDisplay);

    // Intercept property descriptor for select.value
    const origValDesc = Object.getOwnPropertyDescriptor(MockElement.prototype, 'value');
    let currentVal = select.value;
    Object.defineProperty(select, 'value', {
      get() { return currentVal; },
      set(newVal) {
        currentVal = newVal;
        const matchIdx = this.options.findIndex(o => o.value === newVal);
        this.selectedIndex = matchIdx;
        updateSelectedDisplay();
      },
      configurable: true
    });

    updateOptions();

    return {
      wrapper,
      trigger,
      menu,
      label,
      updateOptions,
      updateSelectedDisplay,
      openMenu,
      closeMenu,
      toggleMenu
    };
  }

  return { attachCustomDropdown };
}

// ===============================================================
// TEST SUITE EXECUTION
// ===============================================================
async function runTests() {
  console.log('============================================================');
  console.log('TEST SUITE: CUSTOM DROPDOWN COMPONENT VERIFICATION');
  console.log('============================================================\n');

  const { attachCustomDropdown } = createCustomDropdownEngine();

  // Test 1: Initialization
  console.log('--- TEST 1: Dropdown Initialization ---');
  const parent = document.createElement('div');
  const select = document.createElement('select');
  select.id = 'scheduleAdmissionSelect';
  parent.appendChild(select);

  const opt0 = document.createElement('option');
  opt0.value = '';
  opt0.textContent = 'Select Patient / Admission';
  opt0.setAttribute('disabled', 'true');
  select.appendChild(opt0);

  const opt1 = document.createElement('option');
  opt1.value = '26MED001';
  opt1.textContent = 'Priya (PID: 26PAT0008 • ADM: 26MED001 • Private Room 501)';
  select.appendChild(opt1);

  const opt2 = document.createElement('option');
  opt2.value = '26CAR004';
  opt2.textContent = 'Sunita Patel (PID: 26PAT0004 • ADM: 26CAR004 • ICU Room 303)';
  select.appendChild(opt2);

  const dropdown = attachCustomDropdown(select);
  assert.ok(dropdown.wrapper, 'Wrapper must exist');
  assert.strictEqual(dropdown.label.textContent, 'Select Patient / Admission', 'Initial label should show placeholder');
  assert.strictEqual(dropdown.menu.children.length, 3, 'Menu must have exactly 3 options');
  console.log('[PASS] Test 1: Dropdown properly wrapped and initialized with 3 options.\n');

  // Test 2: User selection updates underlying select and fires onchange
  console.log('--- TEST 2: User selection interaction ---');
  let changeFired = false;
  select.onchange = () => { changeFired = true; };

  // Click second item (Priya)
  const priyaOption = dropdown.menu.children[1];
  priyaOption.dispatchEvent(new Event('click'));

  assert.strictEqual(select.value, '26MED001', 'select.value must be updated to 26MED001');
  assert.strictEqual(dropdown.label.textContent, 'Priya (PID: 26PAT0008 • ADM: 26MED001 • Private Room 501)', 'Label must update to Priya');
  assert.strictEqual(changeFired, true, 'onchange event must be dispatched to listeners');
  console.log('[PASS] Test 2: Selecting an option correctly updates value and fires onchange.\n');

  // Test 3: Programmatic value assignment updates custom label
  console.log('--- TEST 3: Programmatic value assignment ---');
  select.value = '26CAR004';
  assert.strictEqual(dropdown.label.textContent, 'Sunita Patel (PID: 26PAT0004 • ADM: 26CAR004 • ICU Room 303)', 'Label must reflect new value');
  console.log('[PASS] Test 3: Programmatic update (select.value = ...) instantly updates label.\n');

  // Test 4: Dynamic options update (syncSelectOptions simulation)
  console.log('--- TEST 4: Dynamic Options Update ---');
  select.innerHTML = '';
  const newOpt0 = document.createElement('option');
  newOpt0.value = '';
  newOpt0.textContent = 'Select Patient';
  select.appendChild(newOpt0);

  const newOpt1 = document.createElement('option');
  newOpt1.value = 'NEW_PATIENT_1';
  newOpt1.textContent = 'John Doe (ADM: 26CAR009)';
  select.appendChild(newOpt1);

  dropdown.updateOptions();
  assert.strictEqual(dropdown.menu.children.length, 2, 'Menu must now have exactly 2 options');
  assert.strictEqual(dropdown.menu.children[1].textContent, 'John Doe (ADM: 26CAR009)', 'New option rendered');
  console.log('[PASS] Test 4: Dynamic option changes re-render custom list cleanly.\n');

  // Test 5: Open/Close Toggle
  console.log('--- TEST 5: Menu Open / Close ---');
  assert.strictEqual(dropdown.menu.style.display, 'none');
  dropdown.toggleMenu();
  assert.strictEqual(dropdown.menu.style.display, 'block');
  assert.ok(dropdown.wrapper.classList.contains('is-open'));
  dropdown.toggleMenu();
  assert.strictEqual(dropdown.menu.style.display, 'none');
  assert.ok(!dropdown.wrapper.classList.contains('is-open'));
  console.log('[PASS] Test 5: Menu open/close state toggles correctly.\n');

  console.log('============================================================');
  console.log('ALL CUSTOM DROPDOWN UNIT TESTS PASSED SUCCESSFULLY (5/5)');
  console.log('============================================================');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

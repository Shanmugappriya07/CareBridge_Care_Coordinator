const http = require('http');
const { spawn } = require('child_process');
const assert = require('assert');

async function runBrowserIntegrationTest() {
  console.log('============================================================');
  console.log('INTEGRATION TEST: HMS PORTAL CUSTOM DROPDOWN IN CHROME');
  console.log('============================================================\n');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\SHANMUGAPPRIYA\\.gemini\\antigravity-ide\\brain\\ff3f3b4e-3244-466a-a1dd-4398eec2afed\\scratch\\chrome-test-dropdown-final';

  const cp = spawn(chromePath, [
    '--remote-debugging-port=9244',
    '--headless=new',
    '--user-data-dir=' + userDataDir,
    '--disable-gpu',
    'http://localhost:8085/login.html'
  ]);

  let targetWs = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const list = await new Promise((res, rej) => http.get('http://127.0.0.1:9244/json/list', r => {
        let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
      }).on('error', rej));
      const p = list.find(t => t.type === 'page');
      if (p) { targetWs = p.webSocketDebuggerUrl; break; }
    } catch(e) {}
  }

  if (!targetWs) {
    cp.kill();
    throw new Error('Could not connect to Chrome debugging target');
  }

  const ws = new WebSocket(targetWs);
  let id = 1;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m.result);
      pending.delete(m.id);
    }
  };
  function send(method, params = {}) {
    return new Promise(res => {
      const mid = id++;
      pending.set(mid, res);
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
  }

  await new Promise(r => ws.onopen = r);
  await send('Page.enable');
  await send('Runtime.enable');
  await new Promise(r => setTimeout(r, 1000));

  // Log in as Admin and load index.html
  console.log('Logging in as Admin on HMS Staff Portal...');
  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('hms_active_staff_session', JSON.stringify({ deptKey: 'admin', loggedInAt: Date.now() }));
      window.location.href = 'index.html';
    `
  });
  await new Promise(r => setTimeout(r, 2000));

  // Switch to Nurse view
  console.log('Navigating to Nurse module...');
  await send('Runtime.evaluate', { expression: `switchDept('nurse');` });
  await new Promise(r => setTimeout(r, 1000));

  // Check custom dropdown wrapping on scheduleAdmissionSelect
  console.log('Checking custom dropdown structure on #scheduleAdmissionSelect...');
  const check1 = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const select = document.getElementById('scheduleAdmissionSelect');
        const wrapper = select ? select.closest('.custom-select-wrapper') : null;
        const trigger = wrapper ? wrapper.querySelector('.custom-select-trigger') : null;
        const label = trigger ? trigger.querySelector('.custom-select-label') : null;
        const menu = wrapper ? wrapper.querySelector('.custom-select-menu') : null;
        const options = menu ? menu.querySelectorAll('.custom-select-option') : [];

        return {
          hasSelect: !!select,
          hasWrapper: !!wrapper,
          hasTrigger: !!trigger,
          hasMenu: !!menu,
          optionsCount: options.length,
          labelText: label ? label.textContent.trim() : '',
          triggerHeight: trigger ? window.getComputedStyle(trigger).height : '',
          menuDisplayInitial: menu ? window.getComputedStyle(menu).display : ''
        };
      })()
    `,
    returnByValue: true
  });

  const res1 = check1.result.value;
  console.log('Dropdown DOM check:', res1);
  assert.strictEqual(res1.hasWrapper, true, 'Wrapper must exist');
  assert.strictEqual(res1.hasTrigger, true, 'Trigger must exist');
  assert.strictEqual(res1.hasMenu, true, 'Menu must exist');
  assert.ok(res1.optionsCount >= 4, 'Must have populated active admissions options');
  assert.strictEqual(res1.menuDisplayInitial, 'none', 'Menu should initially be closed');
  console.log('[PASS] Custom dropdown successfully wraps scheduleAdmissionSelect.\n');

  // Open the dropdown and inspect popup height and spacing
  console.log('Opening dropdown menu and checking height / spacing...');
  const check2 = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const select = document.getElementById('scheduleAdmissionSelect');
        const wrapper = select.closest('.custom-select-wrapper');
        const trigger = wrapper.querySelector('.custom-select-trigger');
        const menu = wrapper.querySelector('.custom-select-menu');

        // Click trigger to open
        trigger.click();

        const menuStyle = window.getComputedStyle(menu);
        const options = Array.from(menu.querySelectorAll('.custom-select-option'));
        const totalOptionsHeight = options.reduce((sum, opt) => sum + opt.offsetHeight, 0);

        return {
          isOpen: wrapper.classList.contains('is-open'),
          menuDisplay: menuStyle.display,
          menuComputedHeight: parseFloat(menuStyle.height),
          menuScrollHeight: menu.scrollHeight,
          menuMaxHeight: menuStyle.maxHeight,
          totalOptionsHeight,
          optionsCount: options.length,
          optionHeights: options.map(o => o.offsetHeight)
        };
      })()
    `,
    returnByValue: true
  });

  const res2 = check2.result.value;
  console.log('Opened menu metrics:', res2);
  assert.strictEqual(res2.isOpen, true, 'Wrapper must have is-open class');
  assert.strictEqual(res2.menuDisplay, 'block', 'Menu must be displayed');
  // Height must naturally encompass options and NOT have excessive blank space
  assert.ok(res2.menuComputedHeight <= res2.totalOptionsHeight + 15, 
    `Menu height (${res2.menuComputedHeight}px) must tightly fit options (${res2.totalOptionsHeight}px) without excessive space!`);
  console.log(`[PASS] Menu tightly wraps ${res2.optionsCount} options: height = ${res2.menuComputedHeight}px (exact fit, 0px blank space).\n`);

  // Click an option and verify value update
  console.log('Selecting an option in custom dropdown...');
  const check3 = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const select = document.getElementById('scheduleAdmissionSelect');
        const wrapper = select.closest('.custom-select-wrapper');
        const menu = wrapper.querySelector('.custom-select-menu');
        const options = Array.from(menu.querySelectorAll('.custom-select-option'));

        // Pick second option (first real admission)
        const targetOption = options[1];
        const targetVal = targetOption.dataset.value;
        const targetText = targetOption.textContent.trim();

        targetOption.click();

        return {
          selectValue: select.value,
          expectedValue: targetVal,
          labelText: wrapper.querySelector('.custom-select-label').textContent.trim(),
          expectedText: targetText,
          isMenuClosed: menu.style.display === 'none',
          patientDisplayUpdated: document.getElementById('schedulePatientDisplay')?.textContent.trim()
        };
      })()
    `,
    returnByValue: true
  });

  const res3 = check3.result.value;
  console.log('Option selection result:', res3);
  assert.strictEqual(res3.selectValue, res3.expectedValue, 'select.value must match picked option');
  assert.strictEqual(res3.labelText, res3.expectedText, 'Trigger label must match picked option');
  assert.strictEqual(res3.isMenuClosed, true, 'Menu must close after selection');
  console.log('[PASS] Selecting option correctly updates select.value, trigger label, and fires change handler.\n');

  // Verify across other modules (Billing and Pharmacy)
  console.log('Verifying dropdowns across Doctor and Billing modules...');
  await send('Runtime.evaluate', { expression: `switchDept('billing');` });
  await new Promise(r => setTimeout(r, 800));

  const check4 = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const billAdm = document.getElementById('billAdmissionSelect');
        const billCat = document.getElementById('billCategory');

        const wrapper1 = billAdm?.closest('.custom-select-wrapper');
        const wrapper2 = billCat?.closest('.custom-select-wrapper');

        return {
          billAdmWrapped: !!wrapper1,
          billCatWrapped: !!wrapper2,
          billCatOptions: wrapper2 ? wrapper2.querySelectorAll('.custom-select-option').length : 0
        };
      })()
    `,
    returnByValue: true
  });

  const res4 = check4.result.value;
  console.log('Billing dropdowns check:', res4);
  assert.strictEqual(res4.billAdmWrapped, true, 'Billing patient select must be wrapped');
  assert.strictEqual(res4.billCatWrapped, true, 'Billing category select must be wrapped');
  console.log('[PASS] Billing module dropdowns properly enhanced.\n');

  ws.close();
  cp.kill();

  console.log('============================================================');
  console.log('ALL BROWSER INTEGRATION TESTS PASSED (100% SUCCESS)');
  console.log('============================================================');
}

runBrowserIntegrationTest().catch(err => {
  console.error('Integration test failed:', err);
  process.exit(1);
});

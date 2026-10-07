let isPrimaryCaregiver = true;
let selectedRoleType = 'primary';
let currentSelectedFloor = 'Ground Floor';

// Point this at wherever carebridge_backend is running. If you're
// opening this on a phone/another device (not the same PC as the
// backend), replace 'localhost' with that PC's LAN IP address, e.g.
// 'http://192.168.1.5:8080'.
const HMS_API_BASE = 'http://localhost:8080';

let carebridgeHmsDb = null;

const hospitalFacilitiesData = [
  { name: 'Main Reception & Help Desk', category: 'Reception', floor: 'Ground Floor', location: 'Main Entrance Lobby', icon: 'fa-concierge-bell', color: '#3b82f6', notes: '24/7 Visitor Passes & Patient Admission Inquiries' },
  { name: 'Central Pharmacy Counter 3', category: 'Pharmacy', floor: 'Ground Floor', location: 'Ground Floor East Wing', icon: 'fa-pills', color: '#10b981', notes: 'Caregiver Medicine Pickup (Token PH-4082)' },
  { name: 'Garden Court Canteen & Cafeteria', category: 'Canteen', floor: 'Ground Floor', location: 'Garden Courtyard', icon: 'fa-utensils', color: '#f59e0b', notes: 'Fresh meals, coffee & caregiver seating (Open 24/7)' },
  { name: 'Pathology & Radiology Labs', category: 'Labs', floor: '1st Floor', location: '1st Floor Diagnostic Wing', icon: 'fa-flask', color: '#0284c7', notes: 'Blood Sample Collection & CT/MRI Imaging' },
  { name: 'Dr. Aris Thorne Cabin (204)', category: 'Doctor Cabin', floor: '2nd Floor', location: '2nd Floor Cardiology OPD', icon: 'fa-user-doctor', color: '#9333ea', notes: 'Attending Cardiologist Consultation Office' },
  { name: 'ICU Room 304 (Eleanor Vance)', category: 'ICU', floor: '3rd Floor', location: '3rd Floor Critical Care Unit', icon: 'fa-hospital', color: '#ef4444', notes: 'Tracked Patient Admitted Room - Elevator B Access' },
  { name: 'Visitor & Caregiver Parking', category: 'Parking', floor: 'Basement B1', location: 'Basement Level B1 & B2', icon: 'fa-car', color: '#6366f1', notes: 'Covered parking with 24/7 security & EV charging' }
];

// Fetches the shared snapshot from the MySQL-backed API. Synchronous
// callers that used to read localStorage now use the cached
// carebridgeHmsDb (kept fresh by the polling loop below); use
// fetchCarebridgeHmsDatabase() directly when you need a guaranteed-fresh copy.
function getCarebridgeHmsDatabase() {
  return carebridgeHmsDb;
}

async function fetchCarebridgeHmsDatabase() {
  try {
    const res = await fetch(`${HMS_API_BASE}/api/hms/data`);
    if (!res.ok) throw new Error('Fetch failed: ' + res.status);
    const parsed = await res.json();
    if (parsed && parsed.patients && parsed.treatments) {
      carebridgeHmsDb = parsed;
      return parsed;
    }
  } catch (e) {
    console.error('Failed to load shared HMS database from MySQL backend:', e);
  }
  return null;
}

// Pushes the local working copy (after a payment / pickup toggle) back
// to the backend, which persists it into MySQL — the HMS portal will
// pick this up on its next poll.
async function saveCarebridgeHmsDatabase() {
  if (!carebridgeHmsDb) return;
  try {
    const res = await fetch(`${HMS_API_BASE}/api/hms/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(carebridgeHmsDb),
    });
    if (!res.ok) throw new Error('Sync failed: ' + res.status);
  } catch (e) {
    console.error('Failed to save shared HMS database to MySQL backend:', e);
  }
}

// Session & Auth Persistence Logic
const CAREBRIDGE_SESSION_KEY = 'carebridge_user_session';
let lastHmsDbRaw = null;

function saveCarebridgeSession(roleType, activeTab) {
  const admissionId = document.getElementById('authAdmissionInput')?.value || '26CAR001';
  const phone = document.getElementById('authPhoneInput')?.value || '+91 98765 43210';
  const session = {
    isAuthenticated: true,
    roleType: roleType || selectedRoleType || 'primary',
    phone: phone,
    admissionId: admissionId,
    activeTab: activeTab || getActiveTabId() || 'dashboard'
  };
  try {
    localStorage.setItem(CAREBRIDGE_SESSION_KEY, JSON.stringify(session));
  } catch (e) {
    console.error('Failed to save session:', e);
  }
}

function getCarebridgeSession() {
  try {
    const stored = localStorage.getItem(CAREBRIDGE_SESSION_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to load session:', e);
  }
  return null;
}

function clearCarebridgeSession() {
  try {
    localStorage.removeItem(CAREBRIDGE_SESSION_KEY);
  } catch (e) {}
}

function getActiveTabId() {
  const activeTabElem = document.querySelector('.tab-content.active');
  if (activeTabElem && activeTabElem.id) {
    return activeTabElem.id.replace('tab-', '');
  }
  return 'dashboard';
}

function restoreCarebridgeSession() {
  const session = getCarebridgeSession();
  if (session && session.isAuthenticated) {
    selectedRoleType = session.roleType || 'primary';
    isPrimaryCaregiver = (selectedRoleType === 'primary');
    applyRolePermissions();
    const tabToRestore = (session.activeTab && session.activeTab !== 'auth') ? session.activeTab : 'dashboard';
    switchTab(tabToRestore, false);
  } else {
    switchTab('auth', false);
  }
}

function signOutCarebridge() {
  clearCarebridgeSession();
  selectedRoleType = 'primary';
  isPrimaryCaregiver = true;
  const pDetailsCard = document.getElementById('patientDetailsAuthCard');
  if (pDetailsCard) pDetailsCard.style.display = 'none';
  const otpGroup = document.getElementById('otpInputGroup');
  if (otpGroup) otpGroup.style.display = 'none';
  const sendBtn = document.getElementById('sendOtpBtn');
  if (sendBtn) sendBtn.innerText = 'Send Phone OTP & Fetch Details';
  switchTab('auth', false);
}

// Real-Time Cross-App Sync & Polling Handler (now backed by MySQL via the API)
async function checkHmsDatabaseUpdates() {
  const fresh = await fetchCarebridgeHmsDatabase();
  if (!fresh) return;
  const freshRaw = JSON.stringify(fresh);
  if (freshRaw !== lastHmsDbRaw) {
    lastHmsDbRaw = freshRaw;
    renderCarebridgeApp();
  }
}

// App Initialization & Rendering
document.addEventListener('DOMContentLoaded', async () => {
  await fetchCarebridgeHmsDatabase();
  lastHmsDbRaw = JSON.stringify(carebridgeHmsDb);
  renderCarebridgeApp();
  restoreCarebridgeSession();
  // Poll the backend every few seconds so updates made by HMS staff
  // (new treatment notes, lab reports, prescriptions, billing) appear
  // here automatically without a manual refresh.
  setInterval(checkHmsDatabaseUpdates, 4000);
});

function renderCarebridgeApp() {
  const db = getCarebridgeHmsDatabase();
  if (!db) return;

  renderMobileDashboard(db);
  renderMobileTimeline(db);
  renderMobileLabReports(db);
  renderMobilePrescriptions(db);
  renderMobileBilling(db);
  renderMobileInsurance(db);
}

function getCurrentPatient(db) {
  if (!db || !db.patients || db.patients.length === 0) return null;
  const session = getCarebridgeSession();
  const targetAdm = (session?.admissionId || document.getElementById('authAdmissionInput')?.value || '').trim();
  if (targetAdm) {
    const match = db.patients.find(p => p.admissionId && p.admissionId.toUpperCase() === targetAdm.toUpperCase());
    if (match) return match;
  }
  return db.patients[0];
}

function renderMobileDashboard(db) {
  const patient = getCurrentPatient(db);
  if (!patient) return;

  // Update Patient Banner & Structured IDs
  const pName = document.getElementById('dashPatientName');
  if (pName) pName.innerText = patient.fullName;

  const pId = document.getElementById('dashPatientId');
  if (pId) pId.innerText = patient.patientId || '26PAT0001';

  const admId = document.getElementById('dashAdmissionId');
  if (admId) admId.innerText = patient.admissionId || '26CAR001';

  const room = document.getElementById('dashRoomNumber');
  if (room) room.innerText = patient.roomNumber || 'General Ward';

  const phone = document.getElementById('dashPatientPhone');
  if (phone) phone.innerText = patient.patientPhone || patient.caregiverPhone || '+91 98111 22334';

  const doctor = document.getElementById('dashAttendingDoctor');
  if (doctor) doctor.innerText = (patient.attendingDoctor || 'Attending Physician') + (patient.department ? ` (${patient.department})` : '');

  // Doctor Instruction Card (filtered for this patient's admission)
  const patientTreatments = (db.treatments || []).filter(t => !t.admissionId || t.admissionId === patient.admissionId);
  const latestTrt = patientTreatments.length > 0 ? patientTreatments[0] : (db.treatments && db.treatments[0]);
  if (latestTrt) {
    const docNoteContainer = document.getElementById('dashDoctorNoteCard');
    if (docNoteContainer) {
      docNoteContainer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div style="font-size: 15px; font-weight: 700;">${latestTrt.doctorName} (${latestTrt.dept})</div>
          <span class="role-pill pill-info">${latestTrt.date}</span>
        </div>
        <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.4;">
          ${latestTrt.note}
        </p>
        <div style="font-size: 11px; font-weight: 700; color: var(--primary-dark); margin-top: 8px; background: var(--primary-light); padding: 6px 10px; border-radius: 6px;">
          Vitals: ${latestTrt.vitals}
        </div>
      `;
    }
  }

  // Billing Quick Balance
  const dashBal = document.getElementById('dashboardBalance');
  if (dashBal && db.billing) {
    dashBal.innerText = `₹${db.billing.remainingPayable.toFixed(2)}`;
  }
}

function renderMobileTimeline(db) {
  const container = document.getElementById('mobileTimelineContainer');
  if (!container || !db.treatments) return;
  const patient = getCurrentPatient(db);
  const patientTreatments = patient ? db.treatments.filter(t => !t.admissionId || t.admissionId === patient.admissionId) : db.treatments;
  const list = patientTreatments.length > 0 ? patientTreatments : db.treatments;

  let html = '';
  list.forEach((t, idx) => {
    const isFirst = idx === 0;
    html += `
      <div class="timeline-item">
        <div class="timeline-line">
          <div class="timeline-dot" style="${isFirst ? '' : 'background: var(--secondary);'}"></div>
          <div class="timeline-connector"></div>
        </div>
        <div class="card" style="flex: 1;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-weight: 700; color: ${isFirst ? 'var(--primary)' : 'var(--secondary)'}; font-size: 13px;">${t.date}</span>
            <span class="role-pill pill-info">${t.dept}</span>
          </div>
          <div style="font-weight: 700; font-size: 14px;">${t.doctorName}</div>
          <div style="font-size: 13px; color: var(--text-secondary); margin: 6px 0; line-height: 1.4;">
            ${t.note}
          </div>
          <div style="font-size: 11px; font-weight: 600; color: var(--primary); margin-top: 4px;">
            ${t.vitals}
          </div>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

function renderMobileLabReports(db) {
  const container = document.getElementById('mobileLabReportsContainer');
  if (!container || !db.labReports) return;
  const patient = getCurrentPatient(db);
  const patientReports = patient ? db.labReports.filter(r => !r.admissionId || r.admissionId === patient.admissionId) : db.labReports;
  const list = patientReports.length > 0 ? patientReports : db.labReports;

  let html = '';
  list.forEach(r => {
    let pillClass = 'pill-success';
    if (r.badgeClass && r.badgeClass.includes('warning')) pillClass = 'pill-warning';
    if (r.badgeClass && r.badgeClass.includes('danger')) pillClass = 'pill-danger';

    html += `
      <div class="card" style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
        <i class="fa-solid fa-file-pdf" style="font-size: 32px; color: ${pillClass === 'pill-warning' ? 'var(--warning)' : (pillClass === 'pill-danger' ? 'var(--danger)' : 'var(--primary)')};"></i>
        <div style="flex: 1;">
          <div style="font-weight: 700; font-size: 14px;">${r.title}</div>
          <div style="font-size: 12px; color: var(--text-secondary);">${r.category} • Ref: <code>${r.id}</code></div>
          <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">${r.notes}</div>
          <span class="role-pill ${pillClass}" style="margin-top: 4px; display: inline-block;">${r.status}</span>
        </div>
        <button class="icon-btn" onclick="alert('Downloading ${r.title} PDF report...')"><i class="fa-solid fa-download"></i></button>
      </div>
    `;
  });
  container.innerHTML = html;
}

function renderMobilePrescriptions(db) {
  const container = document.getElementById('mobilePrescriptionsContainer');
  const pickupBadge = document.getElementById('pickupBadge');
  if (!container || !db.prescriptions) return;
  const patient = getCurrentPatient(db);
  const patientPrescriptions = patient ? db.prescriptions.filter(r => !r.admissionId || r.admissionId === patient.admissionId) : db.prescriptions;
  const list = patientPrescriptions.length > 0 ? patientPrescriptions : db.prescriptions;

  let pendingCount = 0;
  let html = '';

  list.forEach((rx, index) => {
    if (!rx.isCollected) pendingCount++;
    const isCollected = rx.isCollected;

    html += `
      <div class="card" style="border: 1.5px solid ${isCollected ? 'var(--border)' : 'var(--warning)'}; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
          <div>
            <div style="font-weight: 700; font-size: 15px;">${rx.name}</div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 1px;">
              <span>ID: <strong>${rx.prescriptionId || rx.id}</strong></span>
              ${rx.prescriptionDate ? ` &bull; <span>Date: ${rx.prescriptionDate}</span>` : ''}
            </div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">${rx.instructions || 'Prescribed by Hospital Physician'}</div>
          </div>
          <span class="role-pill ${isCollected ? 'pill-success' : 'pill-warning'}">${rx.status}</span>
        </div>
        <div style="font-size: 13px; font-weight: 600; color: var(--primary); margin-top: 4px;">
          <i class="fa-solid fa-clock"></i> ${rx.dosage}${rx.frequency ? ` &bull; ${rx.frequency}` : ''}${rx.route || rx.intake ? ` (${rx.route || rx.intake})` : ''}
        </div>
        <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">Duration: ${rx.duration}</div>

        <div style="background: var(--surface-variant); padding: 8px 10px; border-radius: 8px; margin: 10px 0; font-size: 11px;">
          <div style="display: flex; justify-content: space-between;">
            <span>Pickup: <strong>${rx.counter}</strong></span>
            <span>Token: <strong>${rx.token}</strong></span>
          </div>
          <div style="font-size: 11px; color: ${isCollected ? 'var(--success)' : 'var(--text-secondary)'}; margin-top: 4px; font-weight: ${isCollected ? '700' : '400'};">
            ${isCollected ? 'Collected by Caregiver' : 'Status: Awaiting Caregiver Pickup at Counter'}
          </div>
        </div>

        <button class="btn ${isCollected ? 'btn-outline' : ''}" style="${isCollected ? 'padding: 8px; font-size: 12px;' : 'background: var(--warning); padding: 10px; font-size: 13px;'}" onclick="toggleWebMedicineCollection(${index})">
          <i class="fa-solid ${isCollected ? 'fa-circle-check' : 'fa-bag-shopping'}"></i> ${isCollected ? 'Collected by Caregiver (Click to Reset)' : 'Mark as Collected at Pharmacy'}
        </button>
      </div>
    `;
  });

  container.innerHTML = html;

  if (pickupBadge) {
    if (pendingCount > 0) {
      pickupBadge.innerText = `${pendingCount} Ready for Pickup`;
      pickupBadge.className = 'role-pill pill-warning';
    } else {
      pickupBadge.innerText = 'All Collected';
      pickupBadge.className = 'role-pill pill-success';
    }
  }
}

function toggleWebMedicineCollection(index) {
  if (!carebridgeHmsDb || !carebridgeHmsDb.prescriptions) getCarebridgeHmsDatabase();
  if (!carebridgeHmsDb || !carebridgeHmsDb.prescriptions[index]) return;

  const rx = carebridgeHmsDb.prescriptions[index];
  rx.isCollected = !rx.isCollected;
  if (rx.isCollected) {
    rx.status = 'Collected by Caregiver';
    rx.badgeClass = 'badge-success';
  } else {
    rx.status = 'Ready for Collection';
    rx.badgeClass = 'badge-warning';
  }

  saveCarebridgeHmsDatabase();
  renderCarebridgeApp();

  alert(`Medicine ${rx.name} collection status updated! Synchronized live with HMS Pharmacy counter.`);
}

function renderMobileBilling(db) {
  const totalElem = document.getElementById('billingTabTotal');
  const insElem = document.getElementById('billingTabInsurance');
  const balElem = document.getElementById('billingTabBalance');
  const breakdown = document.getElementById('mobileBillBreakdownContainer');

  if (db.billing) {
    if (totalElem) totalElem.innerText = `₹${db.billing.totalBill.toFixed(2)}`;
    if (insElem) insElem.innerText = `₹${db.billing.insuranceCovered.toFixed(2)}`;
    if (balElem) balElem.innerText = `₹${db.billing.remainingPayable.toFixed(2)}`;

    if (breakdown && db.billing.items) {
      let html = '';
      db.billing.items.forEach(item => {
        html += `
          <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px;">
            <span>${item.desc}</span>
            <span style="font-weight: 700;">₹${item.amount.toFixed(2)}</span>
          </div>
        `;
      });
      breakdown.innerHTML = html;
    }
  }
}

function renderMobileInsurance(db) {
  const container = document.getElementById('mobileInsuranceContainer');
  if (!container || !db.billing) return;

  const status = db.billing.claimStatus || 'Approved';
  const steps = [
    { title: '1. Claim Submitted', time: '13 Aug 10:00 AM' },
    { title: '2. Under Review', time: '13 Aug 02:30 PM' },
    { title: '3. Approved (₹50,000)', time: '14 Aug 09:15 AM' },
    { title: '4. Discharge Settlement', time: 'Pending Discharge' }
  ];

  let currentStepIdx = 2; // default approved
  if (status === 'Submitted') currentStepIdx = 0;
  if (status === 'Under Review') currentStepIdx = 1;
  if (status === 'Approved') currentStepIdx = 2;
  if (status === 'Settled') currentStepIdx = 3;

  let html = `
    <div class="card" style="margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
        <span style="font-weight: 700;">Star Health Mediclaim</span>
        <span class="role-pill pill-success">${status}</span>
      </div>
      <div style="font-size: 12px; color: var(--text-secondary);">Policy: SH-9948210394 | Claim: CLM-2026-778</div>
      <div style="font-size: 14px; font-weight: 700; color: var(--success); margin-top: 8px;">Pre-Approved Amount: ₹${db.billing.insuranceCovered.toFixed(2)}</div>
    </div>

    <div>
  `;

  steps.forEach((step, idx) => {
    const isCompleted = idx <= currentStepIdx;
    const isCurrent = idx === currentStepIdx;

    html += `
      <div style="display: flex; gap: 12px; align-items: flex-start; margin-bottom: 12px;">
        <i class="fa-solid ${isCompleted ? 'fa-circle-check' : 'fa-regular fa-circle'}" style="color: ${isCompleted ? (isCurrent ? 'var(--success)' : 'var(--primary)') : 'var(--text-muted)'}; margin-top: 2px;"></i>
        <div>
          <div style="font-weight: 700; font-size: 14px; color: ${isCompleted ? (isCurrent ? 'var(--success)' : 'var(--text-primary)') : 'var(--text-muted)'};">${step.title}</div>
          <div style="font-size: 12px; color: var(--text-secondary);">${step.time}</div>
        </div>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;
}

// Navigation & Auth Logic
async function switchTab(tabId, saveSession = true) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  
  const target = document.getElementById('tab-' + tabId);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  const navMap = { 'dashboard': 0, 'timeline': 1, 'reports': 2, 'prescriptions': 3, 'map': 4, 'billing': 5 };
  if (navMap[tabId] !== undefined) {
    document.querySelectorAll('.nav-item')[navMap[tabId]].classList.add('active');
  }

  if (tabId === 'map') {
    selectMapFloor(currentSelectedFloor);
  } else if (tabId === 'reports') {
    // Req 6.1: Fetch fresh data from backend with loading state
    refreshReportsTab();
  } else if (tabId === 'prescriptions') {
    // Req 6.1: Fetch fresh data from backend with loading state
    refreshPrescriptionsTab();
  }

  if (saveSession && tabId !== 'auth') {
    const session = getCarebridgeSession();
    if (session && session.isAuthenticated) {
      saveCarebridgeSession(selectedRoleType, tabId);
    }
  }
}

// Req 6.1: Fresh fetch handlers for Reports & Prescriptions
async function refreshReportsTab() {
  const container = document.getElementById('mobileLabReportsContainer');
  const icon = document.getElementById('refreshReportsIcon');
  if (icon) icon.classList.add('fa-spin');
  if (container) {
    container.innerHTML = `
      <div style="text-align: center; padding: 32px 16px; color: var(--primary);">
        <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 28px;"></i>
        <div style="font-size: 13px; font-weight: 600; margin-top: 10px; color: var(--text-secondary);">Fetching latest lab reports...</div>
      </div>
    `;
  }
  try {
    const fresh = await fetchCarebridgeHmsDatabase();
    if (fresh) {
      lastHmsDbRaw = JSON.stringify(fresh);
      renderMobileLabReports(fresh);
    } else if (carebridgeHmsDb) {
      renderMobileLabReports(carebridgeHmsDb);
    }
  } finally {
    if (icon) icon.classList.remove('fa-spin');
  }
}

async function refreshPrescriptionsTab() {
  const container = document.getElementById('mobilePrescriptionsContainer');
  const icon = document.getElementById('refreshPrescriptionsIcon');
  if (icon) icon.classList.add('fa-spin');
  if (container) {
    container.innerHTML = `
      <div style="text-align: center; padding: 32px 16px; color: var(--primary);">
        <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 28px;"></i>
        <div style="font-size: 13px; font-weight: 600; margin-top: 10px; color: var(--text-secondary);">Fetching latest prescriptions...</div>
      </div>
    `;
  }
  try {
    const fresh = await fetchCarebridgeHmsDatabase();
    if (fresh) {
      lastHmsDbRaw = JSON.stringify(fresh);
      renderMobilePrescriptions(fresh);
    } else if (carebridgeHmsDb) {
      renderMobilePrescriptions(carebridgeHmsDb);
    }
  } finally {
    if (icon) icon.classList.remove('fa-spin');
  }
}

function selectMapFloor(floor) {
  currentSelectedFloor = floor;
  const mapTitle = document.getElementById('mapFloorTitle');
  if (mapTitle) mapTitle.innerText = floor + ' Blueprint';

  ['Ground', '1st', '2nd', '3rd', 'B1'].forEach(fKey => {
    const btn = document.getElementById('floorBtn' + fKey);
    if (btn) {
      if (floor.includes(fKey)) {
        btn.style.background = 'var(--primary)';
        btn.style.color = 'white';
      } else {
        btn.style.background = 'transparent';
        btn.style.color = 'var(--primary)';
      }
    }
  });

  const filtered = hospitalFacilitiesData.filter(f => f.floor === floor);
  const container = document.getElementById('facilitiesListContainer');
  if (!container) return;

  if (filtered.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 20px; font-size: 13px;">No public facilities listed on this floor level.</div>';
    return;
  }

  let html = '';
  filtered.forEach(f => {
    html += `
      <div class="card" style="display: flex; gap: 12px; align-items: flex-start; margin-bottom: 8px;">
        <div style="width: 40px; height: 40px; background: ${f.color}20; color: ${f.color}; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px;">
          <i class="fa-solid ${f.icon}"></i>
        </div>
        <div style="flex: 1;">
          <div style="font-weight: 700; font-size: 14px;">${f.name}</div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;"><strong>${f.location}</strong> • ${f.floor}</div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${f.notes}</div>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

function selectWebAccount(phone, roleType) {
  document.getElementById('authPhoneInput').value = phone;
  selectedRoleType = roleType;
  triggerSendOtp();
}

function triggerSendOtp() {
  const admissionId = (document.getElementById('authAdmissionInput').value || '').trim();
  const phone = (document.getElementById('authPhoneInput').value || '').trim();

  if (!admissionId || !phone) {
    alert('Please enter Admission ID and Phone Number.');
    return;
  }

  const patient = getCurrentPatient(carebridgeHmsDb);
  if (patient) {
    const authName = document.getElementById('authPatientName');
    if (authName) authName.innerText = patient.fullName;
    const authPid = document.getElementById('authPatientId');
    if (authPid) authPid.innerText = patient.patientId || '26PAT0001';
    const authAdm = document.getElementById('authAdmissionId');
    if (authAdm) authAdm.innerText = patient.admissionId || admissionId;
    const authRoom = document.getElementById('authPatientRoom');
    if (authRoom) authRoom.innerText = patient.roomNumber || 'General Ward';
    const authPhone = document.getElementById('authPatientPhone');
    if (authPhone) authPhone.innerText = patient.patientPhone || patient.caregiverPhone || phone;
    const authDoc = document.getElementById('authAttendingDoctor');
    if (authDoc) authDoc.innerText = (patient.attendingDoctor || 'Attending Physician') + (patient.department ? ` (${patient.department})` : '');
  }

  if (phone.includes('98123') || selectedRoleType === 'family') {
    selectedRoleType = 'family';
  } else {
    selectedRoleType = 'primary';
  }

  document.getElementById('sendOtpBtn').innerText = 'OTP Sent via SMS (784291)';
  document.getElementById('patientDetailsAuthCard').style.display = 'block';
  document.getElementById('otpInputGroup').style.display = 'block';
}

function completeOtpLogin() {
  const otp = document.getElementById('authOtpCode').value;
  if (otp.length < 6) {
    alert('Please enter 6-digit OTP code.');
    return;
  }

  isPrimaryCaregiver = (selectedRoleType === 'primary');
  applyRolePermissions();
  saveCarebridgeSession(selectedRoleType, 'dashboard');

  alert('Phone OTP Verified!\nLogged in as ' + (isPrimaryCaregiver ? 'Primary Caregiver (Full Access)' : 'Invited Family Member (Read-Only Access)'));
  switchTab('dashboard');
}

function applyRolePermissions() {
  const payNowBtn = document.getElementById('payNowBtn');
  const billingPayBtn = document.getElementById('billingPayBtn');
  const inviteBtn = document.getElementById('inviteBtn');
  const profileUserName = document.getElementById('profileUserName');
  const profileUserPhone = document.getElementById('profileUserPhone');
  const profileUserRoleBadge = document.getElementById('profileUserRoleBadge');

  if (isPrimaryCaregiver) {
    if (payNowBtn) payNowBtn.style.display = 'block';
    if (billingPayBtn) billingPayBtn.style.display = 'block';
    if (inviteBtn) inviteBtn.style.display = 'block';
    if (profileUserName) profileUserName.innerText = 'Sarah Vance (Primary Caregiver)';
    if (profileUserPhone) profileUserPhone.innerText = 'Registered Mobile: +91 98765 43210';
    if (profileUserRoleBadge) {
      profileUserRoleBadge.innerText = 'Primary Caregiver (Full Access)';
      profileUserRoleBadge.className = 'role-pill pill-success';
    }
  } else {
    if (payNowBtn) payNowBtn.style.display = 'none';
    if (billingPayBtn) billingPayBtn.style.display = 'none';
    if (inviteBtn) inviteBtn.style.display = 'none';
    if (profileUserName) profileUserName.innerText = 'David Vance (Invited Family Member)';
    if (profileUserPhone) profileUserPhone.innerText = 'Registered Mobile: +91 98123 76543';
    if (profileUserRoleBadge) {
      profileUserRoleBadge.innerText = 'Family Member (Read-Only View)';
      profileUserRoleBadge.className = 'role-pill pill-neutral';
    }
  }
}

function openPaymentModal() {
  if (!isPrimaryCaregiver) {
    alert('Read-Only family members cannot initiate payments.');
    return;
  }
  document.getElementById('paymentModal').classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

function processPayment() {
  const method = document.querySelector('input[name="payMethod"]:checked').value;
  const txId = 'TXN-' + Math.floor(100000 + Math.random() * 900000);

  closeModal('paymentModal');

  if (!carebridgeHmsDb) getCarebridgeHmsDatabase();
  if (carebridgeHmsDb && carebridgeHmsDb.billing) {
    const paidAmt = carebridgeHmsDb.billing.remainingPayable;
    carebridgeHmsDb.billing.remainingPayable = 0.00;
    carebridgeHmsDb.payments.unshift({
      txId: txId,
      date: 'Today',
      method: method + ' (Caregiver App)',
      amount: paidAmt,
      status: 'Paid'
    });
    saveCarebridgeHmsDatabase();
    renderCarebridgeApp();
  }

  document.getElementById('rcptTxId').innerText = txId;
  const payNowBtn = document.getElementById('payNowBtn');
  const billingPayBtn = document.getElementById('billingPayBtn');
  if (payNowBtn) payNowBtn.style.display = 'none';
  if (billingPayBtn) billingPayBtn.style.display = 'none';

  setTimeout(() => {
    document.getElementById('receiptModal').classList.add('active');
  }, 300);
}

function inviteMember() {
  const name = prompt('Enter family member full name:');
  if (name) {
    alert('SMS invitation sent to ' + name + ' with Read-Only access permissions.');
  }
}



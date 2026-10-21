// Shared Hospital Management System (HMS) & CareBridge Data Engine
// Handles live CRUD operations across all hospital staff departments
//
// This now talks to the shared Node/Express + MySQL backend
// (carebridge_backend) instead of localStorage, so the HMS web portal
// and the CareBridge mobile app read/write the exact same database.

// Point this at wherever carebridge_backend is running. If you're
// opening this HMS portal from another device (not the same PC as the
// backend), replace 'localhost' with that PC's LAN IP address, e.g.
// 'http://192.168.1.5:8080'.
const HMS_API_BASE = 'http://localhost:8080';

// Local in-memory working copy of the shared database, kept in sync
// with MySQL via loadHmsDatabase()/saveHmsDatabase() below. Falls back
// to this seed data only until the first successful fetch completes.
let hmsDatabase = {
  patients: [
    {
      admissionId: '26CAR001',
      patientId: '26PAT0001',
      fullName: 'Meenakshi Ravi',
      ageGender: '58 Years • Female (A+)',
      patientPhone: '+91 98111 22334',
      roomNumber: 'ICU Room 304',
      attendingDoctor: 'Dr. Aris Thorne (Cardiology)',
      status: 'ADMITTED',
      caregiverName: 'Priya Lakshmi',
      caregiverId: 'CG-991823',
      caregiverPhone: '+91 98765 43210',
      relation: 'Daughter',
      admissionType: 'Emergency',
      reasonForAdmission: 'Post-operative observation and recovery',
      emergencyContactName: 'Karthik Raj',
      emergencyContactPhone: '+91 98761 23456',
      emergencyContactRelation: 'Other',
      carebridgeStatus: 'Active',
      carebridgeAccess: 'Active',
      admissionDate: '2026-08-30',
      admissionTime: '09:42'
    }
  ],
  treatments: [
    {
      id: 1,
      admissionId: '26CAR001',
      doctorName: 'Dr. Aris Thorne',
      dept: 'Cardiology Dept',
      date: 'Today 09:30 AM',
      note: 'Patient responding exceptionally well to IV Ceftriaxone. SpO2 stable at 98%. Maintain light liquid diet and monitor blood pressure every 4 hours.',
      vitals: 'BP: 120/80 mmHg | HR: 74 bpm | SpO2: 98% | Temp: 98.6°F'
    },
    {
      id: 2,
      admissionId: '26CAR001',
      doctorName: 'Dr. Elena Rostova',
      dept: 'Pulmonology Dept',
      date: 'Yesterday 06:00 PM',
      note: 'Nebulization completed. Patient reported reduced breathlessness. Recommended light walking in corridor.',
      vitals: 'BP: 124/82 mmHg | HR: 78 bpm | SpO2: 97% | Temp: 98.4°F'
    }
  ],
  labReports: [
    {
      id: 'LAB-9921',
      admissionId: '26CAR001',
      title: 'Complete Blood Count (CBC)',
      category: 'Pathology',
      status: 'Normal',
      badgeClass: 'badge-success',
      notes: 'WBC and Platelets within normal limits. Hemoglobin: 13.8 g/dL.'
    },
    {
      id: 'LAB-9925',
      admissionId: '26CAR001',
      title: 'Cardiac Enzymes (Troponin T)',
      category: 'Biochemistry',
      status: 'Elevated (Monitored)',
      badgeClass: 'badge-warning',
      notes: 'Troponin T levels elevated at admission, dropping steadily on day 2.'
    }
  ],
  prescriptions: [
    {
      id: 'RX-101',
      admissionId: '26CAR001',
      name: 'Ceftriaxone 1g Injection (IV)',
      dosage: '1g Once Daily (09:00 AM)',
      duration: '5 Days Pack',
      counter: 'Ground Floor Counter 3',
      token: 'PH-4082',
      status: 'Ready for Collection',
      badgeClass: 'badge-warning',
      instructions: 'Administer slowly via IV line under nursing supervision.',
      isCollected: false
    },
    {
      id: 'RX-102',
      admissionId: '26CAR001',
      name: 'Atorvastatin 20mg Tablet',
      dosage: '1 tablet at bedtime (09:00 PM)',
      duration: '30 Tablets Pack',
      counter: 'Ground Floor Counter 3',
      token: 'PH-4079',
      status: 'Collected by Caregiver',
      badgeClass: 'badge-success',
      instructions: 'Take after dinner with water.',
      isCollected: true
    }
  ],
  billing: {
    totalBill: 64500.00,
    insuranceCovered: 50000.00,
    remainingPayable: 14500.00,
    claimStatus: 'Approved',
    items: [
      { desc: 'ICU Room Charges (3 Days @ ₹12,000/day)', category: 'Room Rent', amount: 36000.00 },
      { desc: 'Doctor & Consultant Fee (Cardiology)', category: 'Consultation', amount: 12000.00 },
      { desc: 'Pharmacy & IV Medications', category: 'Pharmacy', amount: 8500.00 },
      { desc: 'Laboratory & CT Diagnostics', category: 'Diagnostics', amount: 8000.00 }
    ]
  },
  payments: [
    { txId: 'TXN-991823', date: '13 Aug 2026', method: 'UPI (Google Pay)', amount: 10000.00, status: 'Paid' }
  ]
};

let backendActiveAdmissions = [];
let backendAdmissions = [];
let backendObservations = [];
let backendSchedules = [];
let backendPrescriptions = [];
let backendPharmacyOrders = [];
let backendLabReports = [];
let backendMedicines = [];
let backendLabAssignments = [];
let dutyNurseSelectedInvestigations = [];
let activeAdmissionsLoadInProgress = false;

// Real-Time Cross-App Sync Engine (REST calls to the shared MySQL backend)
// A connection indicator element (id="hmsDbConnStatus") is optional —
// updateHmsConnStatus() no-ops if it isn't present in the page.
function updateHmsConnStatus(connected) {
  const el = document.getElementById('hmsDbConnStatus');
  if (!el) return;
  el.textContent = connected ? 'MySQL: Connected' : 'MySQL: Offline (retrying...)';
  el.style.color = connected ? 'var(--emerald-success)' : 'var(--rose-danger, #ef4444)';
}

// Push the current in-memory hmsDatabase to the backend, which persists
// it into MySQL. Every staff action calls this right after mutating
// hmsDatabase locally, so CareBridge sees the change on its next poll.
async function saveHmsDatabase() {
  try {
    const res = await fetch(`${HMS_API_BASE}/api/hms/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hmsDatabase),
    });
    if (!res.ok) throw new Error('Sync failed: ' + res.status);
    updateHmsConnStatus(true);
  } catch (e) {
    console.error('Failed to sync HMS database to MySQL backend:', e);
    updateHmsConnStatus(false);
  }
}

// Pull the latest shared state from MySQL (via the backend). Called on
// load and on a polling timer so changes made from the CareBridge app
// (payments, prescription pickups) show up here automatically.
async function loadHmsDatabase() {
  try {
    const res = await fetch(`${HMS_API_BASE}/api/hms/data`);
    if (!res.ok) throw new Error('Fetch failed: ' + res.status);
    const parsed = await res.json();
    if (parsed && parsed.patients && parsed.treatments) {
      hmsDatabase = parsed;
    }
    if (parsed && Array.isArray(parsed.medicines)) {
      backendMedicines = parsed.medicines;
    }
    if (parsed && Array.isArray(parsed.labAssignments)) {
      backendLabAssignments = parsed.labAssignments;
    }
    updateHmsConnStatus(true);
  } catch (e) {
    console.error('Failed to load HMS database from MySQL backend:', e);
    updateHmsConnStatus(false);
  }
}

async function loadBackendMedicines() {
  try {
    const res = await fetch(`${HMS_API_BASE}/api/hms/medicines`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        backendMedicines = data;
      }
    }
  } catch (err) {
    console.warn('Failed to load medicines from backend:', err);
  }
}

function getMedicineUnitPrice(medicineName) {
  if (!medicineName || !Array.isArray(backendMedicines) || backendMedicines.length === 0) {
    return 0;
  }
  const clean = str => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = clean(medicineName);

  // Exact match
  let found = backendMedicines.find(m => clean(m.name || m.medicineName) === target);

  // Partial / prefix match
  if (!found) {
    const targetFirst = target.split(' ')[0] || target;
    found = backendMedicines.find(m => {
      const candidate = clean(m.name || m.medicineName);
      return candidate.includes(target) || target.includes(candidate) || (targetFirst.length >= 4 && candidate.includes(targetFirst));
    });
  }

  if (found) {
    return Number(found.unitPrice || found.price) || 0;
  }
  return 0;
}

function calculatePrescriptionQuantity(dosage, frequency, duration) {
  let doseNum = 1;
  const doseMatch = String(dosage || '').match(/(\d+(\.\d+)?)/);
  if (doseMatch) {
    const parsed = parseFloat(doseMatch[1]);
    if (parsed > 0 && parsed <= 10) doseNum = parsed;
  }

  let freqPerDay = 1;
  const freqStr = String(frequency || dosage || '').toLowerCase();
  if (freqStr.includes('four') || freqStr.includes('qid') || freqStr.includes('4 times') || freqStr.includes('qds')) freqPerDay = 4;
  else if (freqStr.includes('thrice') || freqStr.includes('tid') || freqStr.includes('3 times') || freqStr.includes('tds')) freqPerDay = 3;
  else if (freqStr.includes('twice') || freqStr.includes('bid') || freqStr.includes('2 times') || freqStr.includes('bd')) freqPerDay = 2;
  else if (freqStr.includes('once') || freqStr.includes('od') || freqStr.includes('daily') || freqStr.includes('every 24')) freqPerDay = 1;
  else if (freqStr.includes('every 6 hours') || freqStr.includes('q6h')) freqPerDay = 4;
  else if (freqStr.includes('every 8 hours') || freqStr.includes('q8h')) freqPerDay = 3;
  else if (freqStr.includes('every 12 hours') || freqStr.includes('q12h')) freqPerDay = 2;

  let days = 5;
  const durStr = String(duration || '').toLowerCase();
  const durMatch = durStr.match(/(\d+)/);
  if (durMatch) {
    const num = parseInt(durMatch[1], 10);
    if (durStr.includes('month')) days = num * 30;
    else if (durStr.includes('week')) days = num * 7;
    else days = num;
  }

  return Math.max(1, Math.round(doseNum * freqPerDay * days));
}

function refreshPharmacyPrescriptionOptions() {
  const patSelect = document.getElementById('phmPatientSelect');
  if (patSelect && patSelect.value) {
    renderPharmacyPrescriptionsForAdmission(patSelect.value);
  }
}

async function loadBackendActiveAdmissions() {
  if (activeAdmissionsLoadInProgress) return;
  activeAdmissionsLoadInProgress = true;

  try {
    const patientsResponse = await fetch(`${HMS_API_BASE}/api/v1/patients`);
    const patients = await patientsResponse.json().catch(() => null);
    if (!patientsResponse.ok) {
      throw new Error(`Patient list request failed: HTTP ${patientsResponse.status}`);
    }
    if (!Array.isArray(patients)) {
      throw new Error('Patient list response was not an array.');
    }

    const admissionsByPatient = await Promise.all(patients.map(async patient => {
      const response = await fetch(`${HMS_API_BASE}/api/v1/patients/${encodeURIComponent(patient.patientId)}/admissions`);
      const admissions = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(`Admissions request failed for ${patient.patientId}: HTTP ${response.status}`);
      }
      if (!Array.isArray(admissions)) {
        throw new Error(`Admissions response for ${patient.patientId} was not an array.`);
      }

      return admissions.map(admission => {
          const caregiver = admission.caregiver || {};
          return {
            admissionId: admission.admissionId,
            patientId: admission.patientId,
            fullName: admission.patientName || patient.name || '',
            doctor: admission.doctor || '',
            department: admission.department || '',
            ageGender: `${admission.patientAge ?? ''} Years • ${admission.gender || 'Unknown'} (${patient.bloodGroup || 'N/A'})`,
            patientPhone: admission.phone || patient.phone || '',
            roomNumber: admission.room || '',
            attendingDoctor: (admission.doctor && admission.doctor.includes('(')) ? admission.doctor : (admission.doctor && admission.department ? `${admission.doctor} (${admission.department})` : (admission.doctor || '')),
            status: admission.status,
            caregiverName: caregiver.caregiverName || '',
            caregiverPhone: caregiver.caregiverMobile || '',
            relation: caregiver.relationship || 'Other',
            reasonForAdmission: admission.reason || '',
            carebridgeStatus: caregiver.accessStatus === 'ACTIVE' ? 'Active' : 'Not Activated',
            carebridgeAccess: caregiver.accessStatus || 'N/A',
            admissionDate: admission.admissionDate || '',
            admissionTime: ''
          };
        });
    }));

      const rawAdmissions = admissionsByPatient.flat();
      const admMap = new Map();
      for (const adm of rawAdmissions) {
        if (!admMap.has(adm.admissionId)) {
          admMap.set(adm.admissionId, adm);
        }
      }
      backendAdmissions = Array.from(admMap.values());
      backendActiveAdmissions = backendAdmissions.filter(admission => admission.status === 'ACTIVE');
      refreshPatientSelectors();
      updateRoomAvailabilityStatus();
      await Promise.all([
        loadBackendObservations(),
        loadBackendSchedules(),
        loadBackendPrescriptions(),
        loadBackendPharmacyOrders(),
        loadBackendLabReports()
      ]);
  } catch (error) {
    console.error('Failed to load active admissions from Spring Boot:', error);
  } finally {
    activeAdmissionsLoadInProgress = false;
  }
}

function updateRoomAvailabilityStatus() {
  const roomSelect = document.getElementById('admRoom');
  if (!roomSelect) return;
  const occupiedRooms = new Set(
    (backendActiveAdmissions || [])
      .map(a => (a.roomNumber || a.room || '').trim())
      .filter(Boolean)
  );

  Array.from(roomSelect.options).forEach(opt => {
    if (!opt.value) return;
    const cleanName = opt.value.replace(/\s*\((Occupied|Available)\)/gi, '').trim();
    opt.value = cleanName;
    if (occupiedRooms.has(cleanName)) {
      opt.textContent = `${cleanName} (Occupied)`;
      opt.disabled = true;
      opt.style.color = '#ef4444';
    } else {
      opt.textContent = `${cleanName} (Available)`;
      opt.disabled = false;
      opt.style.color = '#10b981';
    }
  });

  if (typeof roomSelect._renderCustomDropdown === 'function') {
    roomSelect._renderCustomDropdown();
  }
}

async function loadBackendObservations() {
  try {
    const observationsByAdmission = await Promise.all(backendAdmissions.map(async admission => {
      const response = await fetch(
        `${HMS_API_BASE}/api/v1/admissions/${encodeURIComponent(admission.admissionId)}/observations`,
        { headers: { 'X-Staff-Request': 'true' } }
      );
      const observations = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(`Observations request failed for ${admission.admissionId}: HTTP ${response.status}`);
      }
      if (!Array.isArray(observations)) {
        throw new Error(`Observations response for ${admission.admissionId} was not an array.`);
      }
      return observations;
    }));

    const rawObs = observationsByAdmission.flat().sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
    );
    const obsMap = new Map();
    for (const obs of rawObs) {
      const key = String(obs.id || `${obs.admissionId}_${obs.createdAt}`);
      if (!obsMap.has(key)) {
        obsMap.set(key, obs);
      }
    }
    backendObservations = Array.from(obsMap.values());
    renderDoctorFeed();
  } catch (error) {
    console.error('Failed to load observations from Spring Boot:', error);
  }
}

async function loadBackendSchedules() {
  try {
    const response = await fetch(`${HMS_API_BASE}/api/hms/appointments`);
    if (response.ok) {
      const records = await response.json();
      if (Array.isArray(records)) {
        const schedMap = new Map();
        for (const record of records) {
          const admission = (backendAdmissions || []).find(a => a.admissionId === record.admissionId) ||
                            (backendActiveAdmissions || []).find(a => a.admissionId === record.admissionId) ||
                            (hmsDatabase?.patients || []).find(p => p.admissionId === record.admissionId);
          const mapped = {
            ...record,
            recordId: record.id,
            id: record.id,
            admissionId: record.admissionId,
            patientId: record.patientId || (admission ? admission.patientId : 'N/A'),
            patientName: admission ? admission.fullName : (record.patientName || 'Patient'),
            doctor: record.doctorName,
            doctorName: record.doctorName,
            eventDate: record.appointmentDate,
            appointmentDate: record.appointmentDate,
            appointmentTime: record.appointmentTime,
            appointmentType: record.appointmentType,
            room: record.room,
            status: record.status || 'SCHEDULED'
          };
          const key = String(mapped.id || `${mapped.admissionId}_${mapped.appointmentDate}_${mapped.appointmentTime}`);
          if (!schedMap.has(key)) {
            schedMap.set(key, mapped);
          }
        }
        backendSchedules = Array.from(schedMap.values());
        renderScheduleRecords();
        return;
      }
    }
  } catch (error) {
    console.warn('Direct appointments fetch fallback to per-admission records:', error);
  }

  try {
    const schedulesByAdmission = await Promise.all((backendAdmissions || []).map(async admission => {
      const response = await fetch(
        `${HMS_API_BASE}/api/v1/admissions/${encodeURIComponent(admission.admissionId)}/records/schedule`,
        { headers: { 'X-Staff-Request': 'true' } }
      );
      const records = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(records)) return [];
      return records.map(record => {
        let schedule;
        try {
          schedule = JSON.parse(record.payload);
        } catch (_) {
          schedule = {};
        }
        return {
          ...schedule,
          recordId: record.id,
          id: record.id,
          admissionId: admission.admissionId,
          patientId: admission.patientId,
          patientName: admission.fullName,
          doctor: schedule.doctor || schedule.doctorName,
          doctorName: schedule.doctor || schedule.doctorName,
          appointmentDate: schedule.eventDate || schedule.appointmentDate,
          eventDate: schedule.eventDate || schedule.appointmentDate,
          appointmentTime: schedule.appointmentTime,
          appointmentType: schedule.appointmentType,
          room: schedule.room,
          status: schedule.status || 'SCHEDULED'
        };
      });
    }));
    const rawSchedules = schedulesByAdmission.flat();
    const schedFallbackMap = new Map();
    for (const sch of rawSchedules) {
      const key = String(sch.id || sch.recordId || `${sch.admissionId}_${sch.appointmentDate}_${sch.appointmentTime}`);
      if (!schedFallbackMap.has(key)) {
        schedFallbackMap.set(key, sch);
      }
    }
    backendSchedules = Array.from(schedFallbackMap.values());
    renderScheduleRecords();
  } catch (error) {
    console.error('Failed to load schedules fallback:', error);
  }
}

async function loadBackendPrescriptions() {
  try {
    const prescriptionsByAdmission = await Promise.all(backendAdmissions.map(async admission => {
      const response = await fetch(
        `${HMS_API_BASE}/api/v1/admissions/${encodeURIComponent(admission.admissionId)}/records/prescriptions`,
        { headers: { 'X-Staff-Request': 'true' } }
      );
      const records = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(`Prescription request failed for ${admission.admissionId}: HTTP ${response.status}`);
      }
      if (!Array.isArray(records)) {
        throw new Error(`Prescription response for ${admission.admissionId} was not an array.`);
      }
      return records.map(record => {
        let prescription;
        try {
          prescription = JSON.parse(record.payload);
        } catch (_) {
          prescription = {};
        }
        return {
          ...prescription,
          recordId: record.id,
          admissionId: admission.admissionId,
          patientId: admission.patientId,
          patientName: admission.fullName
        };
      });
    }));
    const rawRx = prescriptionsByAdmission.flat();
    const rxMap = new Map();
    for (const rx of rawRx) {
      const key = String(rx.prescriptionId || rx.id || rx.recordId || `${rx.admissionId}_${rx.medicineName || rx.name}`);
      if (!rxMap.has(key)) {
        rxMap.set(key, rx);
      }
    }
    backendPrescriptions = Array.from(rxMap.values());
    renderBackendPrescriptions();
    refreshPharmacyPrescriptionOptions();
  } catch (error) {
    console.error('Failed to load prescriptions from Spring Boot:', error);
  }
}

async function loadBackendPharmacyOrders() {
  try {
    const ordersByAdmission = await Promise.all(backendAdmissions.map(async admission => {
      const response = await fetch(
        `${HMS_API_BASE}/api/v1/admissions/${encodeURIComponent(admission.admissionId)}/records/pharmacy`,
        { headers: { 'X-Staff-Request': 'true' } }
      );
      const records = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(`Pharmacy request failed for ${admission.admissionId}: HTTP ${response.status}`);
      }
      if (!Array.isArray(records)) {
        throw new Error(`Pharmacy response for ${admission.admissionId} was not an array.`);
      }
      return records.map(record => {
        let order;
        try {
          order = JSON.parse(record.payload);
        } catch (_) {
          order = {};
        }
        return {
          ...order,
          recordId: record.id,
          admissionId: admission.admissionId,
          patientId: admission.patientId,
          patientName: admission.fullName
        };
      });
    }));
    const rawOrders = ordersByAdmission.flat();
    const orderMap = new Map();
    for (const ord of rawOrders) {
      const key = String(ord.orderId || ord.txId || ord.recordId || ord.id);
      if (!orderMap.has(key)) {
        orderMap.set(key, ord);
      }
    }
    backendPharmacyOrders = Array.from(orderMap.values());
    renderPharmacyQueue();
  } catch (error) {
    console.error('Failed to load pharmacy orders from Spring Boot:', error);
  }
}

async function loadBackendLabReports() {
  try {
    const reportsByAdmission = await Promise.all(backendAdmissions.map(async admission => {
      const recordsByType = await Promise.all(['tests', 'scans'].map(async resourceType => {
        const response = await fetch(
          `${HMS_API_BASE}/api/v1/admissions/${encodeURIComponent(admission.admissionId)}/records/${resourceType}`,
          { headers: { 'X-Staff-Request': 'true' } }
        );
        const records = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(`${resourceType} request failed for ${admission.admissionId}: HTTP ${response.status}`);
        }
        if (!Array.isArray(records)) {
          throw new Error(`${resourceType} response for ${admission.admissionId} was not an array.`);
        }
        return records.map(record => {
          let report;
          try {
            report = JSON.parse(record.payload);
          } catch (_) {
            report = {};
          }
          return {
            ...report,
            id: report.reportId || String(record.id),
            resourceType,
            admissionId: admission.admissionId,
            patientId: admission.patientId,
            patientName: admission.fullName
          };
        });
      }));
      return recordsByType.flat();
    }));
    const rawReports = reportsByAdmission.flat();
    const labMap = new Map();
    for (const rep of rawReports) {
      // Deduplicate by unique reportId / id or combination of admissionId and title
      const key = String(rep.reportId || rep.id || `${rep.admissionId}_${rep.title}`);
      if (!labMap.has(key)) {
        labMap.set(key, rep);
      }
    }
    backendLabReports = Array.from(labMap.values());
    renderLabReports();
  } catch (error) {
    console.error('Failed to load lab reports from Spring Boot:', error);
  }
}

function renderAllHmsViews() {
  renderActivePatients();
  refreshPatientSelectors();
  renderDoctorFeed();
  renderScheduleRecords();
  renderDoctorAssignedAppointments();
  renderBackendPrescriptions();
  renderLabReports();
  renderPharmacyTransactions();
  renderPaymentLedger();
  inspectTable('patients');
  if (typeof loadAndRenderNurseLabAssignments === 'function') {
    loadAndRenderNurseLabAssignments();
  }
}

// Look up a patient's display-friendly label/name by admissionId. Used
// wherever a record (treatment, lab report, etc.) needs to show which
// patient it belongs to.
function getPatientByAdmissionId(admissionId) {
  return hmsDatabase.patients.find(p => p.admissionId === admissionId);
}

function getPatientOptionLabel(p) {
  const patientId = p.patientId || 'P-000000';
  const admissionId = p.admissionId || 'ADM-0000';
  const room = p.roomNumber || p.room || 'Room N/A';
  return `${p.fullName} (PID: ${patientId} • ADM: ${admissionId} • ${room})`;
}

/**
 * Safely updates a <select> element's options without causing unnecessary DOM recreation,
 * focus loss, or selection resets.
 * 
 * @param {HTMLSelectElement|string} selectOrId - The select element or its ID
 * @param {Array<{value: string, text: string, disabled?: boolean}>} options - The new options list
 * @param {string} placeholder - The placeholder text representing 'no selection'
 * @param {boolean} [retainUnknownCurrent=false] - If true (e.g. in Edit mode), preserves current option even if not in options list
 */
function syncSelectOptions(selectOrId, options, placeholder, retainUnknownCurrent = false) {
  const select = typeof selectOrId === 'string' ? document.getElementById(selectOrId) : selectOrId;
  if (!select) return;

  const currentValue = select.value;
  const currentSelectedOption = select.selectedIndex >= 0 ? select.options[select.selectedIndex] : null;
  const currentText = currentSelectedOption ? currentSelectedOption.textContent : '';

  // Check if currentValue exists in the new options
  const hasCurrentInNew = (options || []).some(opt => String(opt.value) === String(currentValue));

  // Determine if we should preserve a custom/edit-mode option that isn't in options
  const shouldRetainCustom = retainUnknownCurrent && currentValue && !hasCurrentInNew;

  // Build desired options structure
  // First option is always the disabled placeholder representing "no selection"
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

  // Check if current select already matches desired options to avoid touching DOM
  const isMatch = select.options.length === desiredOptions.length &&
    Array.from(select.options).every((opt, i) =>
      opt.value === desiredOptions[i].value &&
      opt.textContent === desiredOptions[i].text &&
      opt.disabled === desiredOptions[i].disabled
    );

  if (!isMatch) {
    select.innerHTML = '';
    desiredOptions.forEach((opt) => {
      const optEl = document.createElement('option');
      optEl.value = opt.value;
      optEl.textContent = opt.text;
      if (opt.disabled) optEl.disabled = true;
      select.appendChild(optEl);
    });
  }

  // Restore selection
  if (currentValue && (hasCurrentInNew || shouldRetainCustom)) {
    select.value = currentValue;
  } else {
    // If previously selected option is no longer available/valid, reset to placeholder
    select.value = '';
  }
}

let lastPhmPatientAdmissionId = null;
let lastBillPatientAdmissionId = null;

// Fills every "Select Patient" dropdown in the portal with structured IDs
function refreshPatientSelectors() {
  const selectConfigs = [
    { id: 'trtPatientSelect', placeholder: 'Select Patient / Admission' },
    { id: 'labPatientSelect', placeholder: 'Select Patient / Admission' },
    { id: 'scheduleAdmissionSelect', placeholder: 'Select Patient / Admission', retainUnknown: true },
    { id: 'rxAdmissionSelect', placeholder: 'Select Patient / Admission' },
    { id: 'phmPatientSelect', placeholder: 'Select Patient / Admission' },
    { id: 'billAdmissionSelect', placeholder: 'Select Patient / Admission' }
  ];

  const patients = backendActiveAdmissions || [];
  const patientOptions = patients.map(p => ({
    value: p.admissionId,
    text: getPatientOptionLabel(p)
  }));

  selectConfigs.forEach(({ id, placeholder, retainUnknown }) => {
    const select = document.getElementById(id);
    if (!select) return;

    const prevValue = select.value;
    const isEditMode = (id === 'scheduleAdmissionSelect') && !!document.getElementById('scheduleRecordId')?.value;

    syncSelectOptions(select, patientOptions, placeholder, retainUnknown || isEditMode);

    const newValue = select.value;

    // Only update displays or call change handlers if the value ACTUALLY changed
    if (id === 'scheduleAdmissionSelect' && prevValue !== newValue) {
      updateScheduleDoctorDisplay();
    }
    if (id === 'rxAdmissionSelect' && prevValue !== newValue) {
      updatePrescriptionDoctorDisplay();
      if (typeof renderMostRecentPrescription === 'function') {
        renderMostRecentPrescription(newValue);
      }
    }
    if (id === 'trtPatientSelect' && prevValue !== newValue) {
      if (typeof renderVitalsHistory === 'function') {
        renderVitalsHistory(newValue);
      }
    }
    if (id === 'phmPatientSelect') {
      if (newValue !== lastPhmPatientAdmissionId) {
        lastPhmPatientAdmissionId = newValue;
        handlePhmPatientChange(false);
      }
    }
    if (id === 'billAdmissionSelect') {
      if (newValue !== lastBillPatientAdmissionId) {
        lastBillPatientAdmissionId = newValue;
        handleBillAdmissionChange(false);
      }
    }
    if (id === 'labPatientSelect' && prevValue !== newValue) {
      updateLabAssignedInvestigationsDropdown(newValue);
    }
  });

  if (typeof refreshNurseLabAssignmentPatientSelector === 'function') {
    refreshNurseLabAssignmentPatientSelector();
  }
}

// Poll the backend so updates made from the CareBridge mobile app
// (e.g. a caregiver paying a bill) appear here without a manual refresh.
setInterval(async () => {
  await loadHmsDatabase();
  renderAllHmsViews();
}, 4000);

setInterval(loadBackendActiveAdmissions, 30000);

// Department Staff Accounts & RBAC Data System
// (hmsStaffAccounts + HMS_STAFF_SESSION_KEY now live in auth.js, shared
// with login.html, so there's one source of truth for credentials.)
let activeStaff = hmsStaffAccounts.admin;

function loginHmsStaff(deptKey) {
  if (hmsStaffAccounts[deptKey]) {
    activeStaff = hmsStaffAccounts[deptKey];
    applyStaffPermissions();

    if (activeStaff.allowedDepts.includes(deptKey)) {
      switchDept(deptKey);
    } else if (activeStaff.allowedDepts.length > 0) {
      switchDept(activeStaff.allowedDepts[0]);
    }
  }
}

function logoutHmsStaff() {
  hmsClearSession();
  window.location.href = 'login.html';
}

function openStaffLoginModal() {
  logoutHmsStaff();
}

function closeStaffLoginModal() {
  const modal = document.getElementById('staffLoginModal');
  if (modal) modal.style.display = 'none';
}

function restoreStaffSession() {
  const saved = hmsGetSession();
  if (saved && hmsStaffAccounts[saved]) {
    loginHmsStaff(saved);
  } else {
    window.location.href = 'login.html';
  }
}

function applyStaffPermissions() {
  const nameElem = document.getElementById('staffUserName');
  const iconElem = document.getElementById('staffUserIcon');
  if (nameElem) nameElem.innerText = `${activeStaff.name} (${activeStaff.title})`;
  if (iconElem) iconElem.className = `fa-solid ${activeStaff.icon}`;

  // Populate the read-only doctor info display in the ward rounds form
  const doctorDisplay = document.getElementById('trtDoctorDisplay');
  const deptDisplay   = document.getElementById('trtDeptDisplay');
  if (doctorDisplay) doctorDisplay.textContent = activeStaff.name;
  if (deptDisplay)   deptDisplay.textContent   = activeStaff.title;

  const allDepts = ['reception', 'doctor', 'laboratory', 'pharmacy', 'billing', 'inspector'];
  allDepts.forEach(deptId => {
    const tabElem = document.getElementById('tab-nav-' + deptId);
    const lockSpan = document.getElementById('tab-lock-' + deptId);
    const isAllowed = activeStaff.allowedDepts.includes(deptId);

    if (!isAllowed) {
      if (lockSpan) lockSpan.innerHTML = ` <i class="fa-solid fa-lock" style="font-size: 11px; opacity: 0.7; color: var(--amber-warning);" title="Locked for ${activeStaff.title}"></i>`;
      if (tabElem) tabElem.style.opacity = '0.65';
    } else {
      if (lockSpan) lockSpan.innerHTML = '';
      if (tabElem) tabElem.style.opacity = '1';
    }
  });
}

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  const admitForm = document.getElementById('admitPatientForm');
  if (admitForm) {
    ['input', 'change'].forEach(eventName => admitForm.addEventListener(eventName, () => {
      if (!admissionSubmissionCompleted) return;
      admissionSubmissionCompleted = false;
      const submitButton = admitForm.querySelector('[type="submit"]');
      if (submitButton) submitButton.disabled = false;
    }));
  }
  await loadHmsDatabase();
  await loadBackendMedicines();
  await loadBackendActiveAdmissions();
  resetPrescriptionForm();
  resetPharmacyOrderForm();
  initScheduleDatePicker();
  resetScheduleForm();
  restoreStaffSession();
  updatePrescriptionDoctorDisplay();
  renderAllHmsViews();
  // Page 1: Auto-fill Admission Date/Time and attach DOB calculation listener (Req 1.1, 1.5)
  const admDtEl = document.getElementById('admDateTimeDisplay') || document.getElementById('admAdmissionDateTime');
  if (admDtEl) {
    admDtEl.value = formatCurrentDateTime();
    admDtEl.readOnly = true;
  }
  initDobPicker();
  const admDobEl = document.getElementById('admDob') || document.getElementById('admPatientDob');
  if (admDobEl) {
    ['input', 'change'].forEach(evt => admDobEl.addEventListener(evt, () => handleDobChange()));
  }
  updateRoomAvailabilityStatus();

  // Page 3: Attach dynamic listeners for Most Recent Prescription & Vitals History (Req 3.3, 3.4)
  const rxAdmSelect = document.getElementById('rxAdmissionSelect');
  if (rxAdmSelect) {
    rxAdmSelect.addEventListener('change', () => renderMostRecentPrescription(rxAdmSelect.value));
  }
  const trtPatSelect = document.getElementById('trtPatientSelect');
  if (trtPatSelect) {
    trtPatSelect.addEventListener('change', () => renderVitalsHistory(trtPatSelect.value));
  }

  const nurseLabSelect = document.getElementById('scheduleLabReportSelect');
  if (nurseLabSelect) {
    nurseLabSelect.addEventListener('change', () => {
      if (nurseLabSelect.value) {
        handleDutyNurseLabSelectChange(nurseLabSelect.value);
      }
    });
  }

  document.getElementById('scheduleTableBody')?.addEventListener('click', event => {
    const button = event.target.closest('[data-schedule-record-id]');
    if (button) editScheduleRecord(button.dataset.scheduleRecordId);
  });
  document.getElementById('pharmacyDispensingTbody')?.addEventListener('click', event => {
    const editButton = event.target.closest('[data-pharmacy-record-id]');
    if (editButton) {
      editPharmacyOrder(editButton.dataset.pharmacyRecordId);
      return;
    }
    const pickupButton = event.target.closest('[data-toggle-pickup-record-id]');
    if (pickupButton) toggleHmsPharmacyPickup(pickupButton.dataset.togglePickupRecordId);
  });
});

// Department Navigation Handler
function switchDept(deptId) {
  document.querySelectorAll('.dept-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.dept-view').forEach(v => v.classList.remove('active'));

  // Look up the tab by id instead of relying on the global `event` object,
  // so this works both from a click (onclick="switchDept('doctor')") and
  // when called programmatically on login (e.g. from restoreStaffSession()).
  const tab = document.getElementById('tab-nav-' + deptId);
  if (tab) tab.classList.add('active');
  const target = document.getElementById('dept-' + deptId);
  if (target) target.classList.add('active');
  if (deptId === 'reception') {
    initDobPicker();
  }
  if (deptId === 'nurse') {
    if (typeof refreshNurseLabAssignmentPatientSelector === 'function') {
      refreshNurseLabAssignmentPatientSelector();
    }
    if (typeof loadAndRenderNurseLabAssignments === 'function') {
      loadAndRenderNurseLabAssignments();
    }
  }
}

let admissionPatientLookup = { patientId: '', status: 'idle', requestId: 0 };
let admissionPatientLookupPromise = null;
let previousAdmissionCaregiver = null;
let caregiverSelectedFromPrevious = false;
let pendingNewPatient = null;
let admissionSubmissionInProgress = false;
let admissionSubmissionCompleted = false;

function setPatientLookupStatus(message) {
  const status = document.getElementById('admPatientLookupStatus');
  if (status) status.textContent = message;
}

function resetPreviousCaregiverSuggestion() {
  previousAdmissionCaregiver = null;
  caregiverSelectedFromPrevious = false;
  const panel = document.getElementById('previousCaregiverPanel');
  const choice = document.getElementById('previousCaregiverChoice');
  const status = document.getElementById('previousCaregiverStatus');
  if (panel) panel.style.display = 'none';
  if (choice) choice.style.display = 'none';
  if (status) status.textContent = '';
}

function formatPhoneNumberInput(el) {
  if (!el) return;
  let val = el.value.replace(/\D/g, '');
  if (val.length > 10 && val.startsWith('91')) {
    val = val.slice(2);
  }
  if (val.length > 10) val = val.slice(-10);
  el.value = val;
  if (val.length === 10 && typeof hmsClearFieldError === 'function') {
    hmsClearFieldError(el.id);
  }
}
window.formatPhoneNumberInput = formatPhoneNumberInput;

function setPatientFormEditable(editable) {
  ['admPatientName', 'admPatientAge', 'admPatientPhone', 'admDob'].forEach(id => {
    const input = document.getElementById(id);
    if (input) input.readOnly = !editable;
  });
  ['admPatientGender', 'admPatientBloodGroup'].forEach(id => {
    const field = document.getElementById(id);
    if (field) field.disabled = !editable;
  });
}

function handleAdmitDeptChange() {
  const deptEl = document.getElementById('admDepartment');
  const doctorEl = document.getElementById('admDoctor');
  if (!deptEl || !doctorEl) return;
  // If doctor is not yet chosen, suggest appropriate specialist based on department
  if (!doctorEl.value || doctorEl.selectedIndex === 0) {
    const dept = deptEl.value;
    if (dept.includes('Cardio') || dept.includes('Critical') || dept.includes('ICU')) doctorEl.value = 'Dr. Aris Thorne (Cardiology)';
    else if (dept.includes('Pulmo')) doctorEl.value = 'Dr. Elena Rostova (Pulmonology)';
    else doctorEl.value = 'Dr. Marcus Vance (Internal Med)';
    if (typeof doctorEl._renderCustomDropdown === 'function') {
      doctorEl._renderCustomDropdown();
    }
  }
}

function handleAdmitDoctorChange() {
  // Retains user-selected doctor intact
}

function handlePatientModeChange() {
  const mode = document.getElementById('admPatientMode').value;
  document.getElementById('admPatientMode').disabled = false;
  pendingNewPatient = null;
  const patientIdEl = document.getElementById('admPatientId');
  const patientIdGroup = document.getElementById('admPatientIdGroup');
  const generatedId = document.getElementById('admPatientGeneratedId');
  const help = document.getElementById('admPatientModeHelp');
  const nextRequestId = admissionPatientLookup.requestId + 1;
  admissionPatientLookup = { patientId: '', status: 'idle', requestId: nextRequestId };
  admissionPatientLookupPromise = null;
  resetPreviousCaregiverSuggestion();

  if (patientIdEl) patientIdEl.value = '';
  if (patientIdGroup) patientIdGroup.style.display = mode === 'existing' ? '' : 'none';
  if (patientIdEl) patientIdEl.required = mode === 'existing';
  if (generatedId) {
    generatedId.textContent = '';
    generatedId.style.display = 'none';
  }
  ['admPatientName', 'admPatientAge', 'admPatientPhone', 'admDob'].forEach(id => {
    const input = document.getElementById(id);
    if (input) input.value = '';
  });
  const ageCalcEl = document.getElementById('admCalculatedAge');
  if (ageCalcEl) ageCalcEl.textContent = '-';
  ['admPatientGender', 'admPatientBloodGroup'].forEach(id => {
    const select = document.getElementById(id);
    if (select) select.selectedIndex = 0;
  });
  const admissionIdEl = document.getElementById('admId');
  if (admissionIdEl) admissionIdEl.value = '';
  if (!caregiverSelectedFromPrevious) {
    document.getElementById('admCaregiverName').value = '';
    document.getElementById('admCaregiverPhone').value = '';
    document.getElementById('admCaregiverRelation').value = '';
  }

  const existing = mode === 'existing';
  setPatientFormEditable(!existing);
  if (help) {
    help.textContent = existing
      ? 'Enter an existing Patient ID to load the patient and previous caregiver details.'
      : 'Enter patient details. Spring Boot assigns the Patient ID.';
  }
  setPatientLookupStatus(existing ? 'Enter an existing Patient ID.' : '');
}

function admissionApiError(payload, status) {
  if (payload && typeof payload === 'object') {
    return payload.message || payload.detail || payload.error || `HTTP ${status}`;
  }
  return typeof payload === 'string' && payload ? payload : `HTTP ${status}`;
}

function localPhoneNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

async function loadExistingPatient() {
  const modeEl = document.getElementById('admPatientMode');
  const patientIdEl = document.getElementById('admPatientId');
  if (!modeEl || modeEl.value !== 'existing' || !patientIdEl) return true;

  const patientId = patientIdEl.value.trim();
  if (!patientId) {
    admissionPatientLookup = {
      patientId: '',
      status: 'error',
      requestId: admissionPatientLookup.requestId + 1
    };
    setPatientLookupStatus('Enter a Patient ID to look up this patient.');
    return false;
  }
  if (admissionPatientLookup.patientId === patientId && admissionPatientLookup.status === 'ready') return true;
  if (admissionPatientLookup.patientId === patientId && admissionPatientLookup.status === 'loading' && admissionPatientLookupPromise) {
    return admissionPatientLookupPromise;
  }

  const requestId = admissionPatientLookup.requestId + 1;
  admissionPatientLookup = { patientId, status: 'loading', requestId };
  resetPreviousCaregiverSuggestion();
  document.getElementById('admCaregiverName').value = '';
  document.getElementById('admCaregiverPhone').value = '';
  document.getElementById('admCaregiverRelation').value = '';

  const panel = document.getElementById('previousCaregiverPanel');
  const status = document.getElementById('previousCaregiverStatus');
  if (panel) panel.style.display = 'block';
  if (status) status.textContent = 'Loading patient and previous caregiver...';
  setPatientLookupStatus('Loading patient...');

  const submitButton = document.querySelector('#admitPatientForm [type="submit"]');
  if (submitButton) submitButton.disabled = true;

  admissionPatientLookupPromise = (async () => {
    try {
      const patientResponse = await fetch(`${HMS_API_BASE}/api/v1/patients/${encodeURIComponent(patientId)}`);
      const patient = await patientResponse.json().catch(() => null);
      if (requestId !== admissionPatientLookup.requestId) return false;
      if (!patientResponse.ok) {
        throw new Error(admissionApiError(patient, patientResponse.status));
      }

      document.getElementById('admPatientName').value = patient.name || '';
      document.getElementById('admPatientAge').value = patient.age ?? '';
      document.getElementById('admPatientPhone').value = localPhoneNumber(patient.phone);
      const genderEl = document.getElementById('admPatientGender');
      const bloodGroupEl = document.getElementById('admPatientBloodGroup');
      if (genderEl) genderEl.value = patient.gender || '';
      if (bloodGroupEl) bloodGroupEl.value = patient.bloodGroup || '';
      const admDobEl = document.getElementById('admDob') || document.getElementById('admPatientDob');
      if (admDobEl) {
        if (patient.dob) {
          admDobEl.value = typeof patient.dob === 'string' ? patient.dob.slice(0, 10) : patient.dob;
          handleDobChange();
        } else {
          admDobEl.value = '';
          const ageCalcEl = document.getElementById('admCalculatedAge');
          if (ageCalcEl) ageCalcEl.textContent = patient.ageGender || '-';
        }
      }

      setPatientLookupStatus(`Patient ${patient.patientId || patientId} loaded. Checking previous caregiver...`);
      const caregiverResponse = await fetch(`${HMS_API_BASE}/api/v1/caregivers/previous?patientId=${encodeURIComponent(patientId)}`);
      const caregiver = await caregiverResponse.json().catch(() => null);
      if (requestId !== admissionPatientLookup.requestId) return false;
      if (caregiverResponse.ok && caregiver && caregiver.caregiverName) {
        previousAdmissionCaregiver = caregiver;
        const details = document.getElementById('previousCaregiverDetails');
        const choice = document.getElementById('previousCaregiverChoice');
        if (details) {
          details.textContent = `${caregiver.caregiverName} • ${caregiver.caregiverMobile || 'No mobile'} • ${caregiver.relationship || 'Relationship not specified'}`;
        }
        if (choice) choice.style.display = 'block';
        if (status) status.textContent = '';
      } else if (caregiverResponse.ok) {
        if (status) status.textContent = 'No previous caregiver was found. Enter caregiver details for this admission.';
      } else {
        if (status) status.textContent = `Could not load previous caregiver: ${admissionApiError(caregiver, caregiverResponse.status)}. Enter caregiver details manually.`;
      }

      admissionPatientLookup.status = 'ready';
      return true;
    } catch (error) {
      if (requestId !== admissionPatientLookup.requestId) return false;
      admissionPatientLookup.status = 'error';
      if (status) status.textContent = `Patient lookup failed: ${error.message}. Check the Patient ID.`;
      setPatientLookupStatus(`Patient lookup failed: ${error.message}`);
      return false;
    } finally {
      if (requestId === admissionPatientLookup.requestId) {
        if (submitButton) submitButton.disabled = false;
        admissionPatientLookupPromise = null;
      }
    }
  })();
  return admissionPatientLookupPromise;
}

function usePreviousCaregiver() {
  if (!previousAdmissionCaregiver) return;
  document.getElementById('admCaregiverName').value = previousAdmissionCaregiver.caregiverName || '';
  document.getElementById('admCaregiverPhone').value = localPhoneNumber(previousAdmissionCaregiver.caregiverMobile);
  const relationship = previousAdmissionCaregiver.relationship || '';
  const relationshipEl = document.getElementById('admCaregiverRelation');
  relationshipEl.value = Array.from(relationshipEl.options).some(option => option.value === relationship)
    ? relationship
    : 'Other';
  caregiverSelectedFromPrevious = true;
}

function changeAdmissionCaregiver() {
  document.getElementById('admCaregiverName').value = '';
  document.getElementById('admCaregiverPhone').value = '';
  document.getElementById('admCaregiverRelation').value = '';
  caregiverSelectedFromPrevious = false;
  const status = document.getElementById('previousCaregiverStatus');
  if (status) status.textContent = 'Enter the new caregiver details for this admission.';
}

// ===============================================================
// AGE & DOB CALCULATION HELPERS (Req 1.1)
// ===============================================================
function calculateAgeFromDob(dobString, fallbackAge) {
  if (!dobString || typeof dobString !== 'string') {
    if (fallbackAge !== undefined && fallbackAge !== null && fallbackAge !== '') {
      const parsed = typeof fallbackAge === 'number' ? fallbackAge : parseInt(fallbackAge, 10);
      return { years: isNaN(parsed) ? 0 : parsed, displayText: String(fallbackAge).includes('Year') ? fallbackAge : `${fallbackAge} Years` };
    }
    return { years: 0, displayText: '0 Years' };
  }
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) {
    return { years: 0, displayText: fallbackAge ? `${fallbackAge} Years` : '0 Years' };
  }
  const today = new Date();
  let years = today.getFullYear() - dob.getFullYear();
  let months = today.getMonth() - dob.getMonth();
  let days = today.getDate() - dob.getDate();

  if (days < 0) {
    months--;
    const prevMonthDays = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    days += prevMonthDays;
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  if (years < 1) {
    if (months > 0) {
      return { years: 0, months, days, displayText: `${months} month${months > 1 ? 's' : ''}${days > 0 ? ` ${days} day${days > 1 ? 's' : ''}` : ''}` };
    } else {
      return { years: 0, months: 0, days: Math.max(1, days), displayText: `${Math.max(1, days)} day${days > 1 ? 's' : ''}` };
    }
  }

  return { years, months, days, displayText: `${years} Years` };
}

function initDobPicker() {
  const dobInputs = [
    document.getElementById('admDob'),
    document.getElementById('admPatientDob')
  ].filter(Boolean);

  if (dobInputs.length === 0) return;

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const maxDate = `${yyyy}-${mm}-${dd}`;

  const minDateObj = new Date(today);
  minDateObj.setFullYear(minDateObj.getFullYear() - 150);
  const minYYYY = minDateObj.getFullYear();
  const minMM = String(minDateObj.getMonth() + 1).padStart(2, '0');
  const minDD = String(minDateObj.getDate()).padStart(2, '0');
  const minDate = `${minYYYY}-${minMM}-${minDD}`;

  dobInputs.forEach(dobInput => {
    dobInput.max = maxDate;
    dobInput.setAttribute('max', maxDate);
    dobInput.min = minDate;
    dobInput.setAttribute('min', minDate);
  });
}

function handleDobChange() {
  initDobPicker();
  const dobEl = document.getElementById('admDob') || document.getElementById('admPatientDob');
  const dobVal = dobEl?.value;
  const ageDisplayEl = document.getElementById('admCalculatedAge') || document.getElementById('admPatientDerivedAgeDisplay');
  const ageInputEl = document.getElementById('admPatientAge');

  if (!dobVal) {
    if (ageDisplayEl) ageDisplayEl.textContent = '-';
    if (ageInputEl) ageInputEl.value = '';
    if (typeof hmsClearFieldError === 'function') hmsClearFieldError('admDob');
    if (dobEl && dobEl.setCustomValidity) dobEl.setCustomValidity('');
    return;
  }

  // Timezone-safe date parsing
  const parts = dobVal.split('-');
  let selectedDate;
  if (parts.length === 3 && parts[0].length === 4) {
    selectedDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  } else {
    selectedDate = new Date(dobVal);
  }

  if (isNaN(selectedDate.getTime())) {
    if (typeof hmsShowFieldError === 'function') {
      hmsShowFieldError('admDob', 'Please enter a valid Date of Birth.');
    }
    if (ageDisplayEl) ageDisplayEl.textContent = '-';
    if (ageInputEl) ageInputEl.value = '';
    if (dobEl && dobEl.setCustomValidity) dobEl.setCustomValidity('Please enter a valid Date of Birth.');
    return;
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const minAllowedDate = new Date();
  minAllowedDate.setFullYear(minAllowedDate.getFullYear() - 150);
  minAllowedDate.setHours(0, 0, 0, 0);

  if (selectedDate > today) {
    if (typeof hmsShowFieldError === 'function') {
      hmsShowFieldError('admDob', 'Date of Birth cannot be after current date.');
    }
    if (ageDisplayEl) ageDisplayEl.textContent = '-';
    if (ageInputEl) ageInputEl.value = '';
    if (dobEl && dobEl.setCustomValidity) dobEl.setCustomValidity('Date of Birth cannot be after current date.');
    return;
  }

  if (selectedDate < minAllowedDate) {
    if (typeof hmsShowFieldError === 'function') {
      hmsShowFieldError('admDob', 'Date of Birth cannot exceed 150 years (maximum age is 150 years).');
    }
    if (ageDisplayEl) ageDisplayEl.textContent = '-';
    if (ageInputEl) ageInputEl.value = '';
    if (dobEl && dobEl.setCustomValidity) dobEl.setCustomValidity('Date of Birth cannot exceed 150 years.');
    return;
  }

  if (dobEl && dobEl.setCustomValidity) dobEl.setCustomValidity('');
  if (typeof hmsClearFieldError === 'function') hmsClearFieldError('admDob');

  const result = calculateAgeFromDob(dobVal);
  if (result.years > 150) {
    if (typeof hmsShowFieldError === 'function') {
      hmsShowFieldError('admDob', 'Age cannot exceed 150 years.');
    }
    if (ageDisplayEl) ageDisplayEl.textContent = '-';
    if (ageInputEl) ageInputEl.value = '';
    return;
  }

  if (ageDisplayEl) ageDisplayEl.textContent = result.displayText;
  if (ageInputEl) ageInputEl.value = result.years;
}

function formatCurrentDateTime() {
  const now = new Date();
  return now.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

// DEPARTMENT 1: RECEPTIONIST ADMISSION HANDLER (Req 1.1 - 1.8)
async function handleAdmitPatient() {
  if (admissionSubmissionInProgress) return;
  if (!activeStaff.allowedDepts.includes('reception')) {
    alert(`Access Denied: Logged in as ${activeStaff.name} (${activeStaff.title}).\nOnly Receptionist staff can admit new patients. Please switch staff account.`);
    return;
  }

  const nameEl       = document.getElementById('admPatientName');
  const dobEl        = document.getElementById('admDob');
  const ageEl        = document.getElementById('admPatientAge');
  const genderEl     = document.getElementById('admPatientGender');
  const bloodGroupEl = document.getElementById('admPatientBloodGroup');
  const phoneEl      = document.getElementById('admPatientPhone');
  const deptEl       = document.getElementById('admDepartment');
  const admTypeEl    = document.getElementById('admType');
  const reasonEl     = document.getElementById('admReason');
  const roomEl       = document.getElementById('admRoom');
  const doctorEl     = document.getElementById('admDoctor');
  const adapterIdEl  = document.getElementById('admPatientId');
  const caregiverNameEl  = document.getElementById('admCaregiverName');
  const caregiverPhoneEl = document.getElementById('admCaregiverPhone');
  const caregiverRelationEl = document.getElementById('admCaregiverRelation');
  const patientMode = document.getElementById('admPatientMode').value;
  let patientId = patientMode === 'existing' && adapterIdEl ? adapterIdEl.value.trim() : '';

  if (patientMode === 'existing') {
    const patientIdValid = hmsValidateFields([
      { id: 'admPatientId', value: patientId, rules: [ruleRequired('Patient ID')] }
    ]);
    if (!patientIdValid) return;
    const patientLoaded = await loadExistingPatient();
    if (!patientLoaded || admissionPatientLookup.patientId !== patientId || admissionPatientLookup.status !== 'ready') {
      hmsShowFieldError('admPatientId', 'Load a valid existing patient before creating a readmission.');
      return;
    }
  }

  if (phoneEl) formatPhoneNumberInput(phoneEl);
  if (caregiverPhoneEl) formatPhoneNumberInput(caregiverPhoneEl);

  const dobVal = dobEl ? dobEl.value.trim() : '';

  // Validate text, date & number fields (Req 1.1: DOB replaces manual age input)
  const isValid = hmsValidateFields([
    { id: 'admPatientName',  value: nameEl.value,  rules: [ruleRequired('Patient name'), rulePattern(HMS_VALIDATION_PATTERNS.personName, 'Enter a valid name (letters only, at least 2 characters).')] },
    { id: 'admDob',          value: dobVal,        rules: [ruleRequired('Date of Birth'), ruleValidDob('Date of Birth')] },
    { id: 'admPatientPhone', value: phoneEl.value, rules: [ruleRequired('Patient mobile number'), ruleExactDigits10('Patient mobile number')] },
    { id: 'admReason', value: reasonEl.value, rules: [ruleRequired('Reason for admission'), ruleMinLength(3, 'Reason for admission')] },
    { id: 'admCaregiverName',  value: caregiverNameEl.value,  rules: [ruleRequired('Caregiver name'), rulePattern(HMS_VALIDATION_PATTERNS.personName, 'Enter a valid name (letters only, at least 2 characters).')] },
    { id: 'admCaregiverPhone', value: caregiverPhoneEl.value, rules: [ruleRequired('Caregiver mobile number'), ruleExactDigits10('Caregiver mobile number')] },
  ]);
  if (!isValid) {
    const firstInvalid = document.querySelector('#admitPatientForm .input-invalid');
    if (firstInvalid) {
      firstInvalid.focus();
      firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return;
  }

  // Validate dropdown placeholders (Req 6)
  const dropdownChecks = [
    { el: genderEl, label: 'Gender' },
    { el: bloodGroupEl, label: 'Blood Group' },
    { el: deptEl, label: 'Admitting Department' },
    { el: admTypeEl, label: 'Admission Type' },
    { el: roomEl, label: 'Ward & Room' },
    { el: doctorEl, label: 'Attending Doctor' },
    { el: caregiverRelationEl, label: 'Caregiver Relationship' },
  ];
  for (const check of dropdownChecks) {
    if (!check.el || !check.el.value) {
      alert(`Please select a valid option for "${check.label}". Unselected placeholders are not permitted.`);
      if (check.el) check.el.focus();
      return;
    }
  }

  const name          = nameEl.value.trim();
  const bloodGroup    = bloodGroupEl.value;
  const room          = roomEl.value;
  const selectedDoctor = doctorEl.value.trim();
  const department    = deptEl.value;
  const reason        = reasonEl.value.trim();
  const admType       = admTypeEl.value;
  const caregiverName = caregiverNameEl.value.trim();
  const caregiverPhone = '+91 ' + caregiverPhoneEl.value.trim();
  const caregiverRelation = caregiverRelationEl.value || 'Other';
  const submitButton = document.querySelector('#admitPatientForm [type="submit"]');

  // Req 1.4: Gender options: Male, Female, Transgender
  let gender = genderEl.value;
  if (gender === 'Others' || gender === 'Other') gender = 'Transgender';

  // Derived age calculation
  const derivedAgeInfo = calculateAgeFromDob(dobVal);
  if (ageEl) ageEl.value = derivedAgeInfo.years;

  admissionSubmissionInProgress = true;
  if (submitButton) submitButton.disabled = true;

  try {
    const admissionPayload = {
      patientMode,
      patientId: patientMode === 'existing' ? patientId : undefined,
      fullName: name,
      dob: dobVal,
      age: derivedAgeInfo.years,
      ageDisplay: derivedAgeInfo.displayText,
      gender: gender,
      bloodGroup,
      patientPhone: '+91 ' + phoneEl.value.trim(),
      department,
      admittingDept: department,
      admissionType: admType,
      reasonForAdmission: reason,
      roomNumber: room,
      attendingDoctor: selectedDoctor,
      caregiverName,
      caregiverPhone,
      caregiverRelation,
      relation: caregiverRelation
    };

    const response = await fetch(`${HMS_API_BASE}/api/hms/admissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(admissionPayload)
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) {
      throw new Error(result?.error || result?.message || `HTTP ${response.status}`);
    }

    const assignedPatientId = result.patientId;
    const assignedAdmissionId = result.admissionId;

    // Display Generated System Identifiers in Confirmation Panel (Req 1.8: Sequential IDs)
    const confPanel = document.getElementById('admConfirmationPanel');
    const confPatientId = document.getElementById('confPatientId');
    const confAdmissionId = document.getElementById('confAdmissionId');
    const confDetailsText = document.getElementById('confDetailsText');

    if (confPatientId) confPatientId.textContent = assignedPatientId;
    if (confAdmissionId) confAdmissionId.textContent = assignedAdmissionId;
    if (confDetailsText) {
      confDetailsText.innerHTML = `<strong>Patient:</strong> ${escapeHtml(name)} &bull; <strong>Department:</strong> ${escapeHtml(department)} &bull; <strong>Room:</strong> ${escapeHtml(room)}<br><strong>Attending Doctor:</strong> ${escapeHtml(selectedDoctor)}<br><strong>Bound Caregiver:</strong> ${escapeHtml(caregiverName)} (${escapeHtml(caregiverPhone)}) &bull; OTP Auth enabled for CareBridge.`;
    }
    if (confPanel) {
      confPanel.style.display = 'block';
      confPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Reset admission form for next patient
    document.getElementById('admitPatientForm')?.reset();
    resetPreviousCaregiverSuggestion();
    document.getElementById('admPatientMode').value = 'new';
    handlePatientModeChange();

    const admDateTimeEl = document.getElementById('admDateTimeDisplay') || document.getElementById('admAdmissionDateTime');
    if (admDateTimeEl) admDateTimeEl.value = formatCurrentDateTime();
    initDobPicker();
    const ageCalcEl = document.getElementById('admCalculatedAge');
    if (ageCalcEl) ageCalcEl.textContent = '-';

    await loadBackendActiveAdmissions();
    await loadHmsDatabase();
    updateRoomAvailabilityStatus();

    alert(`Patient Admitted Successfully!\nPatient ID: ${assignedPatientId}\nAdmission ID: ${assignedAdmissionId}\nDepartment: ${department}\nCaregiver: ${caregiverName}`);
  } catch (error) {
    console.error('Patient/admission submission failed:', error);
    alert(`Patient admission failed: ${error.message || 'Unable to reach backend API.'}`);
  } finally {
    admissionSubmissionInProgress = false;
    if (submitButton) submitButton.disabled = false;
  }
}

function renderActivePatients() {
  const tbody = document.getElementById('activePatientsTbody');
  if (!tbody) return;

  const patients = backendActiveAdmissions;
  let html = '';
  patients.forEach(p => {
    // Req 1.1: Derive age from DOB wherever age is displayed, with fallback to stored age
    let ageDisplay = '';
    if (p.dob) {
      const calc = calculateAgeFromDob(p.dob, p.ageGender || p.age);
      ageDisplay = calc.displayText;
    } else if (p.ageGender) {
      ageDisplay = p.ageGender;
    } else if (p.age) {
      ageDisplay = `${p.age} Years`;
    } else {
      ageDisplay = '-';
    }

    const genderDisplay = (p.gender === 'Others' || p.gender === 'Other') ? 'Transgender' : (p.gender || '');
    const patientDetails = [ageDisplay, genderDisplay, p.bloodGroup ? `(${p.bloodGroup})` : '', p.patientPhone].filter(Boolean).join(' • ');

    // Req 1.5: Format timestamps cleanly without "NA"/"N/A"/null/undefined
    const admDate = p.admissionDate || (p.createdAt ? formatDateForDisplay(p.createdAt) : '');
    const admTime = p.admissionTime || '';
    const formattedAdmissionDateTime = [admDate, admTime].filter(Boolean).join(', ') || '-';

    // Req 1.6: Admission Status and CareBridge Status columns removed from UI
    html += `
      <tr>
        <td>
          <strong>${escapeHtml(p.fullName)}</strong><br>
          <span style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(patientDetails)}</span>
        </td>
        <td>
          <strong>${escapeHtml(p.patientId || '-')}</strong><br>
          <span style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(formattedAdmissionDateTime)}</span>
        </td>
        <td>
          <strong>${escapeHtml(p.admissionId)}</strong><br>
          <span style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(p.reasonForAdmission || '-')}</span>
        </td>
        <td>
          <strong>${escapeHtml(p.caregiverName || '-')}</strong><br>
          <span style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(p.relation || 'Caregiver')} • ${escapeHtml(p.caregiverPhone || '-')}</span>
        </td>
        <td>
          <strong>${escapeHtml(p.roomNumber || '-')}</strong><br>
          <span style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(p.attendingDoctor || '-')}</span>
        </td>
        <td>${p.status === 'ACTIVE' ? `
          <div style="display: flex; gap: 6px;">
            <button type="button" class="btn btn-primary" style="padding: 4px 10px; font-size: 11px; background: #0284c7; color: #fff; border: none; border-radius: 4px; cursor: pointer;" data-transfer-admission="${p.admissionId}">Transfer</button>
            <button type="button" class="btn btn-warning" style="padding: 4px 10px; font-size: 11px;" data-discharge-admission="${p.admissionId}">Discharge</button>
          </div>` : ''}</td>
      </tr>
    `;
  });
  tbody.innerHTML = html || '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 18px;">No active admissions found.</td></tr>';

  const statCount = document.getElementById('statPatientsCount');
  if (statCount) statCount.innerText = patients.length;
}

document.getElementById('activePatientsTbody')?.addEventListener('click', event => {
  const dischargeBtn = event.target.closest('[data-discharge-admission]');
  if (dischargeBtn) {
    openDischargeModal(dischargeBtn.dataset.dischargeAdmission);
    return;
  }
  const transferBtn = event.target.closest('[data-transfer-admission]');
  if (transferBtn) {
    openTransferModal(transferBtn.dataset.transferAdmission);
    return;
  }
});

let selectedAdmissionForDischarge = null;
let dischargeRequestInProgress = false;
let selectedDischargeFile = null;

function handleDischargeFileSelect(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 15 * 1024 * 1024) {
    alert('File size exceeds the 15MB limit. Please select a smaller file.');
    event.target.value = '';
    return;
  }
  selectedDischargeFile = file;
  const fileNameDisplay = document.getElementById('dischargeFileNameDisplay');
  const fileSizeDisplay = document.getElementById('dischargeFileSizeDisplay');
  const fileCard = document.getElementById('dischargeFileCard');
  const uploadArea = document.getElementById('dischargeUploadArea');
  const summaryInput = document.getElementById('dischargeSummary');

  if (fileNameDisplay) fileNameDisplay.textContent = file.name;
  if (fileSizeDisplay) fileSizeDisplay.textContent = `${(file.size / 1024).toFixed(1)} KB`;
  if (fileCard) fileCard.style.display = 'flex';
  if (uploadArea) uploadArea.style.display = 'none';
  if (summaryInput) summaryInput.value = `Attached document: ${file.name}`;
}

function previewDischargeFile() {
  const fileUrl = document.getElementById('dischargeFileUrl')?.value;
  if (fileUrl) {
    window.open(fileUrl.startsWith('http') ? fileUrl : `${HMS_API_BASE}${fileUrl}`, '_blank');
    return;
  }
  if (selectedDischargeFile) {
    const objectUrl = URL.createObjectURL(selectedDischargeFile);
    window.open(objectUrl, '_blank');
  }
}

function removeDischargeFile() {
  selectedDischargeFile = null;
  const fileInput = document.getElementById('dischargeFileInput');
  if (fileInput) fileInput.value = '';
  const fileUrlInput = document.getElementById('dischargeFileUrl');
  if (fileUrlInput) fileUrlInput.value = '';
  const fileNameInput = document.getElementById('dischargeFileNameVal');
  if (fileNameInput) fileNameInput.value = '';
  const summaryInput = document.getElementById('dischargeSummary');
  if (summaryInput) summaryInput.value = '';
  const fileCard = document.getElementById('dischargeFileCard');
  if (fileCard) fileCard.style.display = 'none';
  const uploadArea = document.getElementById('dischargeUploadArea');
  if (uploadArea) uploadArea.style.display = 'block';
}

function openDischargeModal(admissionId) {
  const admission = backendActiveAdmissions.find(item => item.admissionId === admissionId && item.status === 'ACTIVE');
  if (!admission) {
    alert('This admission is no longer active. Refreshing the admission census.');
    loadBackendActiveAdmissions();
    return;
  }

  selectedAdmissionForDischarge = admission;
  document.getElementById('dischargePatientName').textContent = admission.fullName || '-';
  document.getElementById('dischargePatientId').textContent = admission.patientId || '-';
  document.getElementById('dischargeAdmissionId').textContent = admission.admissionId;
  document.getElementById('dischargeCaregiver').textContent = [
    admission.caregiverName,
    admission.caregiverPhone,
    admission.relation
  ].filter(Boolean).join(' • ') || 'None recorded';

  // Reset file controls
  removeDischargeFile();

  // Req 1.2: Check for existing discharge summary (legacy text or attached file)
  const legacyContainer = document.getElementById('legacyDischargeSummaryContainer');
  const legacyText = document.getElementById('legacyDischargeSummaryText');
  const existingSummary = admission.dischargeSummary || '';
  if (existingSummary && !existingSummary.startsWith('/uploads/') && !existingSummary.includes('Attached document:')) {
    if (legacyContainer) legacyContainer.style.display = 'block';
    if (legacyText) legacyText.textContent = existingSummary;
  } else if (existingSummary && (existingSummary.startsWith('/uploads/') || existingSummary.startsWith('http'))) {
    if (legacyContainer) legacyContainer.style.display = 'none';
    const fileCard = document.getElementById('dischargeFileCard');
    const uploadArea = document.getElementById('dischargeUploadArea');
    const fileNameDisplay = document.getElementById('dischargeFileNameDisplay');
    const fileUrlInput = document.getElementById('dischargeFileUrl');
    if (fileUrlInput) fileUrlInput.value = existingSummary;
    if (fileNameDisplay) fileNameDisplay.textContent = existingSummary.split('/').pop();
    if (fileCard) fileCard.style.display = 'flex';
    if (uploadArea) uploadArea.style.display = 'none';
  } else {
    if (legacyContainer) legacyContainer.style.display = 'none';
  }

  document.getElementById('dischargeError').style.display = 'none';
  document.getElementById('dischargeError').textContent = '';
  document.getElementById('dischargeModal').style.display = 'flex';
}

function closeDischargeModal() {
  if (dischargeRequestInProgress) return;
  document.getElementById('dischargeModal').style.display = 'none';
  selectedAdmissionForDischarge = null;
  removeDischargeFile();
}

async function confirmAdmissionDischarge() {
  if (!selectedAdmissionForDischarge || dischargeRequestInProgress) return;

  const admission = selectedAdmissionForDischarge;
  const confirmButton = document.getElementById('confirmDischargeButton');
  const cancelButton = document.getElementById('cancelDischargeButton');
  const errorElement = document.getElementById('dischargeError');
  dischargeRequestInProgress = true;
  confirmButton.disabled = true;
  cancelButton.disabled = true;
  confirmButton.textContent = 'Discharging...';
  errorElement.style.display = 'none';
  errorElement.textContent = '';

  try {
    let uploadedFileUrl = document.getElementById('dischargeFileUrl')?.value || '';
    let uploadedFileName = selectedDischargeFile ? selectedDischargeFile.name : (uploadedFileUrl ? uploadedFileUrl.split('/').pop() : '');

    // If user attached a file, upload it to the backend uploads directory
    if (selectedDischargeFile) {
      const base64Data = await readFileAsBase64(selectedDischargeFile);
      const uploadRes = await fetch(`${HMS_API_BASE}/api/hms/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: selectedDischargeFile.name, fileData: base64Data })
      });
      const uploadResult = await uploadRes.json();
      const returnedUrl = uploadResult?.url || uploadResult?.fileUrl;
      if (!uploadRes.ok || !returnedUrl) {
        throw new Error(uploadResult?.error || 'Failed to upload discharge summary file');
      }
      uploadedFileUrl = returnedUrl;
      uploadedFileName = uploadResult.filename || uploadResult.fileName || selectedDischargeFile.name;
    }

    const summaryPayload = uploadedFileUrl || document.getElementById('dischargeSummary')?.value || 'Discharged with attached documents.';

    const response = await fetch(`${HMS_API_BASE}/api/v1/admissions/${encodeURIComponent(admission.admissionId)}/discharge`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Staff-Request': 'true'
      },
      body: JSON.stringify({
        summary: summaryPayload,
        fileUrl: uploadedFileUrl,
        fileName: uploadedFileName
      })
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(admissionApiError(result, response.status));
    }

    backendActiveAdmissions = backendActiveAdmissions.filter(item => item.admissionId !== admission.admissionId);
    renderActivePatients();
    dischargeRequestInProgress = false;
    closeDischargeModal();
    await loadBackendActiveAdmissions();
    await loadHmsDatabase();
    alert(`Admission ${admission.admissionId} discharged successfully. Discharge summary saved and room released.`);
  } catch (error) {
    errorElement.textContent = `Discharge failed: ${error.message || 'Unable to reach the admissions API.'}`;
    errorElement.style.display = 'block';
  } finally {
    dischargeRequestInProgress = false;
    confirmButton.disabled = false;
    cancelButton.disabled = false;
    confirmButton.textContent = 'Confirm Discharge';
  }
}

// ===============================================================
// PATIENT TRANSFER WORKFLOW (Phase 3)
// ===============================================================
let selectedAdmissionForTransfer = null;
let transferRequestInProgress = false;

const HMS_DEPARTMENT_DOCTORS = {
  'Cardiology': ['Dr. Aris Thorne (Cardiology)'],
  'Pulmonology': ['Dr. Elena Rostova (Pulmonology)'],
  'Internal Medicine': ['Dr. Marcus Vance (Internal Med)'],
  'General Medicine': ['Dr. Marcus Vance (Internal Med)'],
  'General': ['Dr. Marcus Vance (Internal Med)'],
  'Paediatrics': ['Dr. Anita Rao (Paediatrics)'],
  'Maternity': ['Dr. Maya Lin (Maternity)'],
  'Emergency Care': ['Dr. Marcus Vance (Emergency Care)'],
  'Critical Care / ICU': ['Dr. Aris Thorne (Cardiology)']
};

function isDeptMatchHMS(d1, d2) {
  if (!d1 || !d2) return false;
  const s1 = String(d1).trim().toUpperCase();
  const s2 = String(d2).trim().toUpperCase();
  if (s1 === s2) return true;
  if (s1.includes('CARDIO') && s2.includes('CARDIO')) return true;
  if (s1.includes('PULMO') && s2.includes('PULMO')) return true;
  if ((s1.includes('INTERNAL') || s1.includes('GENERAL')) && (s2.includes('INTERNAL') || s2.includes('GENERAL'))) return true;
  if ((s1.includes('PAEDIATRIC') || s1.includes('PEDIATRIC')) && (s2.includes('PAEDIATRIC') || s2.includes('PEDIATRIC'))) return true;
  if (s1.includes('MATERNITY') && s2.includes('MATERNITY')) return true;
  if (s1.includes('EMERGENCY') && s2.includes('EMERGENCY')) return true;
  if (s1.includes('DERMAT') && s2.includes('DERMAT')) return true;
  if ((s1.includes('CARDIO') || s1.includes('INTERNAL')) && s2.includes('ICU')) return true;
  return false;
}

function getDoctorDeptHMS(doctorName) {
  if (!doctorName) return null;
  const docUpper = String(doctorName).toUpperCase();
  if (docUpper.includes('CARDIO') || docUpper.includes('THORNE')) return 'Cardiology';
  if (docUpper.includes('PULMO') || docUpper.includes('ROSTOVA')) return 'Pulmonology';
  if (docUpper.includes('PAEDIATRIC') || docUpper.includes('PEDIATRIC') || docUpper.includes('ANITA') || docUpper.includes('RAO')) return 'Paediatrics';
  if (docUpper.includes('MATERNITY') || docUpper.includes('MAYA') || docUpper.includes('LIN')) return 'Maternity';
  if (docUpper.includes('INTERNAL') || docUpper.includes('VANCE')) return 'Internal Medicine';
  if (docUpper.includes('EMERGENCY')) return 'Emergency Care';
  if (docUpper.includes('DERMAT')) return 'Dermatology';
  return null;
}

function isDoctorCompatWithDeptHMS(doctorName, dept) {
  if (!doctorName || !dept) return true;
  const docDept = getDoctorDeptHMS(doctorName);
  if (!docDept) return true;
  return isDeptMatchHMS(docDept, dept);
}

function getDoctorsForDepartment(department, currentDoctor) {
  let docs = [];
  for (const [key, list] of Object.entries(HMS_DEPARTMENT_DOCTORS)) {
    if (isDeptMatchHMS(key, department)) {
      docs = [...list];
      break;
    }
  }
  if (docs.length === 0) {
    docs = ['Dr. Marcus Vance (Internal Med)'];
  }
  // If current attending doctor belongs to the same department, keep/show that doctor appropriately
  if (currentDoctor && isDoctorCompatWithDeptHMS(currentDoctor, department)) {
    const cleanDoc = String(currentDoctor).trim();
    if (cleanDoc && !docs.includes(cleanDoc) && cleanDoc !== 'Select Doctor') {
      docs.unshift(cleanDoc);
    }
  }
  return docs;
}

function getRoomDeptHMS(roomName) {
  if (!roomName) return null;
  const upper = String(roomName).toUpperCase();
  if (upper.includes('PAEDIATRIC') || upper.includes('PEDIATRIC') || upper.includes('CHILD')) return 'Paediatrics';
  if (upper.includes('PULMO')) return 'Pulmonology';
  if (upper.includes('CARDIO')) return 'Cardiology';
  if (upper.includes('MATERNITY') || upper.includes('MATERNAL') || upper.includes('GYNEC')) return 'Maternity';
  if (upper.includes('EMERGENCY')) return 'Emergency Care';
  if (upper.includes('DERMAT')) return 'Dermatology';
  // General Ward, General Room, Private Room, Semi-Private Room, ICU Room are general
  return null;
}

function isRoomCompatWithDeptHMS(roomName, patientDept) {
  const roomDept = getRoomDeptHMS(roomName);
  if (!roomDept) return true; // General Ward / Room / ICU allowed for all
  if (!patientDept) return false;
  return isDeptMatchHMS(roomDept, patientDept);
}

async function openTransferModal(admissionId) {
  const admission = backendActiveAdmissions.find(item => item.admissionId === admissionId && item.status === 'ACTIVE');
  if (!admission) {
    alert('This admission is no longer active. Refreshing the admission census.');
    loadBackendActiveAdmissions();
    return;
  }

  selectedAdmissionForTransfer = admission;
  const patientDept = admission.department || 'General';
  const currentDoctor = admission.attendingDoctor || admission.doctor || 'N/A';

  document.getElementById('transferPatientName').textContent = admission.fullName || 'N/A';
  document.getElementById('transferPatientId').textContent = admission.patientId || 'N/A';
  document.getElementById('transferAdmissionId').textContent = admission.admissionId;
  document.getElementById('transferCurrentLocation').textContent = `${patientDept} • ${admission.roomNumber || 'N/A'}`;
  document.getElementById('transferCurrentDoctor').textContent = currentDoctor;

  const deptEl = document.getElementById('transferDept');
  const doctorEl = document.getElementById('transferDoctor');
  const roomEl = document.getElementById('transferRoom');
  const reasonEl = document.getElementById('transferReason');
  const errEl = document.getElementById('transferError');
  const roomStatusEl = document.getElementById('transferRoomStatus');

  // Display current department as read-only
  if (deptEl) deptEl.value = patientDept;
  if (reasonEl) reasonEl.value = '';
  if (errEl) {
    errEl.style.display = 'none';
    errEl.textContent = '';
  }

  // Populate Attending Doctor dropdown for the patient's existing department ONLY
  if (doctorEl) {
    doctorEl.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.disabled = true;
    placeholder.selected = true;
    placeholder.textContent = 'Select Doctor';
    doctorEl.appendChild(placeholder);

    const deptDocs = getDoctorsForDepartment(patientDept, currentDoctor);
    deptDocs.forEach(doc => {
      const opt = document.createElement('option');
      opt.value = doc;
      opt.textContent = doc;
      doctorEl.appendChild(opt);
    });

    doctorEl.value = '';
    if (typeof doctorEl._renderCustomDropdown === 'function') {
      doctorEl._renderCustomDropdown();
    }
  }

  // Pre-load room occupancy info to show available rooms vs occupied rooms
  let occupiedSet = new Map();
  try {
    const occRes = await fetch(`${HMS_API_BASE}/api/hms/rooms/occupancy`);
    if (occRes.ok) {
      const occupiedRooms = await occRes.json();
      occupiedRooms.forEach(o => {
        if (o.admissionId !== admission.admissionId) {
          occupiedSet.set(o.roomNumber, o);
        }
      });
    }
  } catch (e) {
    console.warn('Could not fetch occupancy list:', e);
  }

  // Filter Target Ward / Room / Bed dropdown:
  // - Target room must be compatible with the patient's existing department
  // - Department-specific rooms from another department must be disabled/hidden
  // - General Ward / General Room / Bed and patient's department rooms are allowed
  // - Occupied rooms are marked and disabled
  if (roomEl) {
    Array.from(roomEl.options).forEach(opt => {
      if (!opt.value) return; // skip placeholder
      const baseText = opt.text.replace(/\s*\(Occupied.*?\)/g, '').replace(/\s*\(Incompatible.*?\)/g, '');
      const isCompat = isRoomCompatWithDeptHMS(opt.value, patientDept);
      const occ = occupiedSet.get(opt.value);

      if (!isCompat) {
        opt.hidden = true;
        opt.disabled = true;
        opt.style.display = 'none';
        opt.classList.remove('room-available');
      } else if (occ) {
        // Req 1.7: do NOT list occupied rooms or patient names. Block/hide them.
        opt.hidden = true;
        opt.disabled = true;
        opt.style.display = 'none';
        opt.classList.remove('room-available');
      } else {
        // Req 1.7: Show only available rooms, styled in green
        opt.hidden = false;
        opt.disabled = false;
        opt.style.display = '';
        opt.text = baseText;
        opt.classList.add('room-available');
        opt.style.color = '#16a34a';
        opt.style.fontWeight = '700';
      }
    });

    roomEl.value = '';
    if (typeof roomEl._renderCustomDropdown === 'function') {
      roomEl._renderCustomDropdown();
    }
  }

  if (roomStatusEl && roomEl) {
    const availableOpts = Array.from(roomEl.options).filter(o => o.value && !o.hidden && !o.disabled);
    roomStatusEl.textContent = `${availableOpts.length} available room(s)/bed(s) compatible with ${patientDept} (highlighted in green). Occupied rooms are hidden.`;
    roomStatusEl.style.color = '#16a34a';
    roomStatusEl.style.fontWeight = '600';
  }

  document.getElementById('transferModal').style.display = 'flex';
}

function handleTransferDeptChange() {
  // Department is read-only; no-op
}

function closeTransferModal() {
  if (transferRequestInProgress) return;
  document.getElementById('transferModal').style.display = 'none';
  selectedAdmissionForTransfer = null;
}

async function confirmAdmissionTransfer() {
  if (!selectedAdmissionForTransfer || transferRequestInProgress) return;

  const admission = selectedAdmissionForTransfer;
  const roomEl = document.getElementById('transferRoom');
  const doctorEl = document.getElementById('transferDoctor');
  const reasonEl = document.getElementById('transferReason');
  const errEl = document.getElementById('transferError');
  const confirmBtn = document.getElementById('confirmTransferButton');
  const cancelBtn = document.getElementById('cancelTransferButton');

  if (!roomEl || !roomEl.value) {
    errEl.textContent = 'Please select a compatible target ward/room/bed.';
    errEl.style.display = 'block';
    return;
  }

  const patientDept = admission.department || 'General';
  // Extra client-side guard for room compatibility
  if (!isRoomCompatWithDeptHMS(roomEl.value, patientDept)) {
    errEl.textContent = `Room "${roomEl.value}" is not compatible with patient's department "${patientDept}".`;
    errEl.style.display = 'block';
    return;
  }

  const chosenDoctor = doctorEl ? doctorEl.value : '';
  if (chosenDoctor && chosenDoctor !== 'Select Doctor' && !isDoctorCompatWithDeptHMS(chosenDoctor, patientDept)) {
    errEl.textContent = `Doctor "${chosenDoctor}" does not belong to patient's department "${patientDept}".`;
    errEl.style.display = 'block';
    return;
  }

  transferRequestInProgress = true;
  confirmBtn.disabled = true;
  cancelBtn.disabled = true;
  confirmBtn.textContent = 'Transferring...';
  errEl.style.display = 'none';
  errEl.textContent = '';

  try {
    const payload = {
      roomNumber: roomEl.value,
      attendingDoctor: (chosenDoctor && chosenDoctor !== 'Select Doctor') ? chosenDoctor : undefined,
      reason: (reasonEl && reasonEl.value) || 'Ward/Room Transfer',
      transferredBy: (activeStaff && activeStaff.name) || 'Reception Staff'
    };

    const response = await fetch(`${HMS_API_BASE}/api/hms/admissions/${encodeURIComponent(admission.admissionId)}/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Staff-Request': 'true'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) {
      throw new Error(result?.error || `HTTP ${response.status}`);
    }

    transferRequestInProgress = false;
    closeTransferModal();

    await loadBackendActiveAdmissions();
    await loadHmsDatabase();

    alert(`Patient Transfer Successful!\n\nPatient ID: ${result.patientId}\nAdmission ID: ${result.admissionId} (Unchanged)\nDepartment: ${result.toDept} (Unchanged)\nFrom: ${result.fromRoom}\nTo: ${result.toRoom}\nDoctor: ${result.attendingDoctor}`);
  } catch (error) {
    errEl.textContent = `Transfer failed: ${error.message || 'Unable to reach backend API.'}`;
    errEl.style.display = 'block';
  } finally {
    transferRequestInProgress = false;
    confirmBtn.disabled = false;
    cancelBtn.disabled = false;
    confirmBtn.textContent = 'Confirm Transfer';
  }
}

// DEPARTMENT 2: DOCTOR WARD ROUNDS HANDLER
async function handleAddTreatment() {
  if (!activeStaff.allowedDepts.includes('doctor')) {
    alert(`Access Denied: Logged in as ${activeStaff.name} (${activeStaff.title}).\nOnly Doctor/Physician staff can log ward round notes. Please switch staff account.`);
    return;
  }

  const patientSelectEl = document.getElementById('trtPatientSelect');
  const noteEl   = document.getElementById('trtNote');
  const bpSysEl  = document.getElementById('trtBpSys');
  const bpDiaEl  = document.getElementById('trtBpDia');
  const spo2El   = document.getElementById('trtSpo2');
  const hrEl     = document.getElementById('trtHr');
  const tempEl   = document.getElementById('trtTemp');

  const admissionId = patientSelectEl ? patientSelectEl.value : '';
  const admission = backendActiveAdmissions.find(item => item.admissionId === admissionId);
  if (!admissionId || !admission) {
    alert('Please select a valid admitted patient before logging a ward round instruction.');
    return;
  }

  const isValid = hmsValidateFields([
    { id: 'trtNote',   value: noteEl.value,   rules: [ruleRequired('Clinical note'), ruleMinLength(10, 'Clinical note')] },
    { id: 'trtBpSys',  value: bpSysEl.value,  rules: [ruleRequired('Systolic BP'), ruleNumericFloat('Systolic BP')] },
    { id: 'trtBpDia',  value: bpDiaEl.value,  rules: [ruleRequired('Diastolic BP'), ruleNumericFloat('Diastolic BP')] },
    { id: 'trtSpo2',   value: spo2El.value,   rules: [ruleRequired('SpO2'), ruleNumericFloat('SpO2')] },
    { id: 'trtHr',     value: hrEl.value,     rules: [ruleRequired('Heart rate'), ruleNumericFloat('Heart rate')] },
    { id: 'trtTemp',   value: tempEl.value,   rules: [ruleRequired('Temperature'), ruleNumericFloat('Temperature')] },
  ]);
  if (!isValid) return;

  // Doctor name & dept come from the active session, shown as read-only display
  const doctor = activeStaff.name;
  const department = admission.department || activeStaff.title;
  const note   = noteEl.value.trim();
  const bp     = `${parseFloat(bpSysEl.value)}/${parseFloat(bpDiaEl.value)} mmHg`;
  const spo2   = `${parseFloat(spo2El.value)}%`;
  const hr     = `${parseFloat(hrEl.value)} bpm`;
  const temp   = `${parseFloat(tempEl.value)}°F`;

  const observation = {
    patientId: admission.patientId,
    admissionId,
    doctorName: doctor,
    department,
    note,
    vitals: `BP: ${bp} | HR: ${hr} | SpO2: ${spo2} | Temp: ${temp}`,
    createdAt: new Date().toISOString()
  };

  const submitButton = document.querySelector('#addTreatmentForm [type="submit"]');
  if (submitButton) submitButton.disabled = true;

  try {
    const response = await fetch(
      `${HMS_API_BASE}/api/v1/admissions/${encodeURIComponent(admissionId)}/observations`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Staff-Request': 'true'
        },
        body: JSON.stringify(observation)
      }
    );
    const saved = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(admissionApiError(saved, response.status));
    }
    if (!saved || saved.admissionId !== admissionId || saved.patientId !== admission.patientId) {
      throw new Error('The server response did not match the selected admission.');
    }

    backendObservations = [saved, ...backendObservations]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    renderDoctorFeed();
    alert(`Doctor observation saved for ${admission.fullName} (${admissionId}).`);
  } catch (error) {
    console.error('Failed to save doctor observation:', error);
    alert(`Observation save failed: ${error.message || 'Unable to reach the observations API.'}`);
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

function renderDoctorFeed() {
  const feed = document.getElementById('doctorTimelineFeed');
  if (!feed) return;

  let html = '';
  backendObservations.forEach(observation => {
    const patient = backendAdmissions.find(item => item.admissionId === observation.admissionId);
    const patientLabel = patient
      ? `${patient.fullName} (${observation.admissionId})`
      : observation.admissionId;
    const date = new Date(observation.createdAt).toLocaleString();
    html += `
      <div style="background: var(--surface-variant); padding: 10px; border-radius: 8px; margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
          <strong>${escapeHtml(observation.doctorName)} (${escapeHtml(observation.department)})</strong>
          <span style="color: var(--cyan-primary); font-weight: 700;">${escapeHtml(date)}</span>
        </div>
        <div style="font-size: 11px; color: var(--cyan-primary); font-weight: 700; margin-bottom: 2px;"><i class="fa-solid fa-hospital-user"></i> ${escapeHtml(patientLabel)}</div>
        <div style="font-size: 12px; color: var(--text-secondary);">${escapeHtml(observation.note)}</div>
        <div style="font-size: 11px; font-weight: 700; color: var(--navy-dark); margin-top: 4px;">Vitals: ${escapeHtml(observation.vitals)}</div>
      </div>
    `;
  });
  feed.innerHTML = html;

  const statTrt = document.getElementById('statTreatmentsCount');
  if (statTrt) statTrt.innerText = backendObservations.length;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function formatDateForInput(dateVal) {
  if (!dateVal) return '';
  const str = String(dateVal).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (str.includes('T')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return str.split('T')[0];
  }
  const m = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) {
    const day = String(m[1]).padStart(2, '0');
    const month = String(m[2]).padStart(2, '0');
    const year = m[3];
    return `${year}-${month}-${day}`;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return '';
}

function formatTimeForInput(timeVal) {
  if (!timeVal) return '';
  const str = String(timeVal).trim();
  // 12-hour format e.g. "10:30 AM" or "02:45 PM"
  const m12 = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (m12) {
    let hours = parseInt(m12[1], 10);
    const minutes = m12[2];
    const meridiem = m12[3].toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  }
  // 24-hour format e.g. "14:30" or "14:30:00"
  const m24 = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m24) {
    return `${String(parseInt(m24[1], 10)).padStart(2, '0')}:${m24[2]}`;
  }
  return str;
}

function formatDateForDisplay(dateVal) {
  if (!dateVal) return '-';
  const str = String(dateVal);
  if (str.includes('T')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    }
    return str.split('T')[0];
  }
  return str;
}

function formatTimeForDisplay(timeVal) {
  if (!timeVal) return '';
  const str = String(timeVal).trim();
  if (/AM|PM/i.test(str)) return str;
  const m = str.match(/^(\d{1,2}):(\d{2})/);
  if (m) {
    let hours = parseInt(m[1], 10);
    const minutes = m[2];
    const meridiem = hours >= 12 ? 'PM' : 'AM';
    if (hours > 12) hours -= 12;
    if (hours === 0) hours = 12;
    return `${String(hours).padStart(2, '0')}:${minutes} ${meridiem}`;
  }
  return str;
}

function initScheduleDatePicker() {
  const dateInput = document.getElementById('scheduleEventDate');
  if (!dateInput) return;
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const minDate = `${yyyy}-${mm}-${dd}`;

  const max = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const maxY = max.getFullYear();
  const maxM = String(max.getMonth() + 1).padStart(2, '0');
  const maxD = String(max.getDate()).padStart(2, '0');
  const maxDate = `${maxY}-${maxM}-${maxD}`;

  dateInput.min = minDate;
  dateInput.max = maxDate;
}

function updateScheduleDoctorDisplay() {
  const admissionId = document.getElementById('scheduleAdmissionSelect')?.value;
  const admission = (backendActiveAdmissions || []).find(item => item.admissionId === admissionId) ||
                    (backendAdmissions || []).find(item => item.admissionId === admissionId) ||
                    (hmsDatabase?.patients || []).find(item => item.admissionId === admissionId);
  const patDisplay = document.getElementById('schedulePatientDisplay');
  const pidDisplay = document.getElementById('schedulePatientIdDisplay');
  const admDisplay = document.getElementById('scheduleAdmissionIdDisplay');
  const deptDisplay = document.getElementById('scheduleDeptDisplay');
  const roomDisplay = document.getElementById('scheduleRoomDisplay');
  const roomInput = document.getElementById('scheduleRoom');
  const docSelect = document.getElementById('scheduleDoctorSelect');
  const isEditMode = !!document.getElementById('scheduleRecordId')?.value;

  if (patDisplay) patDisplay.textContent = admission ? admission.fullName : '-';
  if (pidDisplay) pidDisplay.textContent = admission ? admission.patientId : '-';
  if (admDisplay) admDisplay.textContent = admission ? admission.admissionId : '-';
  if (deptDisplay) deptDisplay.textContent = admission ? (admission.department || 'General') : '-';
  if (roomDisplay) roomDisplay.textContent = admission ? (admission.roomNumber || 'Ward') : '-';

  if (admission) {
    const patientDept = admission.department || 'General';
    const patientRoom = admission.roomNumber || admission.room || 'General Ward';
    const patientDoctor = admission.attendingDoctor || 'Dr. Aris Thorne (Cardiology)';

    // Room is automatically obtained from active admission (read-only)
    if (roomInput && !isEditMode) {
      roomInput.value = patientRoom;
      roomInput.readOnly = true;
    }

    // Doctor dropdown must be department-specific and read-only (Req 2.2)
    if (docSelect && !isEditMode) {
      docSelect.innerHTML = '';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.disabled = true;
      placeholder.textContent = 'Select Doctor';
      docSelect.appendChild(placeholder);

      const deptDocs = getDoctorsForDepartment(patientDept, patientDoctor);
      deptDocs.forEach(doc => {
        const opt = document.createElement('option');
        opt.value = doc;
        opt.textContent = doc;
        docSelect.appendChild(opt);
      });

      docSelect.value = patientDoctor;
      docSelect.disabled = true;
      if (typeof docSelect._renderCustomDropdown === 'function') {
        docSelect._renderCustomDropdown();
      }
    }

    // Auto-fill visit date as today (read-only) (Req 2.2)
    const dateInput = document.getElementById('scheduleEventDate');
    if (dateInput && !isEditMode && !dateInput.value) {
      const now = new Date();
      dateInput.value = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      dateInput.readOnly = true;
    }

    // Auto-fill visit reason/type from admission (read-only) (Req 2.2)
    const typeInput = document.getElementById('scheduleAppointmentType');
    if (typeInput && !isEditMode && !typeInput.value) {
      typeInput.value = admission.reasonForAdmission || 'Regular Physician Visit';
      typeInput.readOnly = true;
    }
  } else if (!isEditMode) {
    if (roomInput) roomInput.value = '';
    if (docSelect) {
      docSelect.innerHTML = '<option value="" disabled selected>Select Doctor</option>';
      docSelect.value = '';
      docSelect.disabled = true;
      if (typeof docSelect._renderCustomDropdown === 'function') {
        docSelect._renderCustomDropdown();
      }
    }
  }
}

function handleScheduleDoctorChange() {
  // Read-only in visit flow
}

// ====================================================================
// Duty Nurse: Sub-View Navigation (Doctor Scheduling vs Lab Test Assignment)
// ====================================================================
function switchNurseSubTab(tabName) {
  const schedBtn = document.getElementById('nurseSubnavSchedulingBtn');
  const labBtn = document.getElementById('nurseSubnavLabAssignBtn');
  const schedView = document.getElementById('nurse-subview-scheduling');
  const labView = document.getElementById('nurse-subview-lab-assignment');

  if (tabName === 'lab-assignment') {
    if (schedView) schedView.style.display = 'none';
    if (labView) labView.style.display = 'block';
    if (schedBtn) {
      schedBtn.classList.remove('btn-primary');
      schedBtn.classList.add('btn-outline');
    }
    if (labBtn) {
      labBtn.classList.remove('btn-outline');
      labBtn.classList.add('btn-primary');
    }
    refreshNurseLabAssignmentPatientSelector();
    loadAndRenderNurseLabAssignments();
  } else {
    if (labView) labView.style.display = 'none';
    if (schedView) schedView.style.display = 'block';
    if (labBtn) {
      labBtn.classList.remove('btn-primary');
      labBtn.classList.add('btn-outline');
    }
    if (schedBtn) {
      schedBtn.classList.remove('btn-outline');
      schedBtn.classList.add('btn-primary');
    }
  }
}

// ====================================================================
// Duty Nurse: Dedicated Lab Test Assignment Form
// ====================================================================
let nurseLabSelectedPatient = null;
let nurseLabSelectedTests = [];
let backendNurseLabAssignments = [];

function refreshNurseLabAssignmentPatientSelector() {
  const select = document.getElementById('nurseLabAssignPatientSelect');
  if (!select) return;

  const prevValue = select.value;
  const patients = backendActiveAdmissions || [];
  const options = patients.map(p => ({
    value: p.admissionId,
    text: `${p.fullName} — Patient ID: ${p.patientId || 'N/A'}`
  }));

  syncSelectOptions(select, options, '-- Select Patient (Patient Name & Patient ID) --');

  if (select.value) {
    handleNurseLabPatientSelectChange();
  }
}

function handleNurseLabPatientSearchInput(query) {
  const select = document.getElementById('nurseLabAssignPatientSelect');
  if (!select) return;
  const q = String(query || '').trim().toLowerCase();
  const patients = backendActiveAdmissions || [];

  select.innerHTML = '';
  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.disabled = true;
  defaultOpt.selected = !nurseLabSelectedPatient;
  defaultOpt.textContent = '-- Select Patient (Patient Name & Patient ID) --';
  select.appendChild(defaultOpt);

  const filtered = q
    ? patients.filter(p => (p.fullName || '').toLowerCase().includes(q) || (p.patientId || '').toLowerCase().includes(q) || (p.admissionId || '').toLowerCase().includes(q))
    : patients;

  filtered.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.admissionId;
    opt.textContent = `${p.fullName} — Patient ID: ${p.patientId || 'N/A'}`;
    if (nurseLabSelectedPatient && nurseLabSelectedPatient.admissionId === p.admissionId) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });

  if (typeof select._renderCustomDropdown === 'function') {
    select._renderCustomDropdown();
  }
}

function handleNurseLabPatientSelectChange() {
  const select = document.getElementById('nurseLabAssignPatientSelect');
  const admId = select?.value;
  const contextCard = document.getElementById('nurseLabPatientContextCard');
  const successAlert = document.getElementById('nurseLabAssignSuccessAlert');
  const errorAlert = document.getElementById('nurseLabAssignErrorAlert');

  if (successAlert) successAlert.style.display = 'none';
  if (errorAlert) errorAlert.style.display = 'none';

  if (!admId) {
    nurseLabSelectedPatient = null;
    if (contextCard) contextCard.style.display = 'none';
    return;
  }

  const patient = (backendActiveAdmissions || []).find(p => p.admissionId === admId) ||
                  (backendAdmissions || []).find(p => p.admissionId === admId);

  if (patient) {
    nurseLabSelectedPatient = patient;
    if (contextCard) {
      document.getElementById('nlcPatientName').textContent = patient.fullName || '-';
      document.getElementById('nlcPatientId').textContent = patient.patientId || '-';
      document.getElementById('nlcAdmissionId').textContent = patient.admissionId || '-';
      document.getElementById('nlcDeptRoom').textContent = `${patient.department || patient.currentDept || 'General'} • Bed/Room: ${patient.roomNumber || patient.room || 'General Ward'}`;
      contextCard.style.display = 'block';
    }
  } else {
    nurseLabSelectedPatient = null;
    if (contextCard) contextCard.style.display = 'none';
  }
}

function handleNurseLabSelectOptionChange(val) {
  if (!val) return;
  addNurseLabTestToSelection(val);
  const select = document.getElementById('nurseLabAvailableSelect');
  if (select) {
    select.value = '';
    if (typeof select._renderCustomDropdown === 'function') {
      select._renderCustomDropdown();
    }
  }
}

function addNurseLabSelectedFromDropdown() {
  const select = document.getElementById('nurseLabAvailableSelect');
  if (!select || !select.value) return;
  addNurseLabTestToSelection(select.value);
  select.value = '';
  if (typeof select._renderCustomDropdown === 'function') {
    select._renderCustomDropdown();
  }
}

function addNurseLabTestToSelection(testName) {
  const trimmed = String(testName || '').trim();
  if (!trimmed) return;
  if (!nurseLabSelectedTests.includes(trimmed)) {
    nurseLabSelectedTests.push(trimmed);
    renderNurseLabSelectedChips();
    const errorAlert = document.getElementById('nurseLabAssignErrorAlert');
    if (errorAlert) errorAlert.style.display = 'none';
  }
}

function removeNurseLabTest(index) {
  if (index >= 0 && index < nurseLabSelectedTests.length) {
    nurseLabSelectedTests.splice(index, 1);
    renderNurseLabSelectedChips();
  }
}

function renderNurseLabSelectedChips() {
  const container = document.getElementById('nurseLabSelectedChipsContainer');
  const countEl = document.getElementById('nurseLabSelectedCount');
  if (countEl) countEl.textContent = nurseLabSelectedTests.length;
  if (!container) return;

  if (nurseLabSelectedTests.length === 0) {
    container.innerHTML = '<span id="nurseLabNoTestsNotice" style="font-size: 12px; color: var(--text-secondary); font-style: italic;">No lab tests selected yet. Choose one or more tests from the list above.</span>';
    return;
  }

  container.innerHTML = nurseLabSelectedTests.map((t, idx) => `
    <span class="badge" style="background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; font-size: 12px; padding: 5px 10px; display: inline-flex; align-items: center; gap: 6px; border-radius: 6px; font-weight: 600;">
      <i class="fa-solid fa-flask-vial"></i> ${escapeHtml(t)}
      <button type="button" onclick="removeNurseLabTest(${idx})" style="background: transparent; border: none; color: #0284c7; cursor: pointer; padding: 0 2px; font-size: 15px; line-height: 1; font-weight: bold;" title="Remove this test">&times;</button>
    </span>
  `).join('');
}

function resetNurseLabAssignmentForm() {
  const form = document.getElementById('nurseLabAssignmentForm');
  if (form) form.reset();
  nurseLabSelectedPatient = null;
  nurseLabSelectedTests = [];
  renderNurseLabSelectedChips();

  const contextCard = document.getElementById('nurseLabPatientContextCard');
  if (contextCard) contextCard.style.display = 'none';

  const searchInput = document.getElementById('nurseLabPatientSearchInput');
  if (searchInput) searchInput.value = '';

  const successAlert = document.getElementById('nurseLabAssignSuccessAlert');
  const errorAlert = document.getElementById('nurseLabAssignErrorAlert');
  if (successAlert) successAlert.style.display = 'none';
  if (errorAlert) errorAlert.style.display = 'none';

  refreshNurseLabAssignmentPatientSelector();
}

async function handleAssignLabTestsSubmit() {
  const successAlert = document.getElementById('nurseLabAssignSuccessAlert');
  const successMsg = document.getElementById('nurseLabAssignSuccessMsg');
  const errorAlert = document.getElementById('nurseLabAssignErrorAlert');
  const errorMsg = document.getElementById('nurseLabAssignErrorMsg');

  if (successAlert) successAlert.style.display = 'none';
  if (errorAlert) errorAlert.style.display = 'none';

  // 1. Validate patient is selected
  if (!nurseLabSelectedPatient || !nurseLabSelectedPatient.admissionId) {
    if (errorAlert && errorMsg) {
      errorMsg.textContent = 'Please search and select a patient before assigning lab tests.';
      errorAlert.style.display = 'block';
    } else {
      alert('Please search and select a patient before assigning lab tests.');
    }
    document.getElementById('nurseLabAssignPatientSelect')?.focus();
    return;
  }

  // 2. Validate at least one test selected
  if (!nurseLabSelectedTests || nurseLabSelectedTests.length === 0) {
    if (errorAlert && errorMsg) {
      errorMsg.textContent = 'Please select at least one laboratory test to assign.';
      errorAlert.style.display = 'block';
    } else {
      alert('Please select at least one laboratory test to assign.');
    }
    document.getElementById('nurseLabAvailableSelect')?.focus();
    return;
  }

  const btn = document.getElementById('btnAssignLabTests');
  if (btn) btn.disabled = true;

  try {
    const payload = {
      admissionId: nurseLabSelectedPatient.admissionId,
      patientId: nurseLabSelectedPatient.patientId,
      investigations: [...nurseLabSelectedTests],
      assignedBy: `${activeStaff.name || 'Duty Nurse'} (Duty Nurse)`
    };

    const res = await fetch(`${HMS_API_BASE}/api/hms/lab-assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to save lab assignments');

    const count = nurseLabSelectedTests.length;
    const patName = nurseLabSelectedPatient.fullName;
    const patId = nurseLabSelectedPatient.patientId;
    const admId = nurseLabSelectedPatient.admissionId;

    // Show success message
    if (successAlert && successMsg) {
      successMsg.innerHTML = `<strong>Success!</strong> Successfully assigned ${count} laboratory test(s) to <strong>${escapeHtml(patName)}</strong> (PID: ${escapeHtml(patId)} • ADM: ${escapeHtml(admId)}). The test(s) are now queued in the Lab Report Portal.`;
      successAlert.style.display = 'block';
    } else {
      alert(`Successfully assigned ${count} laboratory test(s) to ${patName} (${patId} • ${admId}).`);
    }

    // Clear selected tests
    nurseLabSelectedTests = [];
    renderNurseLabSelectedChips();

    // Reload assignments ledger
    await loadAndRenderNurseLabAssignments();
  } catch (err) {
    console.error('Failed to assign lab tests:', err);
    if (errorAlert && errorMsg) {
      errorMsg.textContent = `Assignment failed: ${err.message}`;
      errorAlert.style.display = 'block';
    } else {
      alert(`Assignment failed: ${err.message}`);
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function loadAndRenderNurseLabAssignments() {
  const tbody = document.getElementById('nurseLabAssignmentsLedgerBody');
  const badge = document.getElementById('nurseLabTotalAssignmentsBadge');
  if (!tbody) return;

  try {
    const res = await fetch(`${HMS_API_BASE}/api/hms/lab-assignments`);
    if (res.ok) {
      const data = await res.json();
      backendNurseLabAssignments = data.assignments || (Array.isArray(data) ? data : []);
    }
  } catch (err) {
    console.warn('Failed to fetch lab assignments ledger:', err);
  }

  if (badge) {
    badge.textContent = `${backendNurseLabAssignments.length} Assignment(s)`;
  }

  if (backendNurseLabAssignments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-secondary); padding: 18px;">No lab test assignments found. Assign tests using the form on the left.</td></tr>';
    return;
  }

  tbody.innerHTML = backendNurseLabAssignments.map(a => {
    const isCompleted = a.status === 'COMPLETED';
    const statusBadge = isCompleted
      ? '<span class="badge badge-success"><i class="fa-solid fa-circle-check"></i> Report Uploaded</span>'
      : '<span class="badge badge-warning"><i class="fa-solid fa-clock"></i> Assigned</span>';

    const pat = (backendActiveAdmissions || []).find(p => p.admissionId === a.admissionId || p.patientId === a.patientId) ||
                (backendAdmissions || []).find(p => p.admissionId === a.admissionId || p.patientId === a.patientId);
    const pName = pat ? pat.fullName : (a.patientId || 'Patient');
    const pId = a.patientId || (pat ? pat.patientId : '-');
    const admId = a.admissionId || '-';
    const assignedTime = a.createdAt ? formatDateForDisplay(a.createdAt) : 'Recently';

    return `
      <tr>
        <td><strong>${escapeHtml(pName)}</strong><br><span style="font-size: 11px; color: var(--text-secondary); font-family: monospace;">PID: ${escapeHtml(pId)} &bull; ADM: ${escapeHtml(admId)}</span></td>
        <td><strong>${escapeHtml(a.investigationName)}</strong></td>
        <td><span class="badge" style="background: #f1f5f9; color: var(--navy-dark);">${escapeHtml(a.category || 'General')}</span></td>
        <td>${statusBadge}</td>
        <td><span style="font-size: 12px; color: var(--text-secondary);">${escapeHtml(assignedTime)}</span></td>
      </tr>
    `;
  }).join('');
}

function renderScheduleRecords() {
  const tbody = document.getElementById('scheduleTableBody');
  if (tbody) {
    tbody.innerHTML = backendSchedules.map(schedule => {
      const pName = schedule.patientName || schedule.patientId || 'Patient';
      const pId = schedule.patientId || '-';
      const admId = schedule.admissionId || '-';
      const status = schedule.status || 'SCHEDULED';
      const statusClass = status === 'COMPLETED' ? 'badge-success' : status === 'CANCELLED' ? 'badge-danger' : 'badge-info';
      const recId = schedule.recordId || schedule.id;
      const formattedDate = formatDateForDisplay(schedule.eventDate || schedule.appointmentDate);
      const formattedTime = formatTimeForDisplay(schedule.appointmentTime);
      return `
        <tr>
          <td><strong>${escapeHtml(pName)}</strong><br><span style="font-size: 11px; color: var(--text-secondary); font-family: monospace;">PID: ${escapeHtml(pId)} &bull; ADM: ${escapeHtml(admId)}</span></td>
          <td><strong>${escapeHtml(schedule.doctor || schedule.doctorName)}</strong><br><span style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(schedule.department || 'General')}</span></td>
          <td>${escapeHtml(formattedDate)}<br><span style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(formattedTime)}</span></td>
          <td><strong>${escapeHtml(schedule.appointmentType)}</strong>${schedule.room ? `<br><span style="font-size: 11px; color: var(--text-secondary);"><i class="fa-solid fa-door-open"></i> ${escapeHtml(schedule.room)}</span>` : ''}${schedule.assignedLabReports ? `<div style="margin-top: 4px;"><span class="badge" style="background:#e0f2fe; color:#0369a1; border: 1px solid #bae6fd; font-size: 10px; font-weight: 600;"><i class="fa-solid fa-flask-vial"></i> Lab: ${escapeHtml(schedule.assignedLabReports)}</span></div>` : ''}</td>
          <td><span class="badge ${statusClass}">${escapeHtml(status)}</span></td>
          <td>
            <button type="button" class="btn btn-outline" style="padding: 4px 8px; font-size: 11px;" onclick="editScheduleRecord('${escapeHtml(recId)}')"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
          </td>
        </tr>`;
    }).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text-secondary);padding: 16px;">No visits scheduled yet.</td></tr>';
  }

  renderDoctorAssignedAppointments();
}

function renderDoctorAssignedAppointments() {
  const tbody = document.getElementById('doctorAssignedAppointmentsTbody');
  if (!tbody) return;

  const currentDoctorName = activeStaff.name;
  const isDoctor = activeStaff.allowedDepts.includes('doctor') && !activeStaff.allowedDepts.includes('nurse') && !activeStaff.allowedDepts.includes('admin');
  const appointments = isDoctor
    ? backendSchedules.filter(s => {
        const dName = s.doctor || s.doctorName || '';
        return dName.includes(currentDoctorName) || currentDoctorName.includes(dName.split(' ')[1] || '---');
      })
    : backendSchedules;

  tbody.innerHTML = appointments.map(schedule => {
    const pName = schedule.patientName || schedule.patientId || 'Patient';
    const pId = schedule.patientId || '-';
    const admId = schedule.admissionId || '-';
    const status = schedule.status || 'SCHEDULED';
    const statusClass = status === 'COMPLETED' ? 'badge-success' : status === 'CANCELLED' ? 'badge-danger' : 'badge-info';
    const id = schedule.id || schedule.recordId;
    const formattedDate = formatDateForDisplay(schedule.eventDate || schedule.appointmentDate);
    const formattedTime = formatTimeForDisplay(schedule.appointmentTime);
    return `
      <tr>
        <td><strong>${escapeHtml(pName)}</strong><br><span style="font-size: 11px; color: var(--text-secondary); font-family: monospace;">PID: ${escapeHtml(pId)} &bull; ADM: ${escapeHtml(admId)}</span></td>
        <td><strong>${escapeHtml(schedule.doctor || schedule.doctorName)}</strong></td>
        <td>${escapeHtml(formattedDate)} ${escapeHtml(formattedTime)}</td>
        <td><strong>${escapeHtml(schedule.appointmentType)}</strong></td>
        <td>${escapeHtml(schedule.room || 'Room N/A')}</td>
        <td><span class="badge ${statusClass}">${escapeHtml(status)}</span></td>
        <td>
          ${status === 'SCHEDULED' ? `<button type="button" class="btn btn-sm btn-success" style="padding: 4px 8px; font-size: 11px;" onclick="updateDoctorAppointmentStatus('${id}', 'COMPLETED')"><i class="fa-solid fa-check"></i> Mark Completed</button>` : `<span style="font-size: 11px; color: var(--text-secondary); font-weight: 600;">${status}</span>`}
        </td>
      </tr>`;
  }).join('') || `<tr><td colspan="7" style="text-align:center;color:var(--text-secondary);padding: 16px;">No visits assigned for ${escapeHtml(currentDoctorName)}.</td></tr>`;
}

async function updateDoctorAppointmentStatus(id, newStatus) {
  try {
    const res = await fetch(`${HMS_API_BASE}/api/hms/appointments/${encodeURIComponent(id)}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    if (!res.ok) throw new Error('Status update failed');
    await loadBackendSchedules();
  } catch (err) {
    console.error('Failed to update visit status:', err);
    alert('Failed to update visit status: ' + err.message);
  }
}

// Req 2.2: In the visit form/record, ONLY Time and Status are editable.
function editScheduleRecord(recordId) {
  const schedule = backendSchedules.find(item => String(item.recordId || item.id) === String(recordId));
  if (!schedule) {
    console.error('Visit schedule record not found for id:', recordId);
    return;
  }

  // Find linked admission from active, all, or memory database
  const admission = (backendActiveAdmissions || []).find(item => item.admissionId === schedule.admissionId) ||
                    (backendAdmissions || []).find(item => item.admissionId === schedule.admissionId) ||
                    (hmsDatabase?.patients || []).find(item => item.admissionId === schedule.admissionId);

  // Set hidden record id to flag Edit mode (applies only to this selected visit)
  const recordIdEl = document.getElementById('scheduleRecordId');
  if (recordIdEl) recordIdEl.value = recordId;

  // 1. Prefill Patient / Admission select and display (read-only)
  const admSelect = document.getElementById('scheduleAdmissionSelect');
  if (admSelect) {
    let opt = Array.from(admSelect.options).find(o => o.value === schedule.admissionId);
    if (!opt && schedule.admissionId) {
      opt = document.createElement('option');
      opt.value = schedule.admissionId;
      const pLabel = schedule.patientName || (admission ? admission.fullName : 'Patient');
      const pIdLabel = schedule.patientId || (admission ? admission.patientId : '-');
      opt.textContent = `${pLabel} (PID: ${pIdLabel} • ADM: ${schedule.admissionId} • ${schedule.room || 'Room N/A'})`;
      admSelect.appendChild(opt);
    }
    admSelect.value = schedule.admissionId;
    if (typeof admSelect._renderCustomDropdown === 'function') {
      admSelect._renderCustomDropdown();
    }
  }

  // Preserve and display Patient + Admission link (read-only)
  const patDisplay = document.getElementById('schedulePatientDisplay');
  const pidDisplay = document.getElementById('schedulePatientIdDisplay');
  const admDisplay = document.getElementById('scheduleAdmissionIdDisplay');
  const deptDisplay = document.getElementById('scheduleDeptDisplay');
  const roomDisplay = document.getElementById('scheduleRoomDisplay');

  const patientName = schedule.patientName || (admission ? admission.fullName : 'Patient');
  const patientId = schedule.patientId || (admission ? admission.patientId : '-');
  const patientDept = schedule.department || (admission ? (admission.department || admission.currentDept) : 'General');
  const patientRoom = schedule.room || (admission ? (admission.roomNumber || admission.room) : 'General Ward');

  if (patDisplay) patDisplay.textContent = patientName;
  if (pidDisplay) pidDisplay.textContent = patientId;
  if (admDisplay) admDisplay.textContent = schedule.admissionId || '-';
  if (deptDisplay) deptDisplay.textContent = patientDept;
  if (roomDisplay) roomDisplay.textContent = patientRoom;

  // 2. Prefill Doctor Dropdown filtered strictly to patient department (READ-ONLY)
  const docSelect = document.getElementById('scheduleDoctorSelect');
  const rawDoc = (schedule.doctor || schedule.doctorName || '').trim();
  if (docSelect) {
    docSelect.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.disabled = true;
    placeholder.textContent = 'Select Doctor';
    docSelect.appendChild(placeholder);

    const deptDocs = getDoctorsForDepartment(patientDept, rawDoc);
    deptDocs.forEach(doc => {
      const opt = document.createElement('option');
      opt.value = doc;
      opt.textContent = doc;
      docSelect.appendChild(opt);
    });

    docSelect.value = rawDoc || (deptDocs[0] || '');
    docSelect.disabled = true; // Req 2.2: read-only

    if (typeof docSelect._renderCustomDropdown === 'function') {
      docSelect._renderCustomDropdown();
    }
  }

  // 3. Status handling in Edit mode: EDITABLE (Scheduled, Completed, or Cancelled)
  const statusSelect = document.getElementById('scheduleStatus');
  const statusDisplay = document.getElementById('scheduleStatusDisplay');
  const targetStatus = (schedule.status || 'SCHEDULED').trim().toUpperCase();

  if (statusDisplay) statusDisplay.style.display = 'none';
  if (statusSelect) {
    statusSelect.style.display = '';
    const wrapper = statusSelect.closest('.custom-select-wrapper');
    if (wrapper) wrapper.style.display = '';

    let matchedStatus = Array.from(statusSelect.options).find(o => o.value && o.value.toUpperCase() === targetStatus);
    if (matchedStatus) {
      statusSelect.value = matchedStatus.value;
    } else {
      statusSelect.value = 'SCHEDULED';
    }
    if (typeof statusSelect._renderCustomDropdown === 'function') {
      statusSelect._renderCustomDropdown();
    }
  }

  // 4. Prefill Visit Date (READ-ONLY)
  const dateInput = document.getElementById('scheduleEventDate');
  if (dateInput) {
    dateInput.value = formatDateForInput(schedule.eventDate || schedule.appointmentDate);
    dateInput.readOnly = true; // Req 2.2: read-only
  }

  // 5. Prefill Visit Time (EDITABLE)
  const timeInput = document.getElementById('scheduleAppointmentTime');
  if (timeInput) {
    timeInput.value = formatTimeForInput(schedule.appointmentTime);
    timeInput.readOnly = false; // Req 2.2: editable
  }

  // 6. Prefill Visit Type / Reason (READ-ONLY)
  const typeInput = document.getElementById('scheduleAppointmentType');
  if (typeInput) {
    typeInput.value = schedule.appointmentType || 'Regular Physician Visit';
    typeInput.readOnly = true; // Req 2.2: read-only
  }

  // 7. Room / Location is read-only
  const roomInput = document.getElementById('scheduleRoom');
  if (roomInput) {
    roomInput.value = patientRoom;
    roomInput.readOnly = true; // Req 2.2: read-only
  }

  // 8. Button Behavior: Primary = Update Visit, Secondary = Cancel Edit
  const submitBtn = document.getElementById('scheduleSubmitButton');
  if (submitBtn) {
    submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Visit';
  }
  const clearBtn = document.getElementById('scheduleClearButton');
  if (clearBtn) {
    clearBtn.textContent = 'Cancel Edit';
  }

  document.getElementById('hmsScheduleForm')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Reset form to initial blank/default state without modifying or deleting visit
function resetScheduleForm() {
  const form = document.getElementById('hmsScheduleForm');
  if (form) form.reset();

  const recordId = document.getElementById('scheduleRecordId');
  if (recordId) recordId.value = '';

  const admSelect = document.getElementById('scheduleAdmissionSelect');
  if (admSelect) {
    admSelect.value = '';
    if (typeof admSelect._renderCustomDropdown === 'function') {
      admSelect._renderCustomDropdown();
    }
  }

  const docSelect = document.getElementById('scheduleDoctorSelect');
  if (docSelect) {
    docSelect.innerHTML = '<option value="" disabled selected>Select Doctor</option>';
    docSelect.value = '';
    docSelect.disabled = true;
    if (typeof docSelect._renderCustomDropdown === 'function') {
      docSelect._renderCustomDropdown();
    }
  }

  const statusDisplay = document.getElementById('scheduleStatusDisplay');
  const statusSelect = document.getElementById('scheduleStatus');
  if (statusDisplay) {
    statusDisplay.style.display = '';
    statusDisplay.value = 'Scheduled';
  }
  if (statusSelect) {
    statusSelect.style.display = 'none';
    statusSelect.value = 'SCHEDULED';
    const wrapper = statusSelect.closest('.custom-select-wrapper');
    if (wrapper) wrapper.style.display = 'none';
  }

  const dateInput = document.getElementById('scheduleEventDate');
  if (dateInput) {
    const now = new Date();
    dateInput.value = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    dateInput.readOnly = true;
  }

  const timeInput = document.getElementById('scheduleAppointmentTime');
  if (timeInput) timeInput.value = '';

  const typeInput = document.getElementById('scheduleAppointmentType');
  if (typeInput) {
    typeInput.value = '';
    typeInput.readOnly = true;
  }

  const roomInput = document.getElementById('scheduleRoom');
  if (roomInput) {
    roomInput.value = '';
    roomInput.readOnly = true;
  }

  const patDisplay = document.getElementById('schedulePatientDisplay');
  const pidDisplay = document.getElementById('schedulePatientIdDisplay');
  const admDisplay = document.getElementById('scheduleAdmissionIdDisplay');
  const deptDisplay = document.getElementById('scheduleDeptDisplay');
  const roomDisplay = document.getElementById('scheduleRoomDisplay');
  if (patDisplay) patDisplay.textContent = '-';
  if (pidDisplay) pidDisplay.textContent = '-';
  if (admDisplay) admDisplay.textContent = '-';
  if (deptDisplay) deptDisplay.textContent = '-';
  if (roomDisplay) roomDisplay.textContent = '-';

  dutyNurseSelectedInvestigations = [];
  renderDutyNurseLabTags();
  const labSel = document.getElementById('scheduleLabReportSelect');
  if (labSel) {
    labSel.value = '';
    if (typeof labSel._renderCustomDropdown === 'function') {
      labSel._renderCustomDropdown();
    }
  }

  const submitButton = document.getElementById('scheduleSubmitButton');
  if (submitButton) {
    submitButton.innerHTML = '<i class="fa-solid fa-calendar-plus"></i> Schedule Visit';
  }
  const clearBtn = document.getElementById('scheduleClearButton');
  if (clearBtn) {
    clearBtn.textContent = 'Clear';
  }
}

// Visit Save/Update handler (Req 2.1 & 2.2)
async function handleSaveSchedule() {
  if (!activeStaff.allowedDepts.includes('nurse') && !activeStaff.allowedDepts.includes('admin')) {
    alert(`Access Denied: Logged in as ${activeStaff.name} (${activeStaff.title}).\nDoctor visit scheduling is managed exclusively by operational staff (Duty Nurse). Doctors only see visits assigned to them.`);
    return;
  }

  const admissionSelect = document.getElementById('scheduleAdmissionSelect');
  const doctorSelect = document.getElementById('scheduleDoctorSelect');
  const statusSelect = document.getElementById('scheduleStatus');
  const dateInput = document.getElementById('scheduleEventDate');
  const timeInput = document.getElementById('scheduleAppointmentTime');
  const typeInput = document.getElementById('scheduleAppointmentType');
  const roomInput = document.getElementById('scheduleRoom');
  const recordId = document.getElementById('scheduleRecordId')?.value;
  const isEdit = !!recordId;

  if (!admissionSelect || !admissionSelect.value) {
    alert('Please select an Active Patient / Admission for this visit.');
    admissionSelect?.focus();
    return;
  }

  const admissionId = admissionSelect.value;
  const admission = (backendActiveAdmissions || []).find(item => item.admissionId === admissionId) ||
                    (backendAdmissions || []).find(item => item.admissionId === admissionId) ||
                    (hmsDatabase?.patients || []).find(item => item.admissionId === admissionId);

  if (!admission && !isEdit) {
    alert(`Selected admission ${admissionId} is not active. Visits can only be scheduled for active admissions.`);
    return;
  }

  const patientDept = admission ? (admission.department || 'General') : 'General';
  const doctor = doctorSelect?.value || (admission ? admission.attendingDoctor : 'Attending Doctor');

  if (!timeInput || !timeInput.value) {
    alert('Please select a Visit Time.');
    timeInput?.focus();
    return;
  }

  let finalStatus = 'SCHEDULED';
  if (isEdit && statusSelect && statusSelect.value) {
    const sVal = statusSelect.value.toUpperCase();
    if (['SCHEDULED', 'COMPLETED', 'CANCELLED'].includes(sVal)) {
      finalStatus = sVal;
    }
  }

  const finalRoom = (roomInput && roomInput.value.trim()) ? roomInput.value.trim() : (admission ? (admission.roomNumber || admission.room || 'General Ward') : 'General Ward');
  let patientId = admission ? admission.patientId : 'UNKNOWN';
  if (patientId === 'UNKNOWN' && isEdit) {
    const existing = backendSchedules.find(s => String(s.recordId || s.id) === String(recordId));
    if (existing?.patientId) patientId = existing.patientId;
  }

  const payload = {
    id: isEdit ? (Number(recordId) || recordId) : undefined,
    recordId: isEdit ? (Number(recordId) || recordId) : undefined,
    admissionId,
    patientId,
    doctorName: doctor,
    department: patientDept,
    appointmentDate: dateInput.value || new Date().toISOString().slice(0, 10),
    appointmentTime: formatTimeForDisplay(timeInput.value),
    appointmentType: (typeInput && typeInput.value.trim()) || (admission ? admission.reasonForAdmission : 'Regular Physician Visit'),
    room: finalRoom,
    status: finalStatus,
    scheduledBy: `${activeStaff.name} (${activeStaff.title})`
  };

  const button = document.getElementById('scheduleSubmitButton');
  if (button) button.disabled = true;

  try {
    const url = isEdit ? `${HMS_API_BASE}/api/hms/appointments/${encodeURIComponent(recordId)}` : `${HMS_API_BASE}/api/hms/appointments`;
    const method = isEdit ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to save visit');

    resetScheduleForm();
    await loadBackendSchedules();
    if (typeof loadBackendLabAssignments === 'function') {
      await loadBackendLabAssignments();
    }
    const actionLabel = isEdit ? 'updated' : 'scheduled';
    alert(`Doctor visit successfully ${actionLabel} for ${admission ? admission.fullName : admissionId} with ${doctor} (Status: ${finalStatus}).`);
  } catch (error) {
    console.error('Failed to save visit:', error);
    alert(`Visit save failed: ${error.message}`);
  } finally {
    if (button) button.disabled = false;
  }
}

function updatePrescriptionDoctorDisplay() {
  const admissionId = document.getElementById('rxAdmissionSelect')?.value;
  const admission = backendActiveAdmissions.find(item => item.admissionId === admissionId);
  const doctor = document.getElementById('rxDoctorDisplay');
  if (doctor) doctor.textContent = admission ? activeStaff.name : '-';
}

function renderBackendPrescriptions() {
  const tbody = document.getElementById('backendPrescriptionsTbody');
  if (!tbody) return;
  tbody.innerHTML = backendPrescriptions.map(prescription => {
    const rxId = prescription.prescriptionId || prescription.id || '';
    const medName = prescription.medicineName || prescription.name || '';
    return `
      <tr>
        <td><strong>${escapeHtml(prescription.patientName || prescription.patientId)}</strong><br><span>${escapeHtml(prescription.admissionId)}</span></td>
        <td><strong>${escapeHtml(medName)}</strong><br><span style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(rxId)}</span></td>
        <td>${escapeHtml(prescription.prescriptionDate || '')}</td>
        <td>${escapeHtml(prescription.doctor || '')}</td>
      </tr>`;
  }).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text-secondary);">No prescriptions for current admissions.</td></tr>';
}

function editPrescriptionRecord() {
  // Doctor Portal must NOT allow the doctor to edit an already issued prescription
  console.warn('Prescription editing from Doctor Portal is disabled.');
}

function resetPrescriptionForm() {
  const form = document.getElementById('addPrescriptionForm');
  if (form) form.reset();
  const recordId = document.getElementById('rxRecordId');
  if (recordId) recordId.value = '';
  const dateInput = document.getElementById('rxPrescriptionDate');
  if (dateInput) {
    const now = new Date();
    dateInput.value = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
  const button = document.querySelector('#addPrescriptionForm [type="submit"]');
  if (button) button.innerHTML = '<i class="fa-solid fa-file-medical"></i> Save Prescription';
  updatePrescriptionDoctorDisplay();
}

// ISSUE PRESCRIPTION HANDLER
async function handleAddPrescription() {
  if (!activeStaff.allowedDepts.includes('doctor')) {
    alert(`Access Denied: Logged in as ${activeStaff.name} (${activeStaff.title}).\nOnly Physician staff can issue prescriptions. Please switch staff account.`);
    return;
  }
}

// ===============================================================
// PAGE 3: PRESCRIPTION & WARD ROUND (Req 3.1 - 3.4)
// ===============================================================
const DRUG_UNIT_MAP = {
  'Ceftriaxone 1g Injection (IV)': 'g',
  'Atorvastatin 20mg Tablet': 'mg',
  'Metformin 500mg Tablet': 'mg',
  'Amlodipine 5mg Tablet': 'mg',
  'Pantoprazole 40mg Tablet': 'mg',
  'Amoxicillin 500mg Capsule': 'mg',
  'Paracetamol 500mg Tablet': 'mg',
  'Azithromycin 250mg Tablet': 'mg',
  'Ondansetron 4mg Injection (IV)': 'mg',
  'Heparin 5000 IU Injection (SC)': 'IU',
  'Insulin Glargine 10 Units (SC)': 'IU',
  'Furosemide 40mg Tablet': 'mg',
  'Metoprolol 25mg Tablet': 'mg',
  'Salbutamol 2.5mg Nebulisation': 'mg',
  'Dexamethasone 4mg Injection (IV)': 'mg'
};

function handleRxMedNameChange() {
  const medSelect = document.getElementById('rxMedName');
  const unitSelect = document.getElementById('rxDosageUnit');
  if (!medSelect || !unitSelect) return;
  const medName = medSelect.value;
  if (!medName) return;

  // Req 3.1: Unit auto-populates from mapping and is read-only
  let unit = DRUG_UNIT_MAP[medName];
  if (!unit && backendMedicines) {
    const found = backendMedicines.find(m => m.name === medName);
    if (found?.dosageUnit) unit = found.dosageUnit;
  }
  if (!unit) {
    if (medName.includes('mg')) unit = 'mg';
    else if (medName.includes('IU') || medName.includes('Units')) unit = 'IU';
    else if (medName.includes('1g') || medName.includes('g ')) unit = 'g';
    else if (medName.includes('ml')) unit = 'ml';
    else if (medName.includes('Capsule')) unit = 'Capsule';
    else unit = 'Tablet';
  }

  unitSelect.value = unit;
  unitSelect.disabled = true;
  if (typeof unitSelect._renderCustomDropdown === 'function') {
    unitSelect._renderCustomDropdown();
  }
}

let pendingPrescriptionMedicines = [];

function handleAddMedicineToStaging() {
  const medNameEl       = document.getElementById('rxMedName');
  const dosageAmountEl  = document.getElementById('rxDosageAmount');
  const dosageUnitEl    = document.getElementById('rxDosageUnit');
  const frequencyEl     = document.getElementById('rxFrequency');
  const durationCountEl = document.getElementById('rxDurationCount');
  const durationUnitEl  = document.getElementById('rxDurationUnit');
  const routeEl         = document.getElementById('rxRoute');
  const instructionsEl  = document.getElementById('rxInstructions');

  if (!medNameEl || !medNameEl.value) {
    alert('Please select a medicine/drug name first.');
    medNameEl?.focus();
    return;
  }
  if (!dosageAmountEl?.value || !dosageUnitEl?.value) {
    alert('Please specify a valid dosage amount.');
    dosageAmountEl?.focus();
    return;
  }
  if (!frequencyEl?.value) {
    alert('Please select a frequency.');
    frequencyEl?.focus();
    return;
  }
  if (!durationCountEl?.value || !durationUnitEl?.value) {
    alert('Please enter a duration.');
    durationCountEl?.focus();
    return;
  }

  const item = {
    medicineName: medNameEl.value,
    dosage: `${dosageAmountEl.value.trim()} ${dosageUnitEl.value.trim()}`,
    dosageAmount: dosageAmountEl.value.trim(),
    dosageUnit: dosageUnitEl.value.trim(),
    frequency: frequencyEl.value,
    duration: `${durationCountEl.value.trim()} ${durationUnitEl.value.trim()}`,
    route: routeEl?.value || 'Oral',
    instructions: instructionsEl ? instructionsEl.value.trim() : ''
  };

  pendingPrescriptionMedicines.push(item);
  renderPendingMedicinesTable();
  resetPrescriptionItemInputs();
}

function removePendingMedicine(index) {
  pendingPrescriptionMedicines.splice(index, 1);
  renderPendingMedicinesTable();
}

function renderPendingMedicinesTable() {
  const tbody = document.getElementById('pendingMedicinesTbody');
  if (!tbody) return;
  if (pendingPrescriptionMedicines.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 12px;">No medicines added yet. Select a medicine and click "Add Medicine".</td></tr>';
    return;
  }

  tbody.innerHTML = pendingPrescriptionMedicines.map((m, idx) => `
    <tr>
      <td><strong>${escapeHtml(m.medicineName)}</strong></td>
      <td>${escapeHtml(m.dosage)}</td>
      <td>${escapeHtml(m.frequency)}</td>
      <td>${escapeHtml(m.duration)}</td>
      <td><span style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(m.instructions || '-')}</span></td>
      <td>
        <button type="button" class="btn btn-outline" style="color: var(--rose-danger); border-color: var(--rose-danger); padding: 2px 8px; font-size: 11px;" onclick="removePendingMedicine(${idx})">
          <i class="fa-solid fa-trash"></i> Remove
        </button>
      </td>
    </tr>
  `).join('');
}

function resetPrescriptionItemInputs() {
  const medNameEl = document.getElementById('rxMedName');
  if (medNameEl) {
    medNameEl.value = '';
    if (typeof medNameEl._renderCustomDropdown === 'function') medNameEl._renderCustomDropdown();
  }
  const dosageAmountEl = document.getElementById('rxDosageAmount');
  if (dosageAmountEl) dosageAmountEl.value = '';
  const dosageUnitEl = document.getElementById('rxDosageUnit');
  if (dosageUnitEl) {
    dosageUnitEl.value = '';
    if (typeof dosageUnitEl._renderCustomDropdown === 'function') dosageUnitEl._renderCustomDropdown();
  }
  const frequencyEl = document.getElementById('rxFrequency');
  if (frequencyEl) {
    frequencyEl.value = '';
    if (typeof frequencyEl._renderCustomDropdown === 'function') frequencyEl._renderCustomDropdown();
  }
  const durationCountEl = document.getElementById('rxDurationCount');
  if (durationCountEl) durationCountEl.value = '';
  const instructionsEl = document.getElementById('rxInstructions');
  if (instructionsEl) instructionsEl.value = '';
}

// Req 3.2: Confirm Prescription — Saves ONE prescription containing ALL listed medicines
async function handleConfirmPrescriptionBatch() {
  if (!activeStaff.allowedDepts.includes('doctor')) {
    alert(`Access Denied: Logged in as ${activeStaff.name} (${activeStaff.title}).\nOnly Physician staff can confirm and issue prescriptions.`);
    return;
  }

  const admissionSelect = document.getElementById('rxAdmissionSelect');
  const admissionId = admissionSelect ? admissionSelect.value : '';
  if (!admissionId) {
    alert('Please select an active patient / admission first.');
    admissionSelect?.focus();
    return;
  }

  const admission = backendActiveAdmissions.find(item => item.admissionId === admissionId);
  if (!admission) {
    alert('Select an active admission before issuing a prescription.');
    return;
  }

  // Block confirmation if medicine list is empty (Req 3.2)
  if (pendingPrescriptionMedicines.length === 0) {
    alert('Please add at least one medicine to the list before confirming the prescription.');
    document.getElementById('rxMedName')?.focus();
    return;
  }

  const dateEl = document.getElementById('rxPrescriptionDate');
  const prescriptionDate = dateEl?.value || new Date().toISOString().slice(0, 10);
  const doctor = activeStaff.name;

  const confirmBtn = document.getElementById('confirmPrescriptionBatchBtn');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Confirming...';
  }

  try {
    const payload = {
      admissionId,
      patientId: admission.patientId,
      doctor,
      prescriptionDate,
      medicines: pendingPrescriptionMedicines
    };

    const response = await fetch(`${HMS_API_BASE}/api/v1/admissions/${encodeURIComponent(admissionId)}/records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Staff-Request': 'true'
      },
      body: JSON.stringify({ resourceType: 'prescriptions', payload: JSON.stringify(payload) })
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(admissionApiError(result, response.status));

    const count = pendingPrescriptionMedicines.length;
    pendingPrescriptionMedicines = [];
    renderPendingMedicinesTable();
    resetPrescriptionItemInputs();
    await loadBackendPrescriptions();
    renderMostRecentPrescription(admissionId);
    alert(`Prescription containing ${count} medicine(s) confirmed and issued successfully for ${admission.fullName}. Synchronized with Pharmacy desk.`);
  } catch (error) {
    console.error('Prescription batch confirmation failed:', error);
    alert(`Prescription confirmation failed: ${error.message || 'Unable to save prescription.'}`);
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<i class="fa-solid fa-file-circle-check"></i> Confirm Prescription';
    }
  }
}

// Req 3.3: Most Recent Prescription Card (displays all medicines prescribed in it together)
function renderMostRecentPrescription(admissionId) {
  const container = document.getElementById('mostRecentPrescriptionCard');
  if (!container) return;

  if (!admissionId) {
    container.innerHTML = '<div style="padding: 16px; background: var(--surface-variant); border-radius: var(--radius-md); text-align: center; color: var(--text-secondary); font-size: 13px;">Select a patient to view their most recent prescription.</div>';
    return;
  }

  const patientRxs = (backendPrescriptions || []).filter(rx => rx.admissionId === admissionId);
  if (patientRxs.length === 0) {
    container.innerHTML = '<div style="padding: 16px; background: var(--surface-variant); border-radius: var(--radius-md); text-align: center; color: var(--text-secondary); font-size: 13px;">No prescriptions recorded yet for this admission.</div>';
    return;
  }

  // Group by groupId or prescriptionId
  const grouped = new Map();
  patientRxs.forEach(rx => {
    const key = rx.groupId || rx.prescriptionId || rx.id;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(rx);
  });

  // Pick the latest group (last entry in list)
  const groupKeys = Array.from(grouped.keys());
  const latestGroupKey = groupKeys[groupKeys.length - 1];
  const meds = grouped.get(latestGroupKey);
  const first = meds[0];

  container.innerHTML = `
    <div style="background: #ffffff; border: 1.5px solid var(--border); border-radius: var(--radius-md); padding: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.04);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
        <div>
          <strong style="color: var(--navy-dark); font-size: 14px;">Prescription: <code>${escapeHtml(latestGroupKey)}</code></strong>
          <div style="font-size: 12px; color: var(--text-secondary);">Date: ${escapeHtml(first.prescriptionDate || 'Recent')} &bull; Prescribed by: ${escapeHtml(first.doctor || 'Attending Physician')}</div>
        </div>
        <span class="badge ${first.paymentStatus === 'PAID' ? 'badge-success' : 'badge-neutral'}">${first.paymentStatus || 'UNPAID'}</span>
      </div>
      <div style="font-size: 12px; font-weight: 700; color: var(--text-secondary); margin-bottom: 6px;">Prescribed Medications (${meds.length}):</div>
      <table class="hms-table" style="font-size: 12px; margin-bottom: 0;">
        <thead>
          <tr>
            <th>Medicine</th>
            <th>Dosage</th>
            <th>Frequency</th>
            <th>Duration</th>
            <th>Instructions</th>
          </tr>
        </thead>
        <tbody>
          ${meds.map(m => `
            <tr>
              <td><strong>${escapeHtml(m.medicineName || m.name)}</strong></td>
              <td>${escapeHtml(m.dosage || '-')}</td>
              <td>${escapeHtml(m.frequency || '-')}</td>
              <td>${escapeHtml(m.duration || '-')}</td>
              <td><span style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(m.instructions || '-')}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Req 3.4: Ward Round Vitals History Table
function renderVitalsHistory(admissionId) {
  const tbody = document.getElementById('vitalsHistoryTbody');
  if (!tbody) return;

  if (!admissionId) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 12px;">Select a patient to view vitals history.</td></tr>';
    return;
  }

  const treatments = (backendObservations || []).filter(obs => obs.admissionId === admissionId);
  if (treatments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 12px;">No ward round entries recorded for this patient yet.</td></tr>';
    return;
  }

  tbody.innerHTML = treatments.map(t => {
    const dt = t.createdAt ? formatDateForDisplay(t.createdAt) : (t.date || '-');
    const doctor = t.doctorName || t.doctor || 'Physician';
    const vitalsStr = t.vitals || '';

    let bp = '-';
    let pulse = '-';
    let spo2 = '-';
    let temp = '-';
    if (vitalsStr) {
      const parts = vitalsStr.split('|');
      parts.forEach(p => {
        const trimmed = p.trim();
        if (trimmed.startsWith('BP:')) bp = trimmed.replace('BP:', '').trim();
        else if (trimmed.startsWith('HR:')) pulse = trimmed.replace('HR:', '').trim();
        else if (trimmed.startsWith('SpO2:')) spo2 = trimmed.replace('SpO2:', '').trim();
        else if (trimmed.startsWith('Temp:')) temp = trimmed.replace('Temp:', '').trim();
      });
    }

    return `
      <tr>
        <td>${escapeHtml(dt)}</td>
        <td><strong>${escapeHtml(doctor)}</strong></td>
        <td>${escapeHtml(bp)}</td>
        <td>${escapeHtml(pulse)}</td>
        <td>${escapeHtml(spo2)}</td>
        <td>${escapeHtml(temp)}</td>
        <td style="max-width: 220px; font-size: 11px;">${escapeHtml(t.note || '-')}</td>
      </tr>
    `;
  }).join('');
}

// ===============================================================
// PAGE 4: LABORATORY & DIAGNOSTICS (Req 4.1 - 4.5)
// ===============================================================
let selectedLabReportFile = null;

function handleLabPatientSearch(query) {
  const resultsContainer = document.getElementById('labPatientSearchResults');
  if (!resultsContainer) return;
  const q = (query || '').trim().toLowerCase();
  const admissions = backendActiveAdmissions || [];

  const matches = admissions.filter(a => {
    if (!q) return true;
    const pId = (a.patientId || '').toLowerCase();
    const name = (a.fullName || '').toLowerCase();
    return pId.includes(q) || name.includes(q);
  });

  if (matches.length === 0) {
    resultsContainer.innerHTML = '<div style="padding: 10px; color: var(--text-secondary); text-align: center; font-size: 12px;">No matching admitted patients found</div>';
    resultsContainer.style.display = 'block';
    return;
  }

  resultsContainer.innerHTML = matches.map(a => `
    <div class="combobox-item" onclick="selectLabPatient('${escapeHtml(a.admissionId)}', '${escapeHtml(a.patientId)}', '${escapeHtml(a.fullName)}')">
      <strong>${escapeHtml(a.patientId)}</strong> &bull; ${escapeHtml(a.fullName)}
      <div style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(a.department || 'General')} &bull; ${escapeHtml(a.roomNumber || 'Room')}</div>
    </div>
  `).join('');
  resultsContainer.style.display = 'block';
}

function selectLabPatient(admissionId, patientId, fullName) {
  const selectEl = document.getElementById('labPatientSelect');
  const searchInput = document.getElementById('labPatientSearchInput');
  const cardEl = document.getElementById('labSelectedPatientCard');
  const textEl = document.getElementById('labSelectedPatientText');
  const resultsContainer = document.getElementById('labPatientSearchResults');

  if (selectEl) {
    let opt = Array.from(selectEl.options).find(o => o.value === admissionId);
    if (!opt) {
      opt = document.createElement('option');
      opt.value = admissionId;
      selectEl.appendChild(opt);
    }
    opt.textContent = `${patientId} - ${fullName}`;
    selectEl.value = admissionId;
  }

  if (searchInput) searchInput.value = `${patientId} - ${fullName}`;
  if (textEl) textEl.textContent = `${patientId} - ${fullName} (Admission: ${admissionId})`;
  if (cardEl) cardEl.style.display = 'block';
  if (resultsContainer) resultsContainer.style.display = 'none';
  updateLabAssignedInvestigationsDropdown(admissionId);
}

// Close combobox when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('#labPatientSearchInput') && !e.target.closest('#labPatientSearchResults')) {
    const resultsContainer = document.getElementById('labPatientSearchResults');
    if (resultsContainer) resultsContainer.style.display = 'none';
  }
});

function handleLabReportFileSelect(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 15 * 1024 * 1024) {
    alert('File size exceeds the 15MB limit. Please select a smaller file.');
    event.target.value = '';
    return;
  }
  selectedLabReportFile = file;
  const fileNameDisplay = document.getElementById('labReportFileNameDisplay');
  const fileSizeDisplay = document.getElementById('labReportFileSizeDisplay');
  const fileCard = document.getElementById('labReportFileCard');
  const uploadArea = document.getElementById('labReportUploadArea');

  if (fileNameDisplay) fileNameDisplay.textContent = file.name;
  if (fileSizeDisplay) fileSizeDisplay.textContent = `${(file.size / 1024).toFixed(1)} KB`;
  if (fileCard) fileCard.style.display = 'flex';
  if (uploadArea) uploadArea.style.display = 'none';
}

function previewLabReportFile() {
  const fileUrl = document.getElementById('labReportFileUrl')?.value;
  if (fileUrl) {
    window.open(fileUrl.startsWith('http') ? fileUrl : `${HMS_API_BASE}${fileUrl}`, '_blank');
    return;
  }
  if (selectedLabReportFile) {
    const objectUrl = URL.createObjectURL(selectedLabReportFile);
    window.open(objectUrl, '_blank');
  }
}

function removeLabReportFile() {
  selectedLabReportFile = null;
  const fileInput = document.getElementById('labReportFileInput');
  if (fileInput) fileInput.value = '';
  const fileUrlInput = document.getElementById('labReportFileUrl');
  if (fileUrlInput) fileUrlInput.value = '';
  const fileNameInput = document.getElementById('labReportFileName');
  if (fileNameInput) fileNameInput.value = '';
  const fileCard = document.getElementById('labReportFileCard');
  if (fileCard) fileCard.style.display = 'none';
  const uploadArea = document.getElementById('labReportUploadArea');
  if (uploadArea) uploadArea.style.display = 'block';
}

// Upload Lab Test Report Handler (Req 4.4)
async function handleAddLabReport() {
  if (!activeStaff.allowedDepts.includes('laboratory')) {
    alert(`Access Denied: Logged in as ${activeStaff.name} (${activeStaff.title}).\nOnly Pathology & Laboratory staff can upload diagnostic reports. Please switch staff account.`);
    return;
  }

  const patientSelectEl = document.getElementById('labPatientSelect');
  const nameEl     = document.getElementById('labName');
  const categoryEl = document.getElementById('labCategory');

  if (!patientSelectEl || !patientSelectEl.value) {
    alert('Please select an active patient for this diagnostic report.');
    document.getElementById('labPatientSearchInput')?.focus();
    return;
  }
  if (!nameEl || !nameEl.value) {
    alert('Please select a test / report name.');
    nameEl?.focus();
    return;
  }

  const admissionId = patientSelectEl.value;
  const admission = backendActiveAdmissions.find(item => item.admissionId === admissionId);
  if (!admission) {
    alert('The selected admission is no longer active. Refresh the patient list.');
    return;
  }

  const title = nameEl.value;
  const department = categoryEl?.value || 'Pathology';
  const reportId = `LAB-${Date.now()}`;

  const submitButton = document.querySelector('#addLabReportForm [type="submit"]');
  if (submitButton) submitButton.disabled = true;

  try {
    let fileUrl = '';
    let fileName = '';

    // If an attachment file was provided, upload it
    if (selectedLabReportFile) {
      const base64Data = await readFileAsBase64(selectedLabReportFile);
      const uploadRes = await fetch(`${HMS_API_BASE}/api/hms/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: selectedLabReportFile.name, fileData: base64Data })
      });
      const uploadResult = await uploadRes.json();
      const returnedUrl = uploadResult?.url || uploadResult?.fileUrl;
      if (!uploadRes.ok || !returnedUrl) {
        throw new Error(uploadResult?.error || 'Failed to upload report file');
      }
      fileUrl = returnedUrl;
      fileName = uploadResult.filename || uploadResult.fileName || selectedLabReportFile.name;
    }

    const report = {
      reportId,
      admissionId,
      patientId: admission.patientId,
      title,
      department,
      status: 'Completed',
      notes: `Diagnostic Lab Report: ${title}`,
      fileUrl: fileUrl,
      fileName: fileName
    };

    const response = await fetch(
      `${HMS_API_BASE}/api/v1/admissions/${encodeURIComponent(admissionId)}/records`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Staff-Request': 'true'
        },
        body: JSON.stringify({ resourceType: 'tests', payload: JSON.stringify(report) })
      }
    );
    const saved = await response.json().catch(() => null);
    if (!response.ok) throw new Error(admissionApiError(saved, response.status));

    removeLabReportFile();
    await loadBackendLabReports();
    await updateLabAssignedInvestigationsDropdown(admissionId);
    alert(`Diagnostic lab report "${title}" uploaded and published for ${admission.fullName} (${admission.patientId}). Reference: ${reportId}`);
  } catch (error) {
    console.error('Failed to save lab report:', error);
    alert(`Lab report save failed: ${error.message || 'Unable to reach backend API.'}`);
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

function renderLabReports() {
  const tbody = document.getElementById('labReportsTbody');
  if (!tbody) return;

  tbody.innerHTML = backendLabReports.map(report => {
    const status = report.status || 'Completed';
    const badgeClass = status.includes('Elevated') || status.includes('Pending')
      ? 'badge-warning'
      : status.includes('Critical')
        ? 'badge-danger'
        : 'badge-success';
    const pName = report.patientName || report.patientId || 'Patient';
    const pId = report.patientId || 'N/A';
    const admId = report.admissionId || 'N/A';
    return `
      <tr>
        <td><strong>${escapeHtml(pName)}</strong><br><span style="font-size: 11px; color: var(--text-secondary); font-family: monospace;">PID: ${escapeHtml(pId)} &bull; ADM: ${escapeHtml(admId)}</span></td>
        <td><strong>${escapeHtml(report.title)}</strong><br><span style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(report.notes || '')}</span></td>
        <td>${escapeHtml(report.department || report.testType)}</td>
        <td><code>${escapeHtml(report.refNumber || report.reportId || report.id)}</code></td>
        <td><span class="badge ${badgeClass}">${escapeHtml(status)}</span></td>
      </tr>`;
  }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text-secondary);padding: 16px;">No diagnostic reports uploaded yet.</td></tr>';
}

async function loadBackendLabAssignments() {
  try {
    const res = await fetch(`${HMS_API_BASE}/api/hms/lab-assignments`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        backendLabAssignments = data;
      }
    }
  } catch (err) {
    console.warn('Failed to load lab assignments:', err);
  }
}

async function updateLabAssignedInvestigationsDropdown(admissionId) {
  const labNameSelect = document.getElementById('labName');
  const helpText = document.getElementById('labInvestigationHelpText');
  if (!labNameSelect) return;

  if (!admissionId) {
    labNameSelect.innerHTML = '<option value="" disabled selected>Select a patient to view assigned investigations</option>';
    labNameSelect.disabled = true;
    if (helpText) helpText.innerHTML = 'Only investigations assigned to the selected active patient appear here.';
    if (typeof labNameSelect._renderCustomDropdown === 'function') labNameSelect._renderCustomDropdown();
    return;
  }

  labNameSelect.innerHTML = '<option value="" disabled selected>Loading assigned investigations...</option>';
  labNameSelect.disabled = true;
  if (typeof labNameSelect._renderCustomDropdown === 'function') labNameSelect._renderCustomDropdown();

  try {
    const res = await fetch(`${HMS_API_BASE}/api/v1/admissions/${encodeURIComponent(admissionId)}/lab-assignments`);
    let assignments = [];
    if (res.ok) {
      const data = await res.json();
      assignments = data.assignments || [];
    }

    // Filter to only pending ASSIGNED tests
    const pendingAssignments = assignments.filter(a => a.status === 'ASSIGNED');

    const catSelect = document.getElementById('labCategory');
    if (catSelect) {
      catSelect.value = '';
      catSelect.disabled = true;
      if (typeof catSelect._renderCustomDropdown === 'function') catSelect._renderCustomDropdown();
    }

    labNameSelect.innerHTML = '';
    if (pendingAssignments.length === 0) {
      labNameSelect.innerHTML = '<option value="" disabled selected>No pending assigned investigations for this patient</option>';
      labNameSelect.disabled = true;
      if (helpText) {
        helpText.innerHTML = '<span style="color: #ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> No pending laboratory investigations assigned. Duty Nurse can assign an investigation during doctor visit scheduling.</span>';
      }
    } else {
      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.disabled = true;
      defaultOpt.selected = true;
      defaultOpt.textContent = `-- Select Assigned Investigation (${pendingAssignments.length} pending) --`;
      labNameSelect.appendChild(defaultOpt);

      pendingAssignments.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.investigationName;
        opt.textContent = `${a.investigationName} (${a.category || 'General'})`;
        opt.dataset.category = a.category || 'Pathology';
        labNameSelect.appendChild(opt);
      });

      labNameSelect.disabled = false;
      if (helpText) {
        helpText.innerHTML = `<span style="color: #0369a1;"><i class="fa-solid fa-circle-check"></i> ${pendingAssignments.length} assigned investigation(s) pending for this admission.</span>`;
      }
    }
  } catch (err) {
    console.error('Failed to load assigned investigations:', err);
    labNameSelect.innerHTML = '<option value="" disabled selected>Failed to load assigned investigations</option>';
    labNameSelect.disabled = true;
  }

  if (typeof labNameSelect._renderCustomDropdown === 'function') {
    labNameSelect._renderCustomDropdown();
  }
}

function handleLabInvestigationSelectChange(value) {
  const labNameSelect = document.getElementById('labName');
  const catSelect = document.getElementById('labCategory');
  if (!labNameSelect || !catSelect || !value) return;

  const selectedOpt = Array.from(labNameSelect.options).find(o => o.value === value);
  if (selectedOpt && selectedOpt.dataset.category) {
    const cat = selectedOpt.dataset.category;
    let matched = Array.from(catSelect.options).find(o => o.value.toLowerCase() === cat.toLowerCase());
    if (matched) {
      catSelect.value = matched.value;
    } else {
      const newOpt = document.createElement('option');
      newOpt.value = cat;
      newOpt.textContent = cat;
      catSelect.appendChild(newOpt);
      catSelect.value = cat;
    }
    catSelect.disabled = true;
    if (typeof catSelect._renderCustomDropdown === 'function') {
      catSelect._renderCustomDropdown();
    }
  }
}

// ====================================================================
// DEPARTMENT 4: PHARMACY WORKFLOW & DISPENSING (Req 8 & 9)
// ====================================================================

function clearPharmacyDispenseFields() {
  const medInput = document.getElementById('phmMedicineName');
  if (medInput) medInput.value = '';
  const qtyInput = document.getElementById('phmQuantity');
  if (qtyInput) qtyInput.value = '';
  const unitPriceInput = document.getElementById('phmUnitPrice');
  if (unitPriceInput) unitPriceInput.value = '';
  const totalInput = document.getElementById('phmTotalPrice');
  if (totalInput) totalInput.value = '0.00';
  const emgText = document.getElementById('phmEmergencyAmountText');
  if (emgText) emgText.textContent = '₹0.00';
}

function resetPharmacyDispenseForm() {
  const rxSelect = document.getElementById('phmPrescriptionSelect');
  if (rxSelect) rxSelect.value = '';
  clearPharmacyDispenseFields();
  const payTypeSelect = document.getElementById('phmPaymentType');
  if (payTypeSelect) payTypeSelect.value = '';
  const emergencyHelp = document.getElementById('phmEmergencyHelp');
  if (emergencyHelp) emergencyHelp.style.display = 'none';
  const counterSelect = document.getElementById('phmCounter');
  if (counterSelect) counterSelect.value = '';
  document.querySelectorAll('.phm-simple-rx-card').forEach(card => card.classList.remove('selected'));
}

function resetPharmacyOrderForm() {
  resetPharmacyDispenseForm();
}

function handlePhmPatientChange(isUserAction = false) {
  const patientSelect = document.getElementById('phmPatientSelect');
  if (!patientSelect) return;
  const admissionId = patientSelect.value;
  const admission = (backendActiveAdmissions || []).find(item => item.admissionId === admissionId) ||
                    (backendAdmissions || []).find(item => item.admissionId === admissionId) ||
                    (hmsDatabase?.patients || []).find(item => item.admissionId === admissionId);

  const infoCard = document.getElementById('phmPatientInfoCard');
  const nameDisp = document.getElementById('phmPatientNameDisplay');
  const pidDisp = document.getElementById('phmPatientIdDisplay');
  const admDisp = document.getElementById('phmAdmissionIdDisplay');
  const roomDisp = document.getElementById('phmRoomDisplay');

  if (admission && infoCard) {
    if (nameDisp) nameDisp.textContent = admission.fullName || admission.patientName;
    if (pidDisp) pidDisp.textContent = admission.patientId;
    if (admDisp) admDisp.textContent = admission.admissionId;
    if (roomDisp) roomDisp.textContent = admission.roomNumber || admission.room || 'Room N/A';
    infoCard.style.display = 'block';
  } else if (infoCard) {
    infoCard.style.display = 'none';
  }

  // Only reset dispense form when the patient selection has actually changed to a different admission
  // or user explicitly changed the patient dropdown
  if (admissionId !== lastPhmPatientAdmissionId || isUserAction) {
    lastPhmPatientAdmissionId = admissionId;
    resetPharmacyDispenseForm();
  }

  renderPharmacyPrescriptionsForAdmission(admissionId);
}

function formatPrescriptionDisplayDate(dateVal) {
  if (!dateVal) return '';
  const str = String(dateVal).trim();
  if (/^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$/.test(str)) {
    return str;
  }
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const y = parseInt(m[1], 10);
    const mon = parseInt(m[2], 10) - 1;
    const d = parseInt(m[3], 10);
    const dt = new Date(y, mon, d);
    if (!isNaN(dt.getTime())) {
      return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
  }
  const dt = new Date(str);
  if (!isNaN(dt.getTime())) {
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return str;
}

function getSimpleDispenseStatus(rx) {
  if (rx.isCollected || rx.status === 'Collected by Caregiver' || rx.status === 'DISPENSED' || rx.status === 'Dispensed') {
    return {
      label: 'DISPENSED',
      badgeClass: 'badge-success',
      iconHtml: '<i class="fa-solid fa-check"></i> '
    };
  }
  if (rx.status === 'Ready for Collection' || rx.status === 'READY' || rx.status === 'Ready') {
    return {
      label: 'READY',
      badgeClass: 'badge-warning',
      iconHtml: ''
    };
  }
  return {
    label: 'PENDING',
    badgeClass: 'badge-neutral',
    iconHtml: ''
  };
}

function renderPharmacyPrescriptionsForAdmission(admissionId) {
  const container = document.getElementById('phmAdmissionPrescriptionsContainer') || document.getElementById('phmAdmissionPrescriptionsTbody');
  const rxSelect = document.getElementById('phmPrescriptionSelect');
  if (!container) return;

  if (!admissionId) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-secondary); padding: 24px 16px; background: #ffffff; border: 1px dashed var(--border); border-radius: var(--radius-md); font-size: 13px;">
        Select a patient to view prescriptions.
      </div>
    `;
    if (rxSelect) {
      syncSelectOptions(rxSelect, [], 'Select Linked Prescription');
    }
    return;
  }

  // Filter prescriptions belonging ONLY to the selected patient / admission
  const patientPrescriptions = (backendPrescriptions || []).filter(rx => rx.admissionId === admissionId);

  // Group prescriptions by groupId (or prescriptionId)
  const groupsMap = new Map();
  patientPrescriptions.forEach(rx => {
    const gKey = rx.groupId || rx.prescriptionId || rx.id;
    if (!groupsMap.has(gKey)) {
      groupsMap.set(gKey, {
        groupId: gKey,
        prescriptionId: rx.prescriptionId || rx.id || gKey,
        doctor: rx.doctor || rx.attendingDoctor || 'Attending Physician',
        date: rx.prescriptionDate || rx.date || '',
        paymentStatus: (rx.paymentStatus || 'UNPAID').toUpperCase(),
        items: []
      });
    }
    const g = groupsMap.get(gKey);
    if (rx.paymentStatus && rx.paymentStatus.toUpperCase() === 'PAID') {
      g.paymentStatus = 'PAID';
    }
    g.items.push(rx);
  });

  // Build options for dispensing select
  const rxOptions = [];
  patientPrescriptions.forEach(rx => {
    const rxId = rx.prescriptionId || rx.id;
    const medName = rx.medicineName || rx.name;
    const isDispensed = rx.isCollected || rx.status === 'Collected by Caregiver' || rx.status === 'DISPENSED';
    rxOptions.push({
      value: rxId,
      text: `${medName} — ${rx.dosage || ''} ${isDispensed ? '(Dispensed)' : ''}`.trim()
    });
  });

  if (rxSelect) {
    const prevRxId = rxSelect.value;
    syncSelectOptions(rxSelect, rxOptions, 'Select Linked Prescription');
    if (prevRxId && rxSelect.value !== prevRxId) {
      clearPharmacyDispenseFields();
    }
  }

  if (groupsMap.size === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-secondary); padding: 24px 16px; background: #ffffff; border: 1px dashed var(--border); border-radius: var(--radius-md); font-size: 13px;">
        No doctor prescriptions issued for this admission yet.
      </div>
    `;
    return;
  }

  const selectedRxId = rxSelect ? rxSelect.value : '';

  // Minimal prescription reference / selection cards (clean presentation-only)
  container.innerHTML = Array.from(groupsMap.values()).map(group => {
    const formattedDate = formatPrescriptionDisplayDate(group.date);
    const pId = group.groupId || group.prescriptionId;
    const hasSelected = group.items.some(m => (m.prescriptionId || m.id) === selectedRxId);

    return `
      <div class="phm-simple-rx-card ${hasSelected ? 'selected' : ''}">
        <div class="rx-secondary-meta">
          <span>Prescription: <span class="rx-id">${escapeHtml(pId)}</span></span>
          <span>${escapeHtml(formattedDate)}</span>
        </div>
        ${group.items.map((m, idx) => {
          const mRxId = m.prescriptionId || m.id;
          const medName = m.medicineName || m.name || 'Prescribed Medicine';
          const statusInfo = getSimpleDispenseStatus(m);

          const parts = [];
          if (m.dosage && m.dosage.trim() && m.dosage.trim() !== '-') parts.push(m.dosage.trim());
          if (m.duration && m.duration.trim() && m.duration.trim() !== '-') parts.push(m.duration.trim());
          const dosageDuration = parts.join(' • ');

          const rawInstruction = (m.instructions || '').trim();
          const hasInstruction = rawInstruction && rawInstruction !== '-';

          return `
            ${idx > 0 ? '<div class="rx-divider"></div>' : ''}
            <div class="rx-med-item" data-rx-id="${escapeHtml(mRxId)}" style="cursor: pointer;" onclick="selectPrescriptionForDispensing('${escapeHtml(mRxId)}')">
              <div class="rx-med-header">
                <div class="rx-med-title">${escapeHtml(medName)}</div>
                <span class="badge ${statusInfo.badgeClass}" style="font-size: 10.5px; font-weight: 700; padding: 2px 7px; border-radius: 4px; flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px; letter-spacing: 0.3px;">${statusInfo.iconHtml}${statusInfo.label}</span>
              </div>
              ${dosageDuration ? `<div class="rx-dosage-duration">${escapeHtml(dosageDuration)}</div>` : ''}
              ${hasInstruction ? `<div class="rx-instruction">${escapeHtml(rawInstruction)}</div>` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }).join('');
}

function markGroupPrescriptionsReady(groupId) {
  backendPrescriptions.forEach(rx => {
    if ((rx.groupId || rx.prescriptionId || rx.id) === groupId) {
      rx.status = 'Ready for Collection';
      rx.badgeClass = 'badge-warning';
    }
  });
  const patSelect = document.getElementById('phmPatientSelect');
  if (patSelect && patSelect.value) {
    renderPharmacyPrescriptionsForAdmission(patSelect.value);
  }
  alert(`Prescription order ${groupId} marked as READY / AVAILABLE for collection.`);
}

function markPrescriptionReady(prescriptionId) {
  const rx = backendPrescriptions.find(item => (item.prescriptionId || item.id) === prescriptionId);
  if (rx) {
    rx.status = 'Ready for Collection';
    rx.badgeClass = 'badge-warning';
    const patSelect = document.getElementById('phmPatientSelect');
    renderPharmacyPrescriptionsForAdmission(patSelect ? patSelect.value : rx.admissionId);
    alert(`Prescription ${prescriptionId} marked as READY / AVAILABLE for collection.`);
  }
}

async function togglePrescriptionPayment(groupId, targetStatus) {
  try {
    const response = await fetch(`${HMS_API_BASE}/api/hms/prescriptions/${encodeURIComponent(groupId)}/payment`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentStatus: targetStatus })
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to update payment status');
    }

    backendPrescriptions.forEach(rx => {
      if ((rx.groupId || rx.prescriptionId || rx.id) === groupId || rx.id === groupId || rx.prescriptionId === groupId) {
        rx.paymentStatus = targetStatus;
      }
    });

    const patSelect = document.getElementById('phmPatientSelect');
    if (patSelect && patSelect.value) {
      renderPharmacyPrescriptionsForAdmission(patSelect.value);
    }
    const label = targetStatus === 'PAID' ? 'PAID' : 'NOT PAID';
    alert(`Prescription ${groupId} payment status updated to: ${label}`);
  } catch (err) {
    console.error('Failed to update prescription payment status:', err);
    alert(`Failed to update payment status: ${err.message}`);
  }
}

async function selectPrescriptionForDispensing(prescriptionId) {
  const rx = backendPrescriptions.find(item => (item.prescriptionId || item.id) === prescriptionId);
  if (!rx) return;

  const rxSelect = document.getElementById('phmPrescriptionSelect');
  if (rxSelect) rxSelect.value = prescriptionId;

  // Requirement 2: MEDICINE NAME & STRENGTH — AUTO-FILL (Read-only, non-editable)
  const medInput = document.getElementById('phmMedicineName');
  const medName = rx.medicineName || rx.name || '';
  if (medInput) medInput.value = medName;

  // Requirement 3: DISPENSE QUANTITY — AUTO-FILL FROM PRESCRIPTION
  const qtyInput = document.getElementById('phmQuantity');
  const qty = rx.quantity || rx.prescribedQuantity || calculatePrescriptionQuantity(rx.dosage, rx.frequency, rx.duration) || 1;
  if (qtyInput) qtyInput.value = qty;

  // Requirement 4: UNIT PRICE — AUTOMATICALLY FETCH (Authoritative medicine master)
  if (!backendMedicines || backendMedicines.length === 0) {
    await loadBackendMedicines();
  }
  const unitPrice = getMedicineUnitPrice(medName);
  const unitPriceInput = document.getElementById('phmUnitPrice');
  if (unitPriceInput) {
    unitPriceInput.value = unitPrice > 0 ? unitPrice.toFixed(2) : '25.00';
  }

  // Requirement 5: TOTAL BILLABLE AMOUNT — AUTOMATIC CALCULATION
  calculatePhmTotal();

  // If counter is not set yet, leave it at placeholder.
  // CRITICAL: Do NOT reset counterSelect if user ALREADY chose a counter!
  const counterSelect = document.getElementById('phmCounter');
  if (counterSelect && !counterSelect.value) {
    counterSelect.value = '';
  }

  // Update visual selection on minimal prescription cards
  document.querySelectorAll('.phm-simple-rx-card').forEach(card => card.classList.remove('selected'));
  const activeMedEl = document.querySelector(`.rx-med-item[data-rx-id="${prescriptionId}"]`);
  if (activeMedEl) {
    const parentCard = activeMedEl.closest('.phm-simple-rx-card');
    if (parentCard) parentCard.classList.add('selected');
  }

  document.getElementById('pharmacyDispenseForm')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function handlePhmPrescriptionChange() {
  const rxSelect = document.getElementById('phmPrescriptionSelect');
  const rxId = rxSelect?.value;
  if (!rxId) {
    // If placeholder re-selected, clear dependent fields
    clearPharmacyDispenseFields();
    return;
  }
  await selectPrescriptionForDispensing(rxId);
}

function calculatePhmTotal() {
  const qty = Number(document.getElementById('phmQuantity')?.value) || 0;
  const unitPrice = Number(document.getElementById('phmUnitPrice')?.value) || 0;
  const total = (qty * unitPrice).toFixed(2);
  const totalEl = document.getElementById('phmTotalPrice');
  const emgText = document.getElementById('phmEmergencyAmountText');
  if (totalEl) totalEl.value = total;
  if (emgText) emgText.textContent = '₹' + total;
}

function handlePhmPaymentTypeChange() {
  const paymentType = document.getElementById('phmPaymentType')?.value;
  const emergencyHelp = document.getElementById('phmEmergencyHelp');
  if (emergencyHelp) {
    emergencyHelp.style.display = paymentType === 'EMERGENCY_PAY_LATER' ? 'block' : 'none';
  }
}

// Req 8, 9, 13, 14: Pharmacy Dispense Handler with Price Security & Emergency Support
async function handlePharmacyDispense() {
  if (!activeStaff.allowedDepts.includes('pharmacy')) {
    alert(`Access Denied: Logged in as ${activeStaff.name} (${activeStaff.title}).\nOnly Pharmacy staff can dispense medications. Please switch staff account.`);
    return;
  }

  const patSelect = document.getElementById('phmPatientSelect');
  const rxSelect = document.getElementById('phmPrescriptionSelect');
  const medInput = document.getElementById('phmMedicineName');
  const qtyInput = document.getElementById('phmQuantity');
  const unitPriceInput = document.getElementById('phmUnitPrice');
  const totalInput = document.getElementById('phmTotalPrice');
  const payTypeSelect = document.getElementById('phmPaymentType');
  const counterSelect = document.getElementById('phmCounter');

  // Requirement 13: VALIDATION
  // 1. Patient / admission is not selected
  if (!patSelect || !patSelect.value) {
    alert('Please select an active patient / admission for pharmacy dispensing.');
    patSelect?.focus();
    return;
  }

  // 2. Doctor prescription is not selected (or still on placeholder)
  if (!rxSelect || !rxSelect.value) {
    alert('Please select a Linked Doctor Prescription before dispensing.');
    rxSelect?.focus();
    return;
  }

  const admissionId = patSelect.value;
  const admission = (backendActiveAdmissions || []).find(item => item.admissionId === admissionId) ||
                    (backendAdmissions || []).find(item => item.admissionId === admissionId) ||
                    (hmsDatabase?.patients || []).find(item => item.admissionId === admissionId);

  const prescriptionId = rxSelect.value;
  const rx = backendPrescriptions.find(item => (item.prescriptionId || item.id) === prescriptionId);
  if (!rx) {
    alert('Selected prescription could not be found in active records.');
    return;
  }

  // 3. Medicine cannot be resolved from the prescription
  const medicineName = (rx.medicineName || rx.name || medInput?.value || '').trim();
  if (!medicineName) {
    alert('Medicine could not be resolved from the selected doctor prescription.');
    return;
  }

  // 4. Dispense quantity is missing or invalid
  const quantity = Number(qtyInput?.value) || rx.quantity || rx.prescribedQuantity || 0;
  if (!quantity || quantity <= 0 || isNaN(quantity)) {
    alert('Dispense quantity is missing or invalid.');
    qtyInput?.focus();
    return;
  }

  // 5. Unit price cannot be resolved
  const unitPrice = Number(unitPriceInput?.value) || getMedicineUnitPrice(medicineName) || 0;
  if (!unitPrice || unitPrice <= 0 || isNaN(unitPrice)) {
    alert('Authoritative unit price could not be resolved for this medication.');
    return;
  }

  // 6. Payment / Dispensing Mode is not selected
  if (!payTypeSelect || !payTypeSelect.value) {
    alert('Please select a Payment / Dispensing Option (Immediate Counter Payment or Emergency Pay Later).');
    payTypeSelect?.focus();
    return;
  }
  const paymentType = payTypeSelect.value;

  // 7. Pickup counter / location is still at the placeholder
  const validCounters = [
    'Ground Floor Counter 1',
    'Ground Floor Counter 2',
    'Ground Floor Counter 3',
    'Emergency Pharmacy Counter'
  ];
  if (!counterSelect || !counterSelect.value || !validCounters.includes(counterSelect.value)) {
    alert('Please select a valid Pickup Counter / Location from the dropdown.');
    counterSelect?.focus();
    return;
  }
  const counter = counterSelect.value;

  // Authoritative total calculated
  const totalAmount = Number((quantity * unitPrice).toFixed(2));

  // Requirement 6: Dispense Token completely removed from request payload
  const dispensePayload = {
    admissionId,
    patientId: admission ? (admission.patientId || admission.patient_id) : (rx.patientId || 'UNKNOWN'),
    prescriptionId,
    medicineName,
    quantity,
    unitPrice,
    totalAmount,
    transactionType: paymentType,
    dispensedBy: `${activeStaff.name} (${activeStaff.title})`,
    pickupCounter: counter
  };

  const btn = document.getElementById('phmDispenseBtn');
  if (btn) btn.disabled = true;

  try {
    const response = await fetch(`${HMS_API_BASE}/api/hms/pharmacy/dispense`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dispensePayload)
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) {
      throw new Error(result?.error || 'Pharmacy dispensing failed');
    }

    const authoritativeTotal = result.totalAmount != null ? Number(result.totalAmount) : totalAmount;
    const authoritativePrice = result.unitPrice != null ? Number(result.unitPrice) : unitPrice;

    if (paymentType === 'EMERGENCY_PAY_LATER') {
      alert(`⚡ EMERGENCY PHARMACY DISPENSE AUTHORIZED!\n\nTransaction ID: ${result.txId}\nPrescription ID: ${prescriptionId}\nMedicine: ${medicineName} (Qty: ${quantity} @ ₹${authoritativePrice.toFixed(2)})\nTotal Amount: ₹${authoritativeTotal.toFixed(2)}\nPayment Status: PENDING (Emergency Pay Later)\nPickup Counter: ${counter}\n\nNote: ₹${authoritativeTotal.toFixed(2)} has been automatically billed to admission ${admissionId}'s outstanding hospital ledger.`);
    } else {
      alert(`Medication Dispensed Successfully!\n\nTransaction ID: ${result.txId}\nPrescription ID: ${prescriptionId}\nMedicine: ${medicineName} (Qty: ${quantity} @ ₹${authoritativePrice.toFixed(2)})\nTotal Amount: ₹${authoritativeTotal.toFixed(2)}\nPayment Status: PAID at counter.\nPickup Counter: ${counter}`);
    }

    // Reset dispensing form
    resetPharmacyDispenseForm();

    // Refresh data
    await loadBackendPharmacyOrders();
    await loadBackendPrescriptions();
    await loadHmsDatabase();

    // Re-render admission prescriptions
    renderPharmacyPrescriptionsForAdmission(admissionId);
  } catch (error) {
    console.error('Dispense error:', error);
    alert('Pharmacy dispensing failed: ' + error.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function loadBackendPharmacyOrders() {
  try {
    const res = await fetch(`${HMS_API_BASE}/api/hms/data`);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.pharmacyTransactions)) {
        const ptxMap = new Map();
        for (const tx of data.pharmacyTransactions) {
          const key = String(tx.txId || tx.id);
          if (!ptxMap.has(key)) {
            ptxMap.set(key, tx);
          }
        }
        backendPharmacyOrders = Array.from(ptxMap.values());
        renderPharmacyTransactions();
      }
    }
  } catch (e) {
    console.error('Failed to load pharmacy transactions:', e);
  }
}

function renderPharmacyTransactions() {
  const tbody = document.getElementById('phmTransactionsTbody');
  if (!tbody) return;

  tbody.innerHTML = backendPharmacyOrders.map(tx => {
    const adm = backendAdmissions.find(item => item.admissionId === tx.admissionId);
    const pName = adm ? adm.fullName : (tx.patientId || 'Patient');
    const isEmergency = tx.transactionType === 'EMERGENCY_PAY_LATER';
    const isPending = tx.paymentStatus === 'PENDING';
    const payBadge = isPending
      ? '<span class="badge badge-warning">PENDING (EMERGENCY)</span>'
      : '<span class="badge badge-success">PAID</span>';

    return `
      <tr>
        <td><code>${escapeHtml(tx.txId)}</code></td>
        <td><strong>${escapeHtml(pName)}</strong><br><span style="font-size: 11px; color: var(--text-secondary); font-family: monospace;">PID: ${escapeHtml(tx.patientId)} &bull; ADM: ${escapeHtml(tx.admissionId)}</span></td>
        <td><strong>${escapeHtml(tx.medicineName)}</strong><br><span style="font-size: 11px; color: var(--text-secondary);">Qty: ${escapeHtml(tx.quantity)} @ ₹${Number(tx.unitPrice || 0).toFixed(2)}</span></td>
        <td><strong style="color: var(--navy-dark); font-size: 14px;">₹${Number(tx.totalAmount || 0).toFixed(2)}</strong></td>
        <td><span class="badge badge-info">DISPENSED</span></td>
        <td>${payBadge}</td>
        <td>${escapeHtml(tx.pickupCounter || 'Counter 3')}<br><code style="font-size: 11px;">${escapeHtml(tx.pickupToken || '')}</code></td>
        <td>
          ${isPending ? `<button type="button" class="btn btn-sm btn-success" style="padding: 4px 8px; font-size: 11px;" onclick="handlePayEmergency('${escapeHtml(tx.txId)}')"><i class="fa-solid fa-money-bill-wave"></i> Settle Payment (₹${Number(tx.totalAmount).toFixed(2)})</button>` : `<span style="font-size: 11px; color: var(--emerald-success); font-weight: 700;"><i class="fa-solid fa-circle-check"></i> Settled</span>`}
        </td>
      </tr>`;
  }).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--text-secondary);padding: 16px;">No pharmacy dispensing transactions recorded yet.</td></tr>';
}

async function handlePayEmergency(txId) {
  if (!confirm(`Settle emergency pharmacy payment for transaction ${txId}? This will mark the transaction as PAID and reduce the patient's outstanding hospital balance.`)) {
    return;
  }

  try {
    const res = await fetch(`${HMS_API_BASE}/api/hms/pharmacy/pay-emergency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txId, method: 'Cash / Counter Settlement' })
    });
    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.error || 'Failed to settle emergency payment');
    }

    alert(`Emergency Pharmacy Transaction ${txId} successfully settled and marked as PAID!`);
    await loadBackendPharmacyOrders();
    await loadHmsDatabase();
    renderPaymentLedger();
  } catch (error) {
    console.error('Payment settlement error:', error);
    alert('Payment settlement failed: ' + error.message);
  }
}

// ===============================================================
// BILLING PORTAL: UNIFIED AUTO-CALCULATION & AUTHORITATIVE PRICING FOR ALL CATEGORIES
// ===============================================================
let currentAdmissionChargeInfo = null;
let currentAdmissionRoomTariff = null;

async function updateBillCategoryState() {
  const admSelect = document.getElementById('billAdmissionSelect');
  const catSelect = document.getElementById('billCategory');
  const amountEl = document.getElementById('billAmount');
  const descEl = document.getElementById('billDesc');
  const helperEl = document.getElementById('billRoomRentHelper');
  const submitBtn = document.querySelector('#addBillItemForm button[type="submit"]');

  if (!catSelect || !amountEl) return;

  const category = (catSelect.value || '').trim();

  // If no category selected (or placeholder): clear and reset fields cleanly
  if (!category) {
    amountEl.value = '';
    amountEl.readOnly = false;
    amountEl.style.backgroundColor = '';
    amountEl.style.cursor = '';
    amountEl.style.borderColor = '';
    amountEl.style.fontWeight = '';
    amountEl.placeholder = '0.00';
    if (descEl) {
      descEl.value = '';
      descEl.placeholder = 'Select category & patient to auto-fill description';
    }
    if (helperEl) {
      helperEl.style.display = 'none';
      helperEl.innerHTML = '';
    }
    if (submitBtn) submitBtn.disabled = false;
    return;
  }

  // Clear previous category's amount and description immediately when switching categories
  amountEl.value = '';
  if (descEl) descEl.value = '';

  const admissionId = admSelect ? admSelect.value : '';
  if (!admissionId) {
    amountEl.value = '';
    amountEl.readOnly = true;
    amountEl.style.backgroundColor = '#f8fafc';
    amountEl.style.cursor = 'not-allowed';
    amountEl.style.borderColor = '';
    amountEl.style.fontWeight = '';
    amountEl.placeholder = 'Select patient / admission first';
    if (descEl) {
      descEl.value = '';
      descEl.placeholder = `Select patient / admission to retrieve ${category} charge`;
    }
    if (helperEl) {
      helperEl.style.display = 'block';
      helperEl.innerHTML = `<span style="color: var(--text-secondary);"><i class="fa-solid fa-circle-info"></i> Select an active patient / admission to retrieve the <strong>${escapeHtml(category)}</strong> charge.</span>`;
    }
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  // Both Category and Admission are selected: query authoritative charge preview from backend
  try {
    amountEl.readOnly = true;
    amountEl.style.cursor = 'wait';
    amountEl.placeholder = 'Loading configured charge...';
    if (descEl) descEl.placeholder = `Fetching ${category} details...`;
    if (helperEl) {
      helperEl.style.display = 'block';
      helperEl.innerHTML = `<span style="color: var(--text-secondary);"><i class="fa-solid fa-spinner fa-spin"></i> Retrieving authoritative ${escapeHtml(category)} tariff for admission ${escapeHtml(admissionId)}...</span>`;
    }

    const res = await fetch(`${HMS_API_BASE}/api/hms/admissions/${encodeURIComponent(admissionId)}/charge-preview?category=${encodeURIComponent(category)}`);
    const data = await res.json();

    if (!res.ok || (!data.configured && !data.tariffConfigured)) {
      currentAdmissionChargeInfo = null;
      currentAdmissionRoomTariff = null;
      amountEl.value = '';
      amountEl.readOnly = true;
      amountEl.style.backgroundColor = '#fef2f2';
      amountEl.style.borderColor = '#f87171';
      amountEl.style.cursor = 'not-allowed';
      amountEl.style.fontWeight = 'normal';
      amountEl.placeholder = 'Tariff not configured';

      if (descEl) {
        descEl.value = data.description || '';
        descEl.placeholder = 'Tariff not configured';
      }

      if (helperEl) {
        helperEl.style.display = 'block';
        const errMsg = data.error || `Tariff is not configured for ${category}. Contact administrator to configure rates.`;
        helperEl.innerHTML = `<span style="color: var(--rose-danger); font-weight: 600;"><i class="fa-solid fa-triangle-exclamation"></i> ${escapeHtml(errMsg)}</span>`;
      }
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    // Configured tariff found!
    currentAdmissionChargeInfo = data;
    currentAdmissionRoomTariff = data;
    const finalRate = Number(data.amount != null ? data.amount : data.dailyRate);

    amountEl.value = finalRate.toFixed(2);
    amountEl.readOnly = true;
    amountEl.style.backgroundColor = '#f1f5f9';
    amountEl.style.borderColor = '#94a3b8';
    amountEl.style.cursor = 'not-allowed';
    amountEl.style.fontWeight = '700';

    if (descEl) {
      descEl.value = data.description || '';
      descEl.placeholder = 'Charge description';
    }

    if (helperEl) {
      helperEl.style.display = 'block';
      const helperMsg = data.helperText || `Auto-calculated from configured ${category} tariff`;
      helperEl.innerHTML = `<span style="color: var(--emerald-success); font-weight: 600;"><i class="fa-solid fa-circle-check"></i> ${escapeHtml(helperMsg)}</span>`;
    }
    if (submitBtn) submitBtn.disabled = false;

  } catch (err) {
    console.error('Error fetching charge preview:', err);
    amountEl.value = '';
    amountEl.readOnly = true;
    amountEl.style.backgroundColor = '#fef2f2';
    amountEl.style.cursor = 'not-allowed';
    if (helperEl) {
      helperEl.style.display = 'block';
      helperEl.innerHTML = `<span style="color: var(--rose-danger);"><i class="fa-solid fa-circle-exclamation"></i> Failed to retrieve ${escapeHtml(category)} charge from server: ${escapeHtml(err.message)}</span>`;
    }
    if (submitBtn) submitBtn.disabled = true;
  }
}

// Preserve backwards-compatible alias for Room Rent callers
const updateBillRoomRentState = updateBillCategoryState;

function handleBillAdmissionChange(isUserAction = false) {
  const admSelect = document.getElementById('billAdmissionSelect');
  const admissionId = admSelect ? admSelect.value : '';

  if (admissionId !== lastBillPatientAdmissionId || isUserAction) {
    lastBillPatientAdmissionId = admissionId;
    updateBillCategoryState();
  }
}

function handleBillCategoryChange() {
  updateBillCategoryState();
}

// Ensure Amount field cannot be manually changed when controlled by a configured charge/tariff
document.getElementById('billAmount')?.addEventListener('keydown', e => {
  if (e.target.readOnly) {
    e.preventDefault();
  }
});
document.getElementById('billAmount')?.addEventListener('paste', e => {
  if (e.target.readOnly) {
    e.preventDefault();
  }
});

// DEPARTMENT 5: BILLING HANDLER (Req 6)
function handleAddBillItem() {
  if (!activeStaff.allowedDepts.includes('billing')) {
    alert(`Access Denied: Logged in as ${activeStaff.name} (${activeStaff.title}).\nOnly Billing Officers can add hospital charges. Please switch staff account.`);
    return;
  }

  const admSelect = document.getElementById('billAdmissionSelect');
  const descEl = document.getElementById('billDesc');
  const categoryEl = document.getElementById('billCategory');
  const amountEl = document.getElementById('billAmount');

  // Validate dropdown placeholders (Req 6)
  if (!admSelect || !admSelect.value) {
    alert('Please select an active patient / admission for this charge. Unselected placeholders are not permitted.');
    admSelect?.focus();
    return;
  }
  if (!categoryEl || !categoryEl.value) {
    alert('Please select a charge category. Unselected placeholders are not permitted.');
    categoryEl?.focus();
    return;
  }

  const category = categoryEl.value;

  // Validate that a valid tariff/charge exists
  if (!amountEl.value || parseFloat(amountEl.value) <= 0) {
    alert(`Cannot add ${category} charge: Tariff is not configured for this patient's ${category}. Please contact an administrator.`);
    return;
  }

  const isValid = hmsValidateFields([
    { id: 'billDesc', value: descEl.value, rules: [ruleRequired('Charge description'), ruleMinLength(3, 'Charge description')] },
    { id: 'billAmount', value: amountEl.value, rules: [rulePositiveNumber('Amount')] },
  ]);
  if (!isValid) return;

  const admissionId = admSelect.value;
  const desc = descEl.value.trim();
  const amount = parseFloat(amountEl.value);

  // Send to backend (backend validates and uses authoritative tariff)
  fetch(`${HMS_API_BASE}/api/hms/billing/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ admissionId, description: desc, category, amount })
  }).then(async res => {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add charge');

    const finalAmount = Number(data.amount || amount);
    const finalDesc = data.description || desc;

    hmsDatabase.billing.items.push({ desc: finalDesc, category: category, amount: finalAmount });
    hmsDatabase.billing.totalBill += finalAmount;
    hmsDatabase.billing.remainingPayable = hmsDatabase.billing.totalBill - hmsDatabase.billing.insuranceCovered;

    renderPaymentLedger();
    await loadHmsDatabase();
    alert(`Hospital charge of ₹${finalAmount.toFixed(2)} added for admission ${admissionId}!\nTotal Bill: ₹${hmsDatabase.billing.totalBill.toFixed(2)}`);

    // Reset category, description, and amount cleanly
    if (categoryEl) categoryEl.value = '';
    if (descEl) {
      descEl.value = '';
      descEl.placeholder = 'Select category & patient to auto-fill description';
    }
    if (amountEl) {
      amountEl.value = '';
      amountEl.readOnly = false;
      amountEl.style.backgroundColor = '';
      amountEl.style.borderColor = '';
      amountEl.style.cursor = '';
      amountEl.placeholder = '0.00';
    }
    const helperEl = document.getElementById('billRoomRentHelper');
    if (helperEl) {
      helperEl.style.display = 'none';
      helperEl.innerHTML = '';
    }
  }).catch(e => {
    console.error('Failed to add bill item:', e);
    alert('Failed to add charge: ' + e.message);
  });
}

function handleUpdateInsuranceStatus() {
  if (!activeStaff.allowedDepts.includes('billing')) {
    alert(`Access Denied: Logged in as ${activeStaff.name} (${activeStaff.title}).\nOnly Billing Officers can update insurance claim status. Please switch staff account.`);
    return;
  }

  const select = document.getElementById('insuranceClaimStatusSelect');
  if (!select || !select.value) {
    alert('Please select an insurance claim status. Unselected placeholders are not permitted.');
    select?.focus();
    return;
  }

  const status = select.value;
  hmsDatabase.billing.claimStatus = status;
  saveHmsDatabase();
  alert(`Cashless Insurance Claim status updated to: ${status}`);
}

function renderPaymentLedger() {
  const tbody = document.getElementById('paymentLedgerTbody');
  if (!tbody) return;

  let html = '';
  hmsDatabase.payments.forEach(p => {
    html += `
      <tr>
        <td><code>${p.txId}</code></td>
        <td>${p.date}</td>
        <td>${p.method}</td>
        <td><strong style="color: var(--emerald-success);">₹${p.amount.toFixed(2)}</strong></td>
        <td><span class="badge badge-success">${p.status}</span></td>
      </tr>
    `;
  });
  tbody.innerHTML = html;

  const statBill = document.getElementById('statBillBalance');
  if (statBill) statBill.innerText = `₹${hmsDatabase.billing.remainingPayable.toFixed(2)}`;
}

// DEPARTMENT 6: DATABASE INSPECTOR HANDLER
function inspectTable(tableName) {
  const container = document.getElementById('tableInspectorContainer');
  if (!container) return;

  let data = hmsDatabase[tableName] || hmsDatabase.patients;
  if (tableName === 'billing') data = hmsDatabase.billing.items;

  if (!Array.isArray(data) || data.length === 0) {
    container.innerHTML = '<div style="padding: 16px; color: var(--text-secondary);">No records found in table.</div>';
    return;
  }

  const keys = Object.keys(data[0]);
  let html = '<table class="hms-table"><thead><tr>';
  keys.forEach(k => html += `<th>${k}</th>`);
  html += '</tr></thead><tbody>';

  data.forEach(row => {
    html += '<tr>';
    keys.forEach(k => {
      let val = row[k];
      if (typeof val === 'object') val = JSON.stringify(val);
      html += `<td>${val}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';

  container.innerHTML = html;
}

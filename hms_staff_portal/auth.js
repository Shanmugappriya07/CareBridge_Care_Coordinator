// ====================================================================
// St. Jude HMS — Shared Staff Authentication Module
// Loaded by BOTH login.html and index.html so there's exactly one
// source of truth for staff accounts and session state.
//
// NOTE: this is a client-side demo login for a mini/academic project —
// credentials are intentionally visible in this file and on the login
// page. It is NOT meant to be production-grade security.
// ====================================================================

const hmsStaffAccounts = {
  admin: {
    deptKey: 'admin',
    username: 'admin',
    password: 'admin123',
    name: 'Dr. Aris Thorne',
    title: 'Chief Medical Officer (Admin)',
    badge: 'CMO (Admin)',
    icon: 'fa-user-gear',
    allowedDepts: ['reception', 'nurse', 'doctor', 'laboratory', 'pharmacy', 'billing', 'inspector'],
    description: 'Full Access (All Departments & DB Inspector)'
  },
  reception: {
    deptKey: 'reception',
    username: 'reception',
    password: 'reception123',
    name: 'Clara Sterling',
    title: 'Senior Receptionist',
    badge: 'Reception & Admissions',
    icon: 'fa-id-card',
    allowedDepts: ['reception', 'inspector'],
    description: 'Admit Patients & Bind Primary Caregivers'
  },
  nurse: {
    deptKey: 'nurse',
    username: 'nurse',
    password: 'nurse123',
    name: 'Nurse Sarah Jenkins',
    title: 'Duty Nurse / Ward Incharge',
    badge: 'Duty Nurse & Scheduling',
    icon: 'fa-user-nurse',
    allowedDepts: ['nurse', 'inspector'],
    description: 'Ward Patient Care & Doctor Appointment Scheduling'
  },
  doctor: {
    deptKey: 'doctor',
    username: 'doctor',
    password: 'doctor123',
    name: 'Dr. Aris Thorne',
    title: 'Chief Cardiologist',
    badge: 'Doctor Ward Rounds',
    icon: 'fa-stethoscope',
    allowedDepts: ['doctor', 'inspector'],
    description: 'Log Ward Round Notes, Vitals & Prescriptions'
  },
  laboratory: {
    deptKey: 'laboratory',
    username: 'lab',
    password: 'lab123',
    name: 'Dr. Victor Vance',
    title: 'Chief Pathologist',
    badge: 'Pathology & Diagnostics',
    icon: 'fa-flask-vial',
    allowedDepts: ['laboratory', 'inspector'],
    description: 'Upload Diagnostic & Pathology Reports'
  },
  pharmacy: {
    deptKey: 'pharmacy',
    username: 'pharmacy',
    password: 'pharmacy123',
    name: 'Pharm. Maria Santos',
    title: 'Chief Pharmacist',
    badge: 'Pharmacy Dispensing',
    icon: 'fa-pills',
    allowedDepts: ['pharmacy', 'inspector'],
    description: 'Manage Pharmacy Queue & Drug Dispensing'
  },
  billing: {
    deptKey: 'billing',
    username: 'billing',
    password: 'billing123',
    name: 'Marcus Kane',
    title: 'Chief Billing Officer',
    badge: 'Billing & Insurance',
    icon: 'fa-file-invoice-dollar',
    allowedDepts: ['billing', 'inspector'],
    description: 'Hospital Itemized Charges & Insurance Claims'
  }
};

const HMS_STAFF_SESSION_KEY = 'hms_active_staff_session';

// Validate username/password against the account table.
// Returns the matching deptKey on success, or null on failure.
function hmsAuthenticate(username, password) {
  const uname = (username || '').trim().toLowerCase();
  const pass = password || '';
  for (const deptKey in hmsStaffAccounts) {
    const acc = hmsStaffAccounts[deptKey];
    if (acc.username.toLowerCase() === uname && acc.password === pass) {
      return deptKey;
    }
  }
  return null;
}

function hmsCreateSession(deptKey) {
  try {
    localStorage.setItem(HMS_STAFF_SESSION_KEY, JSON.stringify({
      deptKey: deptKey,
      loggedInAt: Date.now()
    }));
  } catch (e) {
    console.error('Failed to store staff session:', e);
  }
}

// Returns the logged-in deptKey, or null if there is no valid session.
function hmsGetSession() {
  try {
    const raw = localStorage.getItem(HMS_STAFF_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.deptKey && hmsStaffAccounts[parsed.deptKey]) {
      return parsed.deptKey;
    }
  } catch (e) {}
  return null;
}

function hmsIsLoggedIn() {
  return hmsGetSession() !== null;
}

function hmsClearSession() {
  try {
    localStorage.removeItem(HMS_STAFF_SESSION_KEY);
  } catch (e) {}
}

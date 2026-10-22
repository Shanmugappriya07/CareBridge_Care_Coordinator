// ====================================================================
// CareBridge / HMS Shared Backend
// One Express + MySQL API, called by BOTH:
//   - hms_staff_portal (web)      -> writes doctor/lab/pharmacy/billing data
//   - carebridge_app (Flutter)    -> reads it + writes payments/pickups
// Because both talk to the same MySQL database (carebridge_db) through
// this single server, any update made in the HMS instantly shows up in
// CareBridge (and vice versa) the next time that app polls/reads.
// ====================================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Graceful error handlers so unhandled connection failures never kill the server
process.on('unhandledRejection', (reason) => {
  console.warn('Database note (unhandled rejection):', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
  console.warn('Server exception handled:', err?.message || err);
});

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Ensure uploads directory exists and mount static route
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// File Upload Handler (for Discharge Summaries & Lab Test Reports)
const handleFileUpload = (req, res) => {
  try {
    const { filename, fileName, fileData, mimeType } = req.body;
    if (!fileData) {
      return res.status(400).json({ error: 'No file data provided.' });
    }
    const rawName = filename || fileName || 'document.pdf';
    const cleanName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const diskFileName = `${Date.now()}_${cleanName}`;
    const filePath = path.join(uploadsDir, diskFileName);

    const base64Data = fileData.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);

    const fileUrl = `/uploads/${diskFileName}`;
    res.json({
      success: true,
      fileUrl,
      url: fileUrl,
      fileName: rawName,
      filename: rawName,
      size: buffer.length
    });
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).json({ error: err.message });
  }
};

app.post('/api/v1/upload', handleFileUpload);
app.post('/api/hms/upload', handleFileUpload);

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'carebridge_db',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  connectTimeout: 2000,
});

pool.on('error', (err) => {
  console.warn('MySQL pool event:', err?.message || err);
});

// Resilient In-Memory Fallback Database (used if local MySQL service is stopped)
const memoryFallbackDb = {
  patients: [
    {
      admissionId: '26CAR008',
      patientId: '26PAT0001',
      fullName: 'Meenakshi Ravi',
      dob: '1968-04-12',
      age: 58,
      gender: 'Female',
      ageGender: '58 Y / Female',
      patientPhone: '+91 98111 22334',
      roomNumber: 'Cardio Ward Bed 3',
      attendingDoctor: 'Dr. Aris Thorne (Cardiology)',
      department: 'Cardiology',
      currentDept: 'Cardiology',
      status: 'ADMITTED',
      caregiverName: 'Priya Lakshmi',
      caregiverId: 'CG-991823',
      caregiverPhone: '+91 98765 43210',
      relation: 'Daughter',
      admissionType: 'Emergency',
      reasonForAdmission: 'Cardiac evaluation and monitoring',
      emergencyContactName: 'Karthik Raj',
      emergencyContactPhone: '+91 98761 23456',
      emergencyContactRelation: 'Other',
      carebridgeStatus: 'Active',
      carebridgeAccess: 'Active',
      admissionDate: '2026-10-06',
      admissionTime: '08:30:00'
    },
    {
      admissionId: '26CAR007',
      patientId: '26PAT0009',
      fullName: 'Kumar Sundaram',
      dob: '2016-08-10',
      age: 10,
      gender: 'Male',
      ageGender: '10 Y / Male',
      patientPhone: '+91 98435 17728',
      roomNumber: 'Paediatric Ward - Bed 1',
      attendingDoctor: 'Dr. Anita Rao (Paediatrics)',
      department: 'Paediatrics',
      currentDept: 'Paediatrics',
      status: 'ADMITTED',
      caregiverName: 'Ananya Krishnan',
      caregiverId: 'CG-151007',
      caregiverPhone: '+91 98435 17728',
      relation: 'Sister',
      admissionType: 'Referral',
      reasonForAdmission: 'Paediatric Observation & Care',
      admissionDate: '2026-10-05',
      admissionTime: '00:45:00'
    },
    {
      admissionId: '26MED001',
      patientId: '26PAT0008',
      fullName: 'Vignesh Natarajan',
      dob: '1984-06-20',
      age: 42,
      gender: 'Male',
      ageGender: '42 Y / Male',
      patientPhone: '+91 88701 67911',
      roomNumber: 'Private Room 501',
      attendingDoctor: 'Dr. Marcus Vance (Internal Med)',
      department: 'Internal Medicine',
      currentDept: 'Internal Medicine',
      status: 'ADMITTED',
      caregiverName: 'Kavitha Vignesh',
      caregiverId: 'CG-942355',
      caregiverPhone: '+91 88701 67911',
      relation: 'Spouse',
      admissionType: 'Emergency',
      reasonForAdmission: 'Internal Medicine Evaluation',
      admissionDate: '2026-10-04',
      admissionTime: '10:00:00'
    }
  ],
  treatments: [
    {
      id: 1,
      admissionId: '26CAR008',
      doctorName: 'Dr. Aris Thorne',
      dept: 'Cardiology',
      date: 'Today 09:30 AM',
      note: 'Cardiac rhythm stable. Continue liquid diet and ECG monitoring every 4 hours.',
      vitals: 'BP: 120/80 mmHg | HR: 74 bpm | SpO2: 98% | Temp: 98.6°F'
    }
  ],
  labReports: [
    {
      id: 'LAB-9921',
      admissionId: '26CAR008',
      patientId: '26PAT0001',
      title: 'Complete Blood Count (CBC)',
      category: 'Hematology',
      department: 'Hematology',
      status: 'Normal',
      badgeClass: 'badge-success',
      notes: 'Hemoglobin 13.8 g/dL, WBC and platelets within normal limits.'
    }
  ],
  labAssignments: [
    {
      id: 1,
      admissionId: '26CAR008',
      patientId: '26PAT0001',
      investigationName: 'Complete Blood Count (CBC)',
      category: 'Hematology',
      status: 'ASSIGNED',
      assignedBy: 'Duty Nurse Sister Lakshmi',
      appointmentId: 1,
      reportId: null
    },
    {
      id: 2,
      admissionId: '26CAR008',
      patientId: '26PAT0001',
      investigationName: 'Blood Glucose Fasting (FBS)',
      category: 'Biochemistry',
      status: 'ASSIGNED',
      assignedBy: 'Duty Nurse Sister Lakshmi',
      appointmentId: 1,
      reportId: null
    },
    {
      id: 3,
      admissionId: '26CAR008',
      patientId: '26PAT0001',
      investigationName: 'Liver Function Test (LFT)',
      category: 'Biochemistry',
      status: 'ASSIGNED',
      assignedBy: 'Duty Nurse Sister Lakshmi',
      appointmentId: 1,
      reportId: null
    }
  ],
  prescriptions: [
    {
      id: 'RX-101',
      admissionId: '26CAR008',
      patientId: '26PAT0001',
      name: 'Ceftriaxone 1g Injection (IV)',
      dosage: '1g Once Daily (09:00 AM)',
      duration: '5 Days Pack',
      counter: 'Ground Floor Counter 3',
      token: 'PH-4082',
      status: 'Ready for Collection',
      badgeClass: 'badge-warning',
      instructions: 'Administer slowly via IV line under nursing supervision.',
      isCollected: false
    }
  ],
  medicines: [
    { id: 1, name: 'Ceftriaxone 1g Injection', genericName: 'Ceftriaxone', form: 'Injection', unitPrice: 150, dosageUnit: 'g' },
    { id: 2, name: 'Atorvastatin 20mg Tablet', genericName: 'Atorvastatin', form: 'Tablet', unitPrice: 15, dosageUnit: 'mg' },
    { id: 3, name: 'Paracetamol 500mg Tablet', genericName: 'Paracetamol', form: 'Tablet', unitPrice: 3, dosageUnit: 'mg' }
  ],
  roomTariffs: [
    { id: 1, roomType: 'ICU', displayName: 'ICU Room', dailyRate: 12000, description: 'Intensive Care Unit' },
    { id: 2, roomType: 'General Ward', displayName: 'General Ward', dailyRate: 2000, description: 'Multi-bed ward' },
    { id: 3, roomType: 'Private Room', displayName: 'Private Room', dailyRate: 5000, description: 'Private room' }
  ],
  billing: {
    totalBill: 64500,
    insuranceCovered: 50000,
    remainingPayable: 14500,
    claimStatus: 'Approved',
    items: [
      { desc: 'ICU Room Charges (3 Days @ ₹12,000/day)', category: 'Room Rent', amount: 36000 },
      { desc: 'Doctor & Consultant Fee (Cardiology)', category: 'Consultation', amount: 12000 },
      { desc: 'Pharmacy & IV Medications', category: 'Pharmacy', amount: 8500 },
      { desc: 'Laboratory & CT Diagnostics', category: 'Diagnostics', amount: 8000 }
    ]
  },
  payments: [
    { txId: 'TXN-991823', admissionId: '26CAR008', date: '13-Aug-2026, 10:30 AM', dateLabel: '13-Aug-2026, 10:30 AM', date_label: '13-Aug-2026, 10:30 AM', method: 'UPI (Google Pay)', amount: 10000, status: 'Paid', payer: 'Priya Lakshmi (Caregiver)' }
  ],
  appointments: [
    {
      id: 1,
      admissionId: '26CAR008',
      patientId: '26PAT0001',
      doctorName: 'Dr. Aris Thorne (Cardiology)',
      department: 'Cardiology',
      appointmentDate: '2026-10-10',
      appointmentTime: '10:00 AM',
      appointmentType: 'Regular Physician Visit',
      room: 'Cardio Ward Bed 3',
      status: 'SCHEDULED',
      scheduledBy: 'Duty Nurse Sister Lakshmi',
      assignedLabReports: 'Complete Blood Count (CBC), Blood Glucose Fasting (FBS), Liver Function Test (LFT)'
    }
  ],
  pharmacyTransactions: [],
  patientsMaster: [],
  patientTransfers: [
    {
      id: 1,
      admissionId: '26CAR008',
      patientId: '26PAT0001',
      fromDept: 'Emergency',
      toDept: 'Cardiology',
      fromRoom: 'ICU Room 304',
      toRoom: 'Cardio Ward Bed 3',
      attendingDoctor: 'Dr. Aris Thorne (Cardiology)',
      reason: 'Post-stabilization step-down transfer',
      transferredBy: 'Sister Lakshmi (Staff Nurse)',
      transferDate: '2026-10-20 11:30:00'
    },
    {
      id: 2,
      admissionId: '26CAR007',
      patientId: '26PAT0009',
      fromDept: 'Paediatrics',
      toDept: 'Paediatrics',
      fromRoom: 'Paediatric Ward - Bed 2',
      toRoom: 'Semi-Private Room 401',
      attendingDoctor: 'Dr. Anita Rao (Paediatrics)',
      reason: 'Step-down to semi-private room',
      transferredBy: 'Reception Staff',
      transferDate: '2026-10-21 14:15:00'
    }
  ]
};

// Auto-create admission_caregivers table for secondary / family access
pool.query(`
  CREATE TABLE IF NOT EXISTS admission_caregivers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    admission_id VARCHAR(64) NOT NULL,
    caregiver_name VARCHAR(160) NOT NULL,
    caregiver_mobile VARCHAR(40) NOT NULL,
    relationship VARCHAR(80) NOT NULL DEFAULT 'Extended Family Member',
    access_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    role VARCHAR(32) NOT NULL DEFAULT 'READ_ONLY',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    disabled_at TIMESTAMP NULL,
    CONSTRAINT uq_admission_caregiver UNIQUE (admission_id, caregiver_mobile),
    INDEX idx_caregiver_mobile (caregiver_mobile),
    INDEX idx_caregiver_adm (admission_id),
    FOREIGN KEY (admission_id) REFERENCES admissions(admission_id) ON DELETE CASCADE
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`).catch(err => console.error('Table init error for admission_caregivers:', err.message || err));

// Auto-create lab_assignments table for Duty Nurse -> Lab Portal workflow
pool.query(`
  CREATE TABLE IF NOT EXISTS lab_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admission_id VARCHAR(64) NOT NULL,
    patient_id VARCHAR(64) NOT NULL,
    investigation_name VARCHAR(160) NOT NULL,
    category VARCHAR(64) NOT NULL DEFAULT 'Pathology',
    status VARCHAR(32) NOT NULL DEFAULT 'ASSIGNED',
    assigned_by VARCHAR(128) NOT NULL DEFAULT 'Duty Nurse',
    appointment_id INT NULL,
    report_id VARCHAR(64) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_lab_assign_adm (admission_id),
    INDEX idx_lab_assign_pat (patient_id),
    INDEX idx_lab_assign_status (status)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`).catch(err => console.error('Table init error for lab_assignments:', err.message || err));

// Ensure assigned_lab_reports column exists on doctor_appointments
pool.query(`
  ALTER TABLE doctor_appointments ADD COLUMN assigned_lab_reports VARCHAR(255) NULL
`).catch(() => {});



// ---------------------------------------------------------------
// Helpers: map MySQL rows <-> the exact JSON shape the frontends use
// ---------------------------------------------------------------
function formatDateOnly(d) {
  if (!d) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  if (d instanceof Date) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(d).slice(0, 10);
}

function mapPatient(p) {
  let g = p.gender;
  if (!g && p.age_gender) {
    const parts = p.age_gender.split('/');
    if (parts.length > 1) g = parts[1].trim();
  }
  if (g === 'Others' || g === 'Other') g = 'Transgender';

  let ageVal = p.age;
  if (!ageVal && p.age_gender) {
    const parsedAge = parseInt(p.age_gender, 10);
    if (!isNaN(parsedAge)) ageVal = parsedAge;
  }

  return {
    admissionId: p.admission_id,
    patientId: p.patient_id,
    fullName: p.full_name,
    dob: formatDateOnly(p.dob),
    age: ageVal,
    gender: g || 'Transgender',
    ageGender: p.age_gender || `${ageVal || ''} Y / ${g || 'Transgender'}`,
    patientPhone: p.patient_phone,
    roomNumber: p.room_number,
    attendingDoctor: p.attending_doctor,
    department: p.current_dept || getDepartmentCode(p.attending_doctor),
    currentDept: p.current_dept || getDepartmentCode(p.attending_doctor),
    status: p.status,
    caregiverName: p.caregiver_name,
    caregiverId: p.caregiver_id,
    caregiverPhone: p.caregiver_phone,
    relation: p.relation,
    admissionType: p.admission_type,
    reasonForAdmission: p.reason_for_admission,
    emergencyContactName: p.emergency_contact_name,
    emergencyContactPhone: p.emergency_contact_phone,
    emergencyContactRelation: p.emergency_contact_relation,
    carebridgeStatus: p.carebridge_status,
    carebridgeAccess: p.carebridge_access,
    admissionDate: formatDateOnly(p.admission_date),
    admissionTime: p.admission_time,
    dischargeDate: formatDateOnly(p.discharge_date),
    dischargeSummary: p.discharge_summary || null,
  };
}
function mapTreatment(t) {
  return {
    id: t.id,
    admissionId: t.admission_id,
    doctorName: t.doctor_name,
    dept: t.dept,
    date: t.date_label,
    note: t.note,
    vitals: t.vitals,
  };
}
function mapLabReport(l) {
  return {
    id: l.id,
    admissionId: l.admission_id,
    title: l.title,
    category: l.category,
    status: l.status,
    badgeClass: l.badge_class,
    notes: l.notes,
    fileUrl: l.file_url || null,
    fileName: l.file_name || null,
  };
}

function calculatePrescriptionQuantity(dosage, frequency, duration) {
  // Extract dosage amount (e.g. "1 Tablet" -> 1, "2 Capsule" -> 2)
  let doseNum = 1;
  if (dosage) {
    const m = String(dosage).match(/^(\d+(?:\.\d+)?)/);
    if (m) doseNum = parseFloat(m[1]);
  }

  // Frequency per day factor
  let freqPerDay = 1;
  const fLower = String(frequency || '').toLowerCase();
  if (fLower.includes('twice')) freqPerDay = 2;
  else if (fLower.includes('three')) freqPerDay = 3;
  else if (fLower.includes('four')) freqPerDay = 4;
  else if (fLower.includes('every 4 hour')) freqPerDay = 6;
  else if (fLower.includes('every 6 hour')) freqPerDay = 4;
  else if (fLower.includes('every 8 hour')) freqPerDay = 3;
  else if (fLower.includes('every 12 hour')) freqPerDay = 2;
  else if (fLower.includes('once')) freqPerDay = 1;

  // Duration days or pack count
  let days = 5;
  const durStr = String(duration || '');
  const packMatch = durStr.match(/^(\d+)\s*(tablets?|capsules?|pack)/i);
  if (packMatch) {
    return parseInt(packMatch[1], 10);
  }

  const dMatch = durStr.match(/^(\d+)\s*(day|week|month)/i);
  if (dMatch) {
    const num = parseInt(dMatch[1], 10);
    const unit = dMatch[2].toLowerCase();
    if (unit.startsWith('week')) days = num * 7;
    else if (unit.startsWith('month')) days = num * 30;
    else days = num;
  }

  return Math.max(1, Math.round(doseNum * freqPerDay * days));
}

function mapPrescription(r) {
  const pDate = formatDateOnly(r.prescription_date || r.created_at);
  const qty = r.quantity || calculatePrescriptionQuantity(r.dosage, r.frequency, r.duration);
  return {
    id: r.id,
    prescriptionId: r.id,
    groupId: r.group_id || r.id,
    paymentStatus: r.payment_status || 'UNPAID',
    admissionId: r.admission_id,
    patientId: r.patient_id,
    name: r.name,
    medicineName: r.name,
    dosage: r.dosage,
    frequency: r.frequency || '',
    duration: r.duration,
    quantity: qty,
    prescribedQuantity: qty,
    route: r.route || '',
    intake: r.route || '',
    prescriptionDate: pDate,
    doctor: r.doctor || 'Attending Physician',
    counter: r.counter,
    token: r.token,
    status: r.status,
    badgeClass: r.badge_class,
    instructions: r.instructions || '',
    isCollected: !!r.is_collected,
  };
}
function mapBillItem(i) {
  return { desc: i.description, category: i.category, amount: Number(i.amount) };
}
function mapPayment(p) {
  const dStr = p.date || p.date_label || p.dateLabel || '13-Aug-2026, 10:30 AM';
  return {
    txId: p.tx_id || p.txId,
    admissionId: p.admission_id || p.admissionId,
    date: dStr,
    dateLabel: dStr,
    date_label: dStr,
    method: p.method,
    payer: p.payer || 'Priya Lakshmi (Caregiver)',
    amount: Number(p.amount),
    status: p.status,
  };
}
function getInvestigationCategory(name) {
  const n = String(name || '').toLowerCase();
  if (n.includes('blood count') || n.includes('cbc') || n.includes('coagulation') || n.includes('pt/inr')) return 'Hematology';
  if (n.includes('glucose') || n.includes('lft') || n.includes('kft') || n.includes('lipid') || n.includes('enzyme') || n.includes('troponin') || n.includes('hba1c') || n.includes('thyroid') || n.includes('tft') || n.includes('metabolic') || n.includes('electrolyte')) return 'Biochemistry';
  if (n.includes('culture') || n.includes('urine') || n.includes('afb') || n.includes('rt-pcr') || n.includes('covid')) return 'Microbiology';
  return 'Pathology';
}

function mapLabAssignment(l) {
  return {
    id: l.id,
    admissionId: l.admission_id,
    patientId: l.patient_id,
    investigationName: l.investigation_name,
    category: l.category || 'Pathology',
    status: l.status || 'ASSIGNED',
    assignedBy: l.assigned_by || 'Duty Nurse',
    appointmentId: l.appointment_id || null,
    reportId: l.report_id || null,
    createdAt: l.created_at,
    updatedAt: l.updated_at
  };
}

function mapAppointment(a) {
  return {
    id: a.id,
    admissionId: a.admission_id,
    patientId: a.patient_id,
    doctorName: a.doctor_name,
    department: a.department,
    appointmentDate: a.appointment_date instanceof Date ? a.appointment_date.toISOString().slice(0, 10) : String(a.appointment_date || ''),
    appointmentTime: a.appointment_time,
    appointmentType: a.appointment_type,
    assignedLabReports: a.assigned_lab_reports || '',
    room: a.room || '',
    status: a.status || 'SCHEDULED',
    scheduledBy: a.scheduled_by || 'Duty Nurse',
    createdAt: a.created_at
  };
}
function mapPharmacyTransaction(t) {
  return {
    id: t.id,
    txId: t.tx_id,
    admissionId: t.admission_id,
    patientId: t.patient_id,
    prescriptionId: t.prescription_id,
    medicineName: t.medicine_name,
    quantity: Number(t.quantity),
    unitPrice: Number(t.unit_price),
    totalAmount: Number(t.total_amount),
    transactionType: t.transaction_type,
    paymentStatus: t.payment_status,
    dispensedBy: t.dispensed_by,
    pickupCounter: t.pickup_counter,
    pickupToken: t.pickup_token,
    notes: t.notes || '',
    createdAt: t.created_at
  };
}
function mapPatientMaster(p) {
  return {
    patientId: p.patient_id,
    fullName: p.full_name,
    dob: formatDateOnly(p.dob),
    ageGender: p.age_gender,
    patientPhone: p.patient_phone,
    bloodGroup: p.blood_group,
    emergencyContactName: p.emergency_contact_name,
    emergencyContactPhone: p.emergency_contact_phone,
    emergencyContactRelation: p.emergency_contact_relation,
    createdAt: p.created_at
  };
}

// Map Department names to short 3-letter codes for structured Admission IDs
function getDepartmentCode(deptName) {
  if (!deptName) return 'GEN';
  const upper = String(deptName).toUpperCase();
  if (upper.includes('CARDIO') || upper.includes('THORNE')) return 'CAR';
  if (upper.includes('PULMO') || upper.includes('ROSTOVA')) return 'PUL';
  if (upper.includes('INTERNAL') || upper.includes('MEDICINE')) return 'MED';
  if (upper.includes('EMERGENCY')) return 'EMG';
  if (upper.includes('PAEDIATRIC') || upper.includes('PEDIATRIC') || upper.includes('CHILD')) return 'PED';
  if (upper.includes('MATERNITY') || upper.includes('GYNEC')) return 'MAT';
  if (upper.includes('ICU') || upper.includes('CRITICAL')) return 'ICU';
  if (upper.includes('ORTHO')) return 'ORT';
  if (upper.includes('NEURO')) return 'NEU';
  if (upper.includes('ONCO')) return 'ONC';
  if (upper.includes('SURG')) return 'SUR';
  const clean = upper.replace(/^DR\.?\s*/i, '').replace(/[^A-Z]/g, '');
  return clean.slice(0, 3) || 'GEN';
}

// Atomically generate unique structured Patient ID (e.g. 26PAT0001) continuing from highest existing number
async function generateStructuredPatientId(conn) {
  const yearPrefix = String(new Date().getFullYear()).slice(-2) + 'PAT';
  const [rows] = await conn.query('SELECT patient_id FROM patients_master WHERE patient_id LIKE ?', [`${yearPrefix}%`]);
  let maxExisting = 0;
  for (const r of rows) {
    const m = String(r.patient_id).match(new RegExp(`^${yearPrefix}(\\d+)$`));
    if (m) {
      const val = parseInt(m[1], 10);
      if (val > maxExisting) maxExisting = val;
    }
  }

  await conn.query(
    `INSERT INTO id_sequences (seq_type, seq_prefix, current_value)
     VALUES ('PATIENT', ?, ?)
     ON DUPLICATE KEY UPDATE current_value = GREATEST(current_value + 1, ?)`,
    [yearPrefix, Math.max(1, maxExisting + 1), maxExisting + 1]
  );
  const [seqRows] = await conn.query(
    `SELECT current_value FROM id_sequences WHERE seq_type = 'PATIENT' AND seq_prefix = ?`,
    [yearPrefix]
  );
  let seq = seqRows[0]?.current_value || (maxExisting + 1);
  let candidate = `${yearPrefix}${String(seq).padStart(4, '0')}`;
  let [existing] = await conn.query('SELECT patient_id FROM patients_master WHERE patient_id = ?', [candidate]);
  while (existing.length > 0) {
    seq++;
    candidate = `${yearPrefix}${String(seq).padStart(4, '0')}`;
    await conn.query(
      `UPDATE id_sequences SET current_value = ? WHERE seq_type = 'PATIENT' AND seq_prefix = ?`,
      [seq, yearPrefix]
    );
    [existing] = await conn.query('SELECT patient_id FROM patients_master WHERE patient_id = ?', [candidate]);
  }
  return candidate;
}

// Atomically generate unique structured Admission ID (e.g. 26CAR001) continuing from highest existing number
async function generateStructuredAdmissionId(conn, deptCode) {
  const year = String(new Date().getFullYear()).slice(-2);
  const prefix = `${year}${deptCode}`;
  const [rows] = await conn.query('SELECT admission_id FROM admissions WHERE admission_id LIKE ?', [`${prefix}%`]);
  let maxExisting = 0;
  for (const r of rows) {
    const m = String(r.admission_id).match(new RegExp(`^${prefix}(\\d+)$`));
    if (m) {
      const val = parseInt(m[1], 10);
      if (val > maxExisting) maxExisting = val;
    }
  }

  await conn.query(
    `INSERT INTO id_sequences (seq_type, seq_prefix, current_value)
     VALUES ('ADMISSION', ?, ?)
     ON DUPLICATE KEY UPDATE current_value = GREATEST(current_value + 1, ?)`,
    [prefix, Math.max(1, maxExisting + 1), maxExisting + 1]
  );
  const [seqRows] = await conn.query(
    `SELECT current_value FROM id_sequences WHERE seq_type = 'ADMISSION' AND seq_prefix = ?`,
    [prefix]
  );
  let seq = seqRows[0]?.current_value || (maxExisting + 1);
  let candidate = `${prefix}${String(seq).padStart(3, '0')}`;
  let [existing] = await conn.query('SELECT admission_id FROM admissions WHERE admission_id = ?', [candidate]);
  while (existing.length > 0) {
    seq++;
    candidate = `${prefix}${String(seq).padStart(3, '0')}`;
    await conn.query(
      `UPDATE id_sequences SET current_value = ? WHERE seq_type = 'ADMISSION' AND seq_prefix = ?`,
      [seq, prefix]
    );
    [existing] = await conn.query('SELECT admission_id FROM admissions WHERE admission_id = ?', [candidate]);
  }
  return candidate;
}

// Atomically generate unique structured Prescription ID (e.g. 26CAR003-RX001)
async function generateStructuredPrescriptionId(conn, admissionId) {
  const prefix = `${admissionId}-RX`;

  // Find highest existing sequence in prescriptions table for this admission
  const [rows] = await conn.query(
    'SELECT id FROM prescriptions WHERE admission_id = ? AND id LIKE ?',
    [admissionId, `${prefix}%`]
  );
  let maxExisting = 0;
  const escapedPrefix = admissionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '-RX';
  const rxRegex = new RegExp(`^${escapedPrefix}(\\d+)$`);
  for (const r of rows) {
    const m = String(r.id).match(rxRegex);
    if (m) {
      const val = parseInt(m[1], 10);
      if (val > maxExisting) maxExisting = val;
    }
  }

  // Atomically update/fetch sequence from id_sequences table
  await conn.query(
    `INSERT INTO id_sequences (seq_type, seq_prefix, current_value)
     VALUES ('PRESCRIPTION', ?, ?)
     ON DUPLICATE KEY UPDATE current_value = GREATEST(current_value + 1, ?)`,
    [admissionId, Math.max(1, maxExisting + 1), maxExisting + 1]
  );
  const [seqRows] = await conn.query(
    `SELECT current_value FROM id_sequences WHERE seq_type = 'PRESCRIPTION' AND seq_prefix = ?`,
    [admissionId]
  );
  let seq = seqRows[0]?.current_value || (maxExisting + 1);
  let candidate = `${prefix}${String(seq).padStart(3, '0')}`;

  // Ensure collision safety against any pre-existing records
  let [exists] = await conn.query('SELECT id FROM prescriptions WHERE id = ?', [candidate]);
  while (exists.length > 0) {
    seq++;
    candidate = `${prefix}${String(seq).padStart(3, '0')}`;
    await conn.query(
      `UPDATE id_sequences SET current_value = ? WHERE seq_type = 'PRESCRIPTION' AND seq_prefix = ?`,
      [seq, admissionId]
    );
    [exists] = await conn.query('SELECT id FROM prescriptions WHERE id = ?', [candidate]);
  }
  return candidate;
}

// Endpoint to preview next sequential Patient and Admission IDs
app.get('/api/hms/next-ids', async (req, res) => {
  try {
    const dept = req.query.dept || req.query.department || 'Cardiology';
    const deptCode = getDepartmentCode(dept);
    const yearPrefix = String(new Date().getFullYear()).slice(-2) + 'PAT';
    const admPrefix = `${String(new Date().getFullYear()).slice(-2)}${deptCode}`;

    const [patRows] = await pool.query('SELECT patient_id FROM patients_master WHERE patient_id LIKE ?', [`${yearPrefix}%`]);
    let maxPat = 0;
    for (const r of patRows) {
      const m = String(r.patient_id).match(new RegExp(`^${yearPrefix}(\\d+)$`));
      if (m) {
        const val = parseInt(m[1], 10);
        if (val > maxPat) maxPat = val;
      }
    }
    const [patSeq] = await pool.query("SELECT current_value FROM id_sequences WHERE seq_type = 'PATIENT' AND seq_prefix = ?", [yearPrefix]);
    if (patSeq.length > 0 && Number(patSeq[0].current_value) > maxPat) {
      maxPat = Number(patSeq[0].current_value);
    }
    const nextPatientId = `${yearPrefix}${String(maxPat + 1).padStart(4, '0')}`;

    const [admRows] = await pool.query('SELECT admission_id FROM admissions WHERE admission_id LIKE ?', [`${admPrefix}%`]);
    let maxAdm = 0;
    for (const r of admRows) {
      const m = String(r.admission_id).match(new RegExp(`^${admPrefix}(\\d+)$`));
      if (m) {
        const val = parseInt(m[1], 10);
        if (val > maxAdm) maxAdm = val;
      }
    }
    const [admSeq] = await pool.query("SELECT current_value FROM id_sequences WHERE seq_type = 'ADMISSION' AND seq_prefix = ?", [admPrefix]);
    if (admSeq.length > 0 && Number(admSeq[0].current_value) > maxAdm) {
      maxAdm = Number(admSeq[0].current_value);
    }
    const nextAdmissionId = `${admPrefix}${String(maxAdm + 1).padStart(3, '0')}`;

    res.json({ patientId: nextPatientId, admissionId: nextAdmissionId });
  } catch (err) {
    const yearPrefix = String(new Date().getFullYear()).slice(-2) + 'PAT';
    const dept = req.query.dept || req.query.department || 'Cardiology';
    const deptCode = getDepartmentCode(dept);
    const admPrefix = `${String(new Date().getFullYear()).slice(-2)}${deptCode}`;
    res.json({ patientId: `${yearPrefix}0010`, admissionId: `${admPrefix}010` });
  }
});

// Build the full snapshot exactly as hmsDatabase / carebridgeHmsDb expect it
async function buildSnapshot() {
  try {
    const [patients] = await pool.query('SELECT * FROM patients ORDER BY created_at DESC');
    const [treatments] = await pool.query('SELECT * FROM treatments ORDER BY id DESC');
    const [labReports] = await pool.query('SELECT * FROM lab_reports ORDER BY created_at DESC');
    const [prescriptions] = await pool.query('SELECT * FROM prescriptions ORDER BY created_at DESC');
    const [billingRows] = await pool.query('SELECT * FROM billing_summary LIMIT 1');
    const [billItems] = await pool.query('SELECT * FROM bill_items');
    const [payments] = await pool.query('SELECT * FROM payments ORDER BY id DESC');
    const [appointments] = await pool.query('SELECT * FROM doctor_appointments ORDER BY appointment_date ASC, appointment_time ASC');
    const [pharmacyTransactions] = await pool.query('SELECT * FROM pharmacy_transactions ORDER BY id DESC');
    const [patientsMaster] = await pool.query('SELECT * FROM patients_master ORDER BY created_at DESC');
    const [medicines] = await pool.query('SELECT * FROM medicine_master ORDER BY name ASC');
    const [roomTariffs] = await pool.query('SELECT * FROM room_tariffs ORDER BY id ASC');
    let labAssignments = [];
    try {
      const [laRows] = await pool.query('SELECT * FROM lab_assignments ORDER BY created_at DESC');
      labAssignments = laRows;
    } catch (_) {}

    let patientTransfers = [];
    try {
      const [ptRows] = await pool.query('SELECT * FROM patient_transfers ORDER BY transfer_date ASC, id ASC');
      patientTransfers = ptRows;
    } catch (_) {}

    const billingRow = billingRows[0] || {
      total_bill: 0, insurance_covered: 0, remaining_payable: 0, claim_status: 'Pending',
    };

    return {
      patients: patients.map(mapPatient),
      treatments: treatments.map(mapTreatment),
      labReports: labReports.map(mapLabReport),
      labAssignments: labAssignments.map(mapLabAssignment),
      prescriptions: prescriptions.map(mapPrescription),
      medicines: medicines.map(m => ({ id: m.id, name: m.name, genericName: m.generic_name, form: m.form, unitPrice: Number(m.unit_price), dosageUnit: m.dosage_unit || 'mg' })),
      roomTariffs: roomTariffs.map(r => ({ id: r.id, roomType: r.room_type, displayName: r.display_name, dailyRate: Number(r.daily_rate), description: r.description })),
      patientTransfers: patientTransfers.map(t => ({
        id: t.id,
        admissionId: t.admission_id,
        patientId: t.patient_id,
        fromDept: t.from_dept,
        toDept: t.to_dept,
        fromRoom: t.from_room,
        toRoom: t.to_room,
        attendingDoctor: t.attending_doctor,
        reason: t.transfer_reason,
        transferredBy: t.transferred_by,
        transferDate: t.transfer_date
      })),
      billing: {
        totalBill: Number(billingRow.total_bill),
        insuranceCovered: Number(billingRow.insurance_covered),
        remainingPayable: Number(billingRow.remaining_payable),
        claimStatus: billingRow.claim_status,
        items: billItems.map(mapBillItem),
      },
      payments: payments.map(mapPayment),
      appointments: appointments.map(mapAppointment),
      pharmacyTransactions: pharmacyTransactions.map(mapPharmacyTransaction),
      patientsMaster: patientsMaster.map(mapPatientMaster),
    };
  } catch (err) {
    return memoryFallbackDb;
  }
}

// Medicine Master lookup endpoint
app.get('/api/hms/medicines', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM medicine_master ORDER BY name ASC');
    res.json(rows.map(m => ({ id: m.id, name: m.name, genericName: m.generic_name, form: m.form, unitPrice: Number(m.unit_price), dosageUnit: m.dosage_unit || 'mg' })));
  } catch (err) {
    res.json(memoryFallbackDb.medicines || []);
  }
});

// ---------------------------------------------------------------
// 1. GET full shared snapshot — polled by both HMS portal & CareBridge
// ---------------------------------------------------------------
app.get('/api/hms/data', async (req, res) => {
  try {
    res.json(await buildSnapshot());
  } catch (err) {
    res.json(memoryFallbackDb);
  }
});

// ---------------------------------------------------------------
// 2. POST full snapshot sync — either app can push its whole local
//    working copy back; the server replaces the DB rows with it in
//    one transaction, so both sides converge on the same MySQL state.
// ---------------------------------------------------------------
app.post('/api/hms/sync', async (req, res) => {
  const db = req.body || {};
  let conn;
  try {
    conn = await pool.getConnection();
  } catch (dbErr) {
    if (Array.isArray(db.patients)) memoryFallbackDb.patients = db.patients;
    if (Array.isArray(db.treatments)) memoryFallbackDb.treatments = db.treatments;
    if (Array.isArray(db.labReports)) memoryFallbackDb.labReports = db.labReports;
    if (Array.isArray(db.prescriptions)) memoryFallbackDb.prescriptions = db.prescriptions;
    if (db.billing) memoryFallbackDb.billing = db.billing;
    if (Array.isArray(db.payments)) memoryFallbackDb.payments = db.payments;
    if (Array.isArray(db.appointments)) memoryFallbackDb.appointments = db.appointments;
    return res.json({ success: true, snapshot: memoryFallbackDb });
  }
  try {
    await conn.beginTransaction();

    if (Array.isArray(db.patients)) {
      await conn.query('DELETE FROM patients WHERE admission_id NOT IN (?)', [
        db.patients.length ? db.patients.map((p) => p.admissionId) : [''],
      ]);
      for (const p of db.patients) {
        // Extract just YYYY-MM-DD from ISO timestamp if present
        let admissionDate = p.admissionDate;
        if (admissionDate && admissionDate.includes('T')) {
          admissionDate = admissionDate.split('T')[0];
        }
        
        await conn.query(
          `INSERT INTO patients (admission_id, patient_id, full_name, age_gender, patient_phone, room_number, attending_doctor, status, caregiver_name, caregiver_id, caregiver_phone, relation, admission_type, reason_for_admission, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, carebridge_status, carebridge_access, admission_date, admission_time)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE patient_id=VALUES(patient_id), full_name=VALUES(full_name), age_gender=VALUES(age_gender),
             patient_phone=VALUES(patient_phone), room_number=VALUES(room_number), attending_doctor=VALUES(attending_doctor),
             status=VALUES(status), caregiver_name=VALUES(caregiver_name), caregiver_id=VALUES(caregiver_id),
             caregiver_phone=VALUES(caregiver_phone), relation=VALUES(relation), admission_type=VALUES(admission_type),
             reason_for_admission=VALUES(reason_for_admission), emergency_contact_name=VALUES(emergency_contact_name),
             emergency_contact_phone=VALUES(emergency_contact_phone), emergency_contact_relation=VALUES(emergency_contact_relation),
             carebridge_status=VALUES(carebridge_status), carebridge_access=VALUES(carebridge_access),
             admission_date=VALUES(admission_date), admission_time=VALUES(admission_time)`,
          [p.admissionId, p.patientId, p.fullName, p.ageGender, p.patientPhone, p.roomNumber, p.attendingDoctor, p.status, p.caregiverName, p.caregiverId, p.caregiverPhone, p.relation, p.admissionType || 'Emergency', p.reasonForAdmission || '', p.emergencyContactName || '', p.emergencyContactPhone || '', p.emergencyContactRelation || 'Other', p.carebridgeStatus || 'Active', p.carebridgeAccess || 'Active', admissionDate || new Date().toISOString().slice(0,10), p.admissionTime || '00:00']
        );

        await conn.query(
          `INSERT INTO patients_master (patient_id, full_name, age_gender, patient_phone)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE full_name=VALUES(full_name), age_gender=VALUES(age_gender), patient_phone=VALUES(patient_phone)`,
          [p.patientId, p.fullName, p.ageGender, p.patientPhone]
        );

        await conn.query(
          `INSERT INTO admissions (admission_id, patient_id, admitting_dept, room_number, attending_doctor, status,
             caregiver_name, caregiver_id, caregiver_phone, relation, admission_type, reason_for_admission,
             carebridge_status, carebridge_access, admission_date, admission_time)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE patient_id=VALUES(patient_id), room_number=VALUES(room_number), attending_doctor=VALUES(attending_doctor),
             status=VALUES(status), caregiver_name=VALUES(caregiver_name), caregiver_id=VALUES(caregiver_id),
             caregiver_phone=VALUES(caregiver_phone), relation=VALUES(relation), admission_type=VALUES(admission_type),
             reason_for_admission=VALUES(reason_for_admission), carebridge_status=VALUES(carebridge_status), carebridge_access=VALUES(carebridge_access),
             admission_date=VALUES(admission_date), admission_time=VALUES(admission_time)`,
          [p.admissionId, p.patientId, p.admittingDept || getDepartmentCode(p.attendingDoctor), p.roomNumber, p.attendingDoctor, p.status || 'ADMITTED',
           p.caregiverName, p.caregiverId, p.caregiverPhone, p.relation, p.admissionType || 'Emergency', p.reasonForAdmission || '',
           p.carebridgeStatus || 'Active', p.carebridgeAccess || 'Active', admissionDate || new Date().toISOString().slice(0,10), p.admissionTime || '00:00']
        );
      }
    }

    if (Array.isArray(db.treatments)) {
      await conn.query('DELETE FROM treatments');
      // Frontends keep newest-first (unshift); insert oldest-first so
      // auto-increment id order (and our ORDER BY id DESC on read) comes
      // back out newest-first again.
      for (const t of [...db.treatments].reverse()) {
        await conn.query(
          `INSERT INTO treatments (admission_id, doctor_name, dept, date_label, note, vitals) VALUES (?, ?, ?, ?, ?, ?)`,
          [t.admissionId, t.doctorName, t.dept, t.date, t.note, t.vitals]
        );
      }
    }

    if (Array.isArray(db.labReports)) {
      await conn.query('DELETE FROM lab_reports');
      for (const l of [...db.labReports].reverse()) {
        await conn.query(
          `INSERT INTO lab_reports (id, admission_id, title, category, status, badge_class, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [l.id, l.admissionId, l.title, l.category, l.status, l.badgeClass, l.notes]
        );
      }
    }

    if (Array.isArray(db.labAssignments)) {
      for (const a of db.labAssignments) {
        if (!a.admissionId || !a.investigationName) continue;
        const [existing] = await conn.query(
          "SELECT id FROM lab_assignments WHERE admission_id = ? AND LOWER(TRIM(investigation_name)) = LOWER(TRIM(?)) LIMIT 1",
          [a.admissionId, a.investigationName]
        );
        if (existing.length === 0) {
          await conn.query(
            "INSERT INTO lab_assignments (admission_id, patient_id, investigation_name, category, status, assigned_by) VALUES (?, ?, ?, ?, ?, ?)",
            [a.admissionId, a.patientId, a.investigationName, a.category || 'Pathology', a.status || 'ASSIGNED', a.assignedBy || 'Duty Nurse']
          );
        } else {
          await conn.query(
            "UPDATE lab_assignments SET status = ?, report_id = COALESCE(?, report_id) WHERE id = ?",
            [a.status || 'ASSIGNED', a.reportId || null, existing[0].id]
          );
        }
      }
    }

    if (Array.isArray(db.prescriptions)) {
      await conn.query('DELETE FROM prescriptions');
      for (const r of [...db.prescriptions].reverse()) {
        await conn.query(
          `INSERT INTO prescriptions (id, admission_id, name, dosage, duration, counter, token, status, badge_class, instructions, is_collected) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [r.id, r.admissionId, r.name, r.dosage, r.duration, r.counter, r.token, r.status, r.badgeClass, r.instructions, r.isCollected ? 1 : 0]
        );
      }
    }

    if (db.billing) {
      const admissionId = (db.patients && db.patients[0] && db.patients[0].admissionId) || 'HMS-2026-8842';
      await conn.query(
        `INSERT INTO billing_summary (admission_id, total_bill, insurance_covered, remaining_payable, claim_status)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE total_bill=VALUES(total_bill), insurance_covered=VALUES(insurance_covered),
           remaining_payable=VALUES(remaining_payable), claim_status=VALUES(claim_status)`,
        [admissionId, db.billing.totalBill || 0, db.billing.insuranceCovered || 0, db.billing.remainingPayable || 0, db.billing.claimStatus || 'Pending']
      );

      if (Array.isArray(db.billing.items)) {
        await conn.query('DELETE FROM bill_items');
        for (const i of db.billing.items) {
          await conn.query(
            `INSERT INTO bill_items (admission_id, description, category, amount) VALUES (?, ?, ?, ?)`,
            [admissionId, i.desc, i.category, i.amount]
          );
        }
      }
    }

    if (Array.isArray(db.payments)) {
      const admissionId = (db.patients && db.patients[0] && db.patients[0].admissionId) || 'HMS-2026-8842';
      await conn.query('DELETE FROM payments');
      for (const p of [...db.payments].reverse()) {
        await conn.query(
          `INSERT INTO payments (tx_id, admission_id, date_label, method, amount, status) VALUES (?, ?, ?, ?, ?, ?)`,
          [p.txId, admissionId, p.date, p.method, p.amount, p.status]
        );
      }
    }

    await conn.commit();
    res.json({ success: true, snapshot: await buildSnapshot() });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) conn.release();
  }
});

// ---------------------------------------------------------------
// 3. Granular convenience endpoints (used by the Flutter app so it
//    doesn't have to reconstruct the whole snapshot for one action)
// ---------------------------------------------------------------

// Toggle a prescription's pickup status
app.put('/api/hms/prescriptions/:id/collect', async (req, res) => {
  try {
    const { id } = req.params;
    const { isCollected } = req.body;
    const status = isCollected ? 'Collected by Caregiver' : 'Ready for Collection';
    const badgeClass = isCollected ? 'badge-success' : 'badge-warning';
    await pool.query(
      'UPDATE prescriptions SET is_collected = ?, status = ?, badge_class = ? WHERE id = ?',
      [isCollected ? 1 : 0, status, badgeClass, id]
    );
    res.json({ success: true, snapshot: await buildSnapshot() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Record a payment (supports caregiver app, billing desk collection widget, custom amount & reference)
app.post('/api/hms/payments', async (req, res) => {
  const { admissionId, method, amount, reference, payer, date: requestedDate, txId: requestedTxId } = req.body || {};
  const targetAdmission = admissionId || 'HMS-2026-8842';
  const txId = requestedTxId || ('TXN-' + Math.floor(100000 + Math.random() * 900000));

  let cleanDate = (requestedDate && typeof requestedDate === 'string' && requestedDate.trim().length > 5)
    ? requestedDate.trim()
    : null;

  if (!cleanDate) {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[now.getMonth()];
    const year = now.getFullYear();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? String(hours).padStart(2, '0') : '12';
    cleanDate = `${day}-${month}-${year}, ${hours}:${minutes} ${ampm}`;
  }

  let methodLabel = method || 'UPI / NetBanking';
  if (reference && !methodLabel.includes(reference)) {
    methodLabel += ` (${reference})`;
  }

  const paidAmt = (amount !== undefined && amount !== null && !isNaN(Number(amount)) && Number(amount) > 0)
    ? Number(amount)
    : 0;

  // Duplicate payment guard: Prevent recording identical transaction within 6 seconds
  if (!memoryFallbackDb.payments) memoryFallbackDb.payments = [];
  const existingDup = memoryFallbackDb.payments.find(p =>
    (p.admissionId === targetAdmission || p.admission_id === targetAdmission) &&
    Number(p.amount) === paidAmt &&
    (Date.now() - (p._recordedAt || 0) < 6000)
  );

  if (existingDup) {
    return res.json({
      success: true,
      duplicateIgnored: true,
      txId: existingDup.txId || existingDup.tx_id,
      amount: existingDup.amount,
      date: existingDup.date || existingDup.date_label || cleanDate,
      method: existingDup.method || methodLabel,
      payer: payer || 'Caregiver',
      message: 'Duplicate payment request within 6 seconds safely ignored'
    });
  }

  // 1. Immediately record in-memory fallback for instantaneous sync across all modules & mobile app
  const memPayment = {
    txId,
    tx_id: txId,
    admissionId: targetAdmission,
    admission_id: targetAdmission,
    date: cleanDate,
    dateLabel: cleanDate,
    date_label: cleanDate,
    method: methodLabel,
    amount: paidAmt,
    payer: payer || 'Caregiver',
    status: 'Paid',
    _recordedAt: Date.now()
  };

  memoryFallbackDb.payments.unshift(memPayment);

  if (memoryFallbackDb.billing) {
    memoryFallbackDb.billing.remainingPayable = Math.max(0, (Number(memoryFallbackDb.billing.remainingPayable) || 0) - paidAmt);
  }

  // 2. Persist to MySQL database if available
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [billingRows] = await conn.query('SELECT remaining_payable FROM billing_summary WHERE admission_id = ?', [targetAdmission]);
    const currentRemaining = billingRows[0] ? Number(billingRows[0].remaining_payable) : 0;

    await conn.query(
      'UPDATE billing_summary SET remaining_payable = GREATEST(0, remaining_payable - ?) WHERE admission_id = ?',
      [paidAmt, targetAdmission]
    );

    if (paidAmt >= currentRemaining && currentRemaining > 0) {
      await conn.query(
        "UPDATE pharmacy_transactions SET payment_status = 'PAID' WHERE admission_id = ? AND payment_status = 'PENDING'",
        [targetAdmission]
      );
    }

    await conn.query(
      'INSERT INTO payments (tx_id, admission_id, date_label, method, amount, status) VALUES (?, ?, ?, ?, ?, ?)',
      [txId, targetAdmission, cleanDate, methodLabel, paidAmt, 'Paid']
    );

    await conn.commit();
  } catch (dbErr) {
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    console.warn('Payment stored in memory (MySQL pool unavailable):', dbErr.message);
  } finally {
    if (conn) {
      try { conn.release(); } catch (_) {}
    }
  }

  // Instant response to caller (< 10ms)
  res.json({
    success: true,
    txId,
    amount: paidAmt,
    date: cleanDate,
    method: methodLabel,
    payer: payer || 'Caregiver'
  });
});

// ---------------------------------------------------------------
// 4. Structured ID Admission & Patient Registration (Req 1, 2, 3, 4)
// ---------------------------------------------------------------
app.post('/api/hms/admissions', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const {
      patientMode,
      patientId: requestedPatientId,
      fullName,
      dob,
      age,
      gender,
      bloodGroup,
      patientPhone,
      admittingDept,
      roomNumber,
      attendingDoctor,
      caregiverName,
      caregiverPhone,
      caregiverRelation,
      admissionType,
      reasonForAdmission
    } = req.body;

    if (!fullName || !patientPhone) {
      return res.status(400).json({ error: 'Patient full name and phone are required.' });
    }

    if (dob) {
      const birthDate = new Date(dob.includes('T') ? dob : dob + 'T00:00:00');
      if (isNaN(birthDate.getTime())) {
        return res.status(400).json({ error: 'Invalid Date of Birth format.' });
      }
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (birthDate > today) {
        return res.status(400).json({ error: 'Date of Birth cannot be after the current date.' });
      }
      const minDob = new Date();
      minDob.setFullYear(minDob.getFullYear() - 150);
      minDob.setHours(0, 0, 0, 0);
      if (birthDate < minDob) {
        return res.status(400).json({ error: 'Date of Birth cannot be more than 150 years ago (maximum age is 150 years).' });
      }
    }

    await conn.beginTransaction();

    function calculateAgeFromDob(dobStr) {
      if (!dobStr) return '';
      const birthDate = new Date(dobStr);
      if (isNaN(birthDate.getTime())) return '';
      const today = new Date();
      let years = today.getFullYear() - birthDate.getFullYear();
      let months = today.getMonth() - birthDate.getMonth();
      let days = today.getDate() - birthDate.getDate();

      if (days < 0) {
        months--;
        const prevMonthLastDay = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
        days += prevMonthLastDay;
      }
      if (months < 0) {
        years--;
        months += 12;
      }

      if (years >= 1) {
        return `${years} Years`;
      } else if (months >= 1) {
        return `${months} Months`;
      } else {
        return `${Math.max(1, days)} Days`;
      }
    }

    const effectiveGender = (gender === 'Other' || gender === 'Others') ? 'Transgender' : (gender || 'Unknown');
    let computedAge = '';
    if (dob) {
      computedAge = calculateAgeFromDob(dob);
    } else if (age) {
      computedAge = `${age} Years`;
    }
    const ageGender = `${computedAge || 'Unknown Age'} • ${effectiveGender} (${bloodGroup || 'Unknown'})`;

    let finalPatientId = requestedPatientId;

    if (patientMode === 'existing' && requestedPatientId) {
      const [existingPatient] = await conn.query('SELECT * FROM patients_master WHERE patient_id = ?', [requestedPatientId]);
      if (existingPatient.length === 0) {
        await conn.query(
          `INSERT INTO patients_master (patient_id, full_name, dob, age_gender, patient_phone, blood_group)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [requestedPatientId, fullName, dob || null, ageGender, patientPhone, bloodGroup || 'Unknown']
        );
      } else {
        await conn.query(
          `UPDATE patients_master SET full_name = ?, dob = COALESCE(?, dob), age_gender = ?, blood_group = ? WHERE patient_id = ?`,
          [fullName, dob || null, ageGender, bloodGroup || 'Unknown', requestedPatientId]
        );
      }
      finalPatientId = requestedPatientId;
    } else {
      // Prevent duplicate patient profiles: check if a patient with same 10-digit phone already exists
      const rawPhone = String(patientPhone).replace(/\D/g, '').slice(-10);
      const [phoneMatch] = await conn.query(
        "SELECT patient_id FROM patients_master WHERE REPLACE(REPLACE(REPLACE(patient_phone, ' ', ''), '-', ''), '+', '') LIKE ? LIMIT 1",
        [`%${rawPhone}%`]
      );
      if (phoneMatch.length > 0) {
        finalPatientId = phoneMatch[0].patient_id;
        await conn.query(
          'UPDATE patients_master SET full_name = ?, dob = COALESCE(?, dob), age_gender = ?, blood_group = ? WHERE patient_id = ?',
          [fullName, dob || null, ageGender, bloodGroup || 'Unknown', finalPatientId]
        );
      } else {
        finalPatientId = await generateStructuredPatientId(conn);
        await conn.query(
          `INSERT INTO patients_master (patient_id, full_name, dob, age_gender, patient_phone, blood_group)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [finalPatientId, fullName, dob || null, ageGender, patientPhone, bloodGroup || 'Unknown']
        );
      }
    }

    // 1. Strict 1-Active-Admission Guard (Transaction / Concurrency Safe)
    const [existingActive] = await conn.query(
      "SELECT admission_id, admitting_dept, current_dept, room_number, attending_doctor FROM admissions WHERE patient_id = ? AND status IN ('ADMITTED', 'ACTIVE') FOR UPDATE",
      [finalPatientId]
    );
    if (existingActive.length > 0) {
      await conn.rollback();
      const active = existingActive[0];
      return res.status(409).json({
        error: `Patient already has an active inpatient admission (${active.admission_id} in ${active.room_number || 'Ward'}). A patient can have at most one active admission. Use Transfer to change department or room.`,
        code: 'ACTIVE_ADMISSION_EXISTS',
        existingAdmissionId: active.admission_id,
        patientId: finalPatientId,
        currentRoom: active.room_number,
        currentDept: active.current_dept || active.admitting_dept
      });
    }

    // 2. Room / Bed Occupancy Guard
    const targetRoom = (roomNumber || 'General Ward').trim();
    if (targetRoom && targetRoom !== 'General Ward') {
      const [occupied] = await conn.query(
        "SELECT admission_id, patient_id FROM admissions WHERE room_number = ? AND status IN ('ADMITTED', 'ACTIVE') FOR UPDATE",
        [targetRoom]
      );
      if (occupied.length > 0) {
        await conn.rollback();
        return res.status(409).json({
          error: `Room/Bed "${targetRoom}" is currently occupied by active patient ${occupied[0].patient_id} (Admission: ${occupied[0].admission_id}). Please select an available room/bed.`,
          code: 'ROOM_OCCUPIED',
          occupiedByAdmission: occupied[0].admission_id,
          occupiedByPatient: occupied[0].patient_id
        });
      }
    }

    // Determine admitting department code (e.g. CAR for Cardiology, EMG for Emergency)
    const effectiveDept = admittingDept || req.body.department || req.body.dept || 'General';
    const deptCode = getDepartmentCode(effectiveDept || attendingDoctor || 'GEN');
    const newAdmissionId = await generateStructuredAdmissionId(conn, deptCode);

    const now = new Date();
    const admissionDate = now.toISOString().slice(0, 10);
    const admissionTime = now.toTimeString().slice(0, 5);
    const caregiverId = 'CG-' + Math.floor(100000 + Math.random() * 900000);

    const finalRelation = caregiverRelation || req.body.relation || 'Primary Caregiver';

    // Insert into admissions table
    await conn.query(
      `INSERT INTO admissions (admission_id, patient_id, admitting_dept, current_dept, room_number, attending_doctor, status,
         caregiver_name, caregiver_id, caregiver_phone, relation, admission_type, reason_for_admission,
         carebridge_status, carebridge_access, admission_date, admission_time)
       VALUES (?, ?, ?, ?, ?, ?, 'ADMITTED', ?, ?, ?, ?, ?, ?, 'Active', 'Active', ?, ?)`,
      [newAdmissionId, finalPatientId, effectiveDept, effectiveDept, targetRoom, attendingDoctor || 'Attending Physician',
       caregiverName || '', caregiverId, caregiverPhone || '', finalRelation,
       admissionType || 'Emergency', reasonForAdmission || '', admissionDate, admissionTime]
    );

    // Insert into patients (compatibility table)
    await conn.query(
      `INSERT INTO patients (admission_id, patient_id, full_name, dob, age_gender, patient_phone, current_dept, room_number, attending_doctor, status,
         caregiver_name, caregiver_id, caregiver_phone, relation, admission_type, reason_for_admission,
         carebridge_status, carebridge_access, admission_date, admission_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ADMITTED', ?, ?, ?, ?, ?, ?, 'Active', 'Active', ?, ?)`,
      [newAdmissionId, finalPatientId, fullName, dob || null, ageGender, patientPhone, effectiveDept, targetRoom, attendingDoctor || 'Attending Physician',
       caregiverName || '', caregiverId, caregiverPhone || '', finalRelation,
       admissionType || 'Emergency', reasonForAdmission || '', admissionDate, admissionTime]
    );

    // Initialize billing summary
    await conn.query(
      `INSERT INTO billing_summary (admission_id, total_bill, insurance_covered, remaining_payable, claim_status)
       VALUES (?, 0, 0, 0, 'Pending')
       ON DUPLICATE KEY UPDATE claim_status=claim_status`,
      [newAdmissionId]
    );

    await conn.commit();
    res.json({
      success: true,
      patientId: finalPatientId,
      admissionId: newAdmissionId,
      caregiverId,
      snapshot: await buildSnapshot()
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// Department name matcher
function isDepartmentMatching(d1, d2) {
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

// Identify if a room is department-specific or general
function getRoomDepartment(roomName) {
  if (!roomName) return null;
  const upper = String(roomName).toUpperCase();
  if (upper.includes('PAEDIATRIC') || upper.includes('PEDIATRIC') || upper.includes('CHILD')) return 'Paediatrics';
  if (upper.includes('PULMO')) return 'Pulmonology';
  if (upper.includes('CARDIO')) return 'Cardiology';
  if (upper.includes('MATERNITY') || upper.includes('MATERNAL') || upper.includes('GYNEC')) return 'Maternity';
  if (upper.includes('EMERGENCY')) return 'Emergency Care';
  if (upper.includes('DERMAT')) return 'Dermatology';
  // General wards/rooms (General Ward, Room 204/205, Private Room, Semi-Private Room, ICU Room)
  return null;
}

function isRoomCompatibleWithDepartment(roomName, patientDept) {
  const roomDept = getRoomDepartment(roomName);
  // General Ward, General Room, Private Room, Semi-Private, ICU are allowed for all departments
  if (!roomDept) return true;
  if (!patientDept) return false;
  return isDepartmentMatching(roomDept, patientDept);
}

function getDoctorDepartment(doctorName) {
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

function isDoctorCompatibleWithDepartment(doctorName, patientDept) {
  if (!doctorName || !patientDept) return true;
  const docDept = getDoctorDepartment(doctorName);
  if (!docDept) return true;
  return isDepartmentMatching(docDept, patientDept);
}

// Patient Transfer Handler (Department remains unchanged, updates room and doctor)
const handleAdmissionTransfer = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { admissionId } = req.params;
    const {
      department: toDept,
      roomNumber: toRoom,
      attendingDoctor: toDoctor,
      reason: transferReason,
      transferredBy
    } = req.body;

    if (!admissionId) {
      return res.status(400).json({ error: 'Admission ID is required.' });
    }
    if (!toRoom || !String(toRoom).trim()) {
      return res.status(400).json({ error: 'Target room/bed is required for transfer.' });
    }

    await conn.beginTransaction();

    // 1. Fetch current active admission (locking row)
    const [rows] = await conn.query(
      "SELECT * FROM admissions WHERE admission_id = ? AND status IN ('ADMITTED', 'ACTIVE') FOR UPDATE",
      [admissionId]
    );
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: `Active admission ${admissionId} not found.` });
    }
    const currentAdm = rows[0];
    const patientId = currentAdm.patient_id;
    const patientDept = currentAdm.current_dept || currentAdm.admitting_dept || 'General';
    const fromDept = patientDept;
    const fromRoom = currentAdm.room_number;
    const finalRoom = toRoom.trim();

    // 1a. Validate room compatibility with existing department
    if (!isRoomCompatibleWithDepartment(finalRoom, patientDept)) {
      await conn.rollback();
      return res.status(400).json({
        error: `Room/Bed "${finalRoom}" is not compatible with patient's department "${patientDept}". Department-specific rooms from other departments cannot be assigned.`,
        code: 'INCOMPATIBLE_ROOM_DEPARTMENT',
        roomNumber: finalRoom,
        patientDepartment: patientDept
      });
    }

    // 1b. Validate doctor compatibility with existing department
    let finalDoctor = currentAdm.attending_doctor;
    if (toDoctor && String(toDoctor).trim() && String(toDoctor).trim() !== 'Select Doctor') {
      const cleanDoc = String(toDoctor).trim();
      if (!isDoctorCompatibleWithDepartment(cleanDoc, patientDept)) {
        await conn.rollback();
        return res.status(400).json({
          error: `Doctor "${cleanDoc}" does not belong to patient's department "${patientDept}". Only doctors from "${patientDept}" may be assigned.`,
          code: 'INCOMPATIBLE_DOCTOR_DEPARTMENT',
          doctor: cleanDoc,
          patientDepartment: patientDept
        });
      }
      finalDoctor = cleanDoc;
    }

    // 1c. Duplicate Transfer Guard
    if (finalRoom === fromRoom && finalDoctor === currentAdm.attending_doctor) {
      await conn.rollback();
      return res.status(400).json({ error: 'Patient is already in this room and bed with the specified doctor. Transfer not required.' });
    }
    const [recentTransfer] = await conn.query(
      `SELECT id FROM patient_transfers WHERE admission_id = ? AND from_room = ? AND to_room = ? AND transfer_date >= NOW() - INTERVAL 5 SECOND`,
      [admissionId, fromRoom, finalRoom]
    );
    if (recentTransfer.length > 0) {
      await conn.rollback();
      return res.status(409).json({ error: 'Duplicate transfer request ignored.' });
    }

    // 2. Room occupancy check (ensure target room is not occupied by another active patient)
    if (finalRoom !== fromRoom) {
      const [occupied] = await conn.query(
        "SELECT admission_id, patient_id FROM admissions WHERE room_number = ? AND status IN ('ADMITTED', 'ACTIVE') AND admission_id != ? FOR UPDATE",
        [finalRoom, admissionId]
      );
      if (occupied.length > 0) {
        await conn.rollback();
        return res.status(409).json({
          error: `Room/Bed "${finalRoom}" is currently occupied by active patient ${occupied[0].patient_id} (Admission: ${occupied[0].admission_id}). Please choose an unoccupied room/bed.`,
          code: 'ROOM_OCCUPIED'
        });
      }
    }

    // 3. Update admissions table: same admission_id, update room_number, attending_doctor (Department remains UNCHANGED)
    await conn.query(
      "UPDATE admissions SET room_number = ?, attending_doctor = ? WHERE admission_id = ?",
      [finalRoom, finalDoctor, admissionId]
    );

    // 4. Update legacy patients table to maintain sync (Department remains UNCHANGED)
    await conn.query(
      "UPDATE patients SET room_number = ?, attending_doctor = ? WHERE admission_id = ?",
      [finalRoom, finalDoctor, admissionId]
    );

    // 5. Record transfer in patient_transfers audit table (from_dept and to_dept are both patientDept)
    await conn.query(
      `INSERT INTO patient_transfers (admission_id, patient_id, from_dept, to_dept, from_room, to_room, attending_doctor, transfer_reason, transferred_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [admissionId, patientId, fromDept, fromDept, fromRoom, finalRoom, finalDoctor, transferReason || 'Ward/Room Transfer', transferredBy || 'HMS Staff']
    );

    await conn.commit();

    res.json({
      success: true,
      admissionId,
      patientId,
      fromDept,
      toDept: fromDept,
      fromRoom,
      toRoom: finalRoom,
      attendingDoctor: finalDoctor,
      message: `Patient ${patientId} (Admission ${admissionId}) successfully transferred from ${fromRoom} to ${finalRoom} in ${fromDept}. Admission ID and Department remain unchanged.`,
      snapshot: await buildSnapshot()
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
};

app.post('/api/hms/admissions/:admissionId/transfer', handleAdmissionTransfer);
app.put('/api/v1/admissions/:admissionId/transfer', handleAdmissionTransfer);
app.post('/api/v1/admissions/:admissionId/transfer', handleAdmissionTransfer);

// Room Transfer Audit Logs Query Endpoint (for Automated Stay Calculator)
app.get('/api/hms/admissions/:admissionId/transfers', async (req, res) => {
  const { admissionId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT id, admission_id, patient_id, from_dept, to_dept, from_room, to_room, attending_doctor, transfer_reason, transferred_by, transfer_date
       FROM patient_transfers
       WHERE admission_id = ?
       ORDER BY transfer_date ASC, id ASC`,
      [admissionId]
    );
    res.json(rows.map(t => ({
      id: t.id,
      admissionId: t.admission_id,
      patientId: t.patient_id,
      fromDept: t.from_dept,
      toDept: t.to_dept,
      fromRoom: t.from_room,
      toRoom: t.to_room,
      attendingDoctor: t.attending_doctor,
      reason: t.transfer_reason,
      transferredBy: t.transferred_by,
      transferDate: t.transfer_date
    })));
  } catch (err) {
    console.error('Error fetching patient transfers:', err);
    res.json([]);
  }
});

// Room Occupancy Query Endpoint
app.get('/api/hms/rooms/occupancy', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.room_number, a.admission_id, a.patient_id, p.full_name, a.admitting_dept, a.current_dept, a.attending_doctor
       FROM admissions a
       JOIN patients_master p ON a.patient_id = p.patient_id
       WHERE a.status IN ('ADMITTED', 'ACTIVE')`
    );
    res.json(rows.map(r => ({
      roomNumber: r.room_number,
      admissionId: r.admission_id,
      patientId: r.patient_id,
      patientName: r.full_name,
      doctor: r.attending_doctor,
      department: r.current_dept || r.admitting_dept
    })));
  } catch (err) {
    res.json((memoryFallbackDb.patients || []).filter(p => p.status === 'ADMITTED').map(r => ({
      roomNumber: r.roomNumber,
      admissionId: r.admissionId,
      patientId: r.patientId,
      patientName: r.fullName,
      doctor: r.attendingDoctor,
      department: r.department
    })));
  }
});

// Helper: Authoritative Room Tariff Lookup from room_tariffs table
async function findRoomTariff(connOrPool, roomNumber) {
  if (!roomNumber) return null;
  const clean = String(roomNumber).trim().toUpperCase();
  // Order tariffs by length of room_type descending so more specific types (e.g. SEMI-PRIVATE) match before general ones (e.g. PRIVATE)
  const [tariffs] = await connOrPool.query('SELECT * FROM room_tariffs ORDER BY CHAR_LENGTH(room_type) DESC, id ASC');
  if (tariffs.length === 0) return null;

  const normClean = clean.replace(/[-_]/g, ' ');

  for (const t of tariffs) {
    const tKey = (t.room_type || '').toUpperCase();
    const normKey = tKey.replace(/[-_]/g, ' ');

    if (tKey === 'ICU' && (clean.includes('ICU') || clean.includes('CRITICAL'))) {
      return {
        roomType: t.room_type,
        displayName: t.display_name,
        dailyRate: Number(t.daily_rate),
        description: t.description
      };
    }
    if (tKey === 'WARD' && (clean.includes('WARD') || clean.includes('GENERAL'))) {
      return {
        roomType: t.room_type,
        displayName: t.display_name,
        dailyRate: Number(t.daily_rate),
        description: t.description
      };
    }
    if (clean === tKey || clean.includes(tKey) || normClean.includes(normKey)) {
      return {
        roomType: t.room_type,
        displayName: t.display_name,
        dailyRate: Number(t.daily_rate),
        description: t.description
      };
    }
  }
  return null;
}

// Authoritative Category Tariff & Charge Resolution Engine
async function resolveAuthoritativeCategoryCharge(connOrPool, admissionId, category, clientDesc = '') {
  if (!admissionId || !category) return null;

  const [admRows] = await connOrPool.query(
    'SELECT admission_id, patient_id, admitting_dept, current_dept, room_number, attending_doctor, status FROM admissions WHERE admission_id = ?',
    [admissionId]
  );
  if (admRows.length === 0) {
    return { found: false, error: `Admission "${admissionId}" not found.` };
  }
  const adm = admRows[0];
  const cat = String(category).trim();

  // 1. ROOM RENT
  if (cat === 'Room Rent') {
    const currentRoom = (adm.room_number || '').trim();
    const tariff = await findRoomTariff(connOrPool, currentRoom);
    if (!tariff) {
      return {
        found: true,
        configured: false,
        tariffConfigured: false,
        error: `Room tariff is not configured for current room: "${currentRoom}". Contact administrator to configure room rate.`,
        code: 'ROOM_TARIFF_NOT_CONFIGURED',
        currentRoom,
        category: 'Room Rent'
      };
    }
    const rate = Number(tariff.dailyRate);
    const description = `${currentRoom} — Room Rent`;
    return {
      found: true,
      configured: true,
      tariffConfigured: true,
      category: 'Room Rent',
      amount: rate,
      dailyRate: rate,
      currentRoom,
      description,
      sourceItem: currentRoom,
      helperText: `Auto-calculated from current room: ${currentRoom} (₹${rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}/day)`
    };
  }

  // 2. CONSULTATION
  if (cat === 'Consultation') {
    const [appts] = await connOrPool.query(
      'SELECT doctor_name, appointment_type, department FROM doctor_appointments WHERE admission_id = ? ORDER BY id DESC LIMIT 1',
      [admissionId]
    );
    const appt = appts.length > 0 ? appts[0] : null;
    const docName = (appt?.doctor_name || adm.attending_doctor || 'Attending Physician').trim();
    const dept = (appt?.department || adm.current_dept || adm.admitting_dept || 'General').trim();
    const apptType = appt?.appointment_type ? appt.appointment_type.trim() : '';

    let itemCode = 'DOC_GENERAL';
    const cleanDoc = (docName + ' ' + dept).toUpperCase();
    const cleanDesc = (clientDesc || '').toUpperCase();

    if (cleanDesc.includes('REVIEW') || cleanDesc.includes('ROUTINE')) {
      itemCode = 'DOC_GENERAL';
    } else if (cleanDoc.includes('CARDIO') || cleanDoc.includes('THORNE')) {
      itemCode = 'DOC_CARDIO';
    } else if (cleanDoc.includes('PULMO') || cleanDoc.includes('ROSTOVA')) {
      itemCode = 'DOC_PULMO';
    } else if (cleanDoc.includes('INTERNAL') || cleanDoc.includes('VANCE')) {
      itemCode = 'DOC_INTERNAL';
    }

    const [tariffRows] = await connOrPool.query(
      'SELECT standard_rate, display_name FROM billing_tariffs WHERE category = "Consultation" AND item_code = ?',
      [itemCode]
    );
    const rate = tariffRows.length > 0 ? Number(tariffRows[0].standard_rate) : 2500.00;

    let description = '';
    if (clientDesc && clientDesc.trim().length >= 5 && clientDesc.trim().toLowerCase() !== 'consultation') {
      description = clientDesc.trim();
    } else if (apptType) {
      description = `${docName} — ${apptType}`;
    } else {
      description = `${docName} — Consultation & Clinical Review (${dept})`;
    }

    return {
      found: true,
      configured: true,
      tariffConfigured: true,
      category: 'Consultation',
      amount: rate,
      description,
      sourceItem: docName,
      helperText: `Auto-calculated from attending doctor: ${docName} (₹${rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })})`
    };
  }

  // 3. PHARMACY
  if (cat === 'Pharmacy') {
    const [ptxRows] = await connOrPool.query(
      'SELECT medicine_name, quantity, unit_price, total_amount FROM pharmacy_transactions WHERE admission_id = ? ORDER BY id DESC LIMIT 1',
      [admissionId]
    );
    if (ptxRows.length > 0) {
      const ptx = ptxRows[0];
      const medName = ptx.medicine_name;
      const qty = Number(ptx.quantity) || 1;
      const amount = Number(ptx.total_amount) || (Number(ptx.unit_price) * qty);
      const description = `${medName} (Qty: ${qty}) — Pharmacy Dispensation`;
      return {
        found: true,
        configured: true,
        tariffConfigured: true,
        category: 'Pharmacy',
        amount,
        description,
        sourceItem: `${medName} (Qty: ${qty})`,
        helperText: `Auto-calculated from pharmacy transaction: ${medName} (Qty: ${qty} @ ₹${Number(ptx.unit_price).toFixed(2)}/unit)`
      };
    }

    const [rxRows] = await connOrPool.query(
      'SELECT name, quantity, dosage FROM prescriptions WHERE admission_id = ? ORDER BY id DESC LIMIT 1',
      [admissionId]
    );
    if (rxRows.length > 0) {
      const rx = rxRows[0];
      const medName = rx.name;
      const qty = Number(rx.quantity) || 1;

      const [medRows] = await connOrPool.query(
        'SELECT unit_price FROM medicine_master WHERE name = ? OR name LIKE ? LIMIT 1',
        [medName, `%${medName.split(' ')[0]}%`]
      );
      const unitPrice = medRows.length > 0 ? Number(medRows[0].unit_price) : 25.00;
      const amount = unitPrice * qty;
      const description = `${medName}${rx.quantity ? ' (Qty: ' + rx.quantity + ')' : ''} — Pharmacy Dispensation`;

      return {
        found: true,
        configured: true,
        tariffConfigured: true,
        category: 'Pharmacy',
        amount,
        description,
        sourceItem: medName,
        helperText: `Auto-calculated from patient prescription: ${medName} (Qty: ${qty} @ ₹${unitPrice.toFixed(2)}/unit)`
      };
    }

    const [tariffRows] = await connOrPool.query(
      'SELECT standard_rate, display_name FROM billing_tariffs WHERE category = "Pharmacy" AND item_code = "PHARM_GENERAL"',
      []
    );
    const rate = tariffRows.length > 0 ? Number(tariffRows[0].standard_rate) : 8500.00;
    return {
      found: true,
      configured: true,
      tariffConfigured: true,
      category: 'Pharmacy',
      amount: rate,
      description: 'Pharmacy & IV Medications',
      sourceItem: 'Inpatient Medication Supplies',
      helperText: `Auto-calculated from inpatient pharmacy package (₹${rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })})`
    };
  }

  // 4. DIAGNOSTICS
  if (cat === 'Diagnostics') {
    const [labRows] = await connOrPool.query(
      'SELECT title, category FROM lab_reports WHERE admission_id = ? ORDER BY created_at DESC LIMIT 1',
      [admissionId]
    );
    if (labRows.length > 0) {
      const lab = labRows[0];
      const testTitle = lab.title;
      const testCat = lab.category || 'Diagnostic';

      let itemCode = 'DIAG_GENERAL';
      const cleanTitle = testTitle.toUpperCase();
      if (cleanTitle.includes('CT') || cleanTitle.includes('SCAN')) {
        itemCode = 'DIAG_CT_THORAX';
      } else if (cleanTitle.includes('TROPONIN') || cleanTitle.includes('CARDIAC ENZYMES')) {
        itemCode = 'DIAG_TROPONIN';
      } else if (cleanTitle.includes('CBC') || cleanTitle.includes('BLOOD COUNT')) {
        itemCode = 'DIAG_CBC';
      } else if (cleanTitle.includes('ELECTROLYTE')) {
        itemCode = 'DIAG_ELECTROLYTES';
      }

      const [tariffRows] = await connOrPool.query(
        'SELECT standard_rate, display_name FROM billing_tariffs WHERE category = "Diagnostics" AND item_code = ?',
        [itemCode]
      );
      const rate = tariffRows.length > 0 ? Number(tariffRows[0].standard_rate) : 8000.00;
      const description = `${testTitle} — Diagnostic ${testCat} Test`;

      return {
        found: true,
        configured: true,
        tariffConfigured: true,
        category: 'Diagnostics',
        amount: rate,
        description,
        sourceItem: testTitle,
        helperText: `Auto-calculated from diagnostic report: ${testTitle} (₹${rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })})`
      };
    }

    const [tariffRows] = await connOrPool.query(
      'SELECT standard_rate, display_name FROM billing_tariffs WHERE category = "Diagnostics" AND item_code = "DIAG_GENERAL"',
      []
    );
    const rate = tariffRows.length > 0 ? Number(tariffRows[0].standard_rate) : 8000.00;
    return {
      found: true,
      configured: true,
      tariffConfigured: true,
      category: 'Diagnostics',
      amount: rate,
      description: 'Laboratory & Diagnostic Scans',
      sourceItem: 'Diagnostic Investigation Package',
      helperText: `Auto-calculated from standard diagnostic investigation package (₹${rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })})`
    };
  }

  // 5. PROCEDURES
  if (cat === 'Procedures') {
    const [treatRows] = await connOrPool.query(
      'SELECT doctor_name, note, dept FROM treatments WHERE admission_id = ? ORDER BY id DESC LIMIT 1',
      [admissionId]
    );
    let itemCode = 'PROC_GENERAL';
    let procName = 'Standard Inpatient Clinical Procedure';

    if (treatRows.length > 0) {
      const cleanNote = (treatRows[0].note || '').toUpperCase();
      if (cleanNote.includes('NEBULIZ') || cleanNote.includes('INHAL')) {
        itemCode = 'PROC_NEBULIZATION';
        procName = 'Nebulization & Inhalation Procedure';
      } else if (cleanNote.includes('BRONCHO')) {
        itemCode = 'PROC_BRONCHOSCOPY';
        procName = 'Bronchoscopy / Pulmonary Procedure';
      } else if (cleanNote.includes('ECG') || cleanNote.includes('CARDIAC') || cleanNote.includes('RHYTHM')) {
        itemCode = 'PROC_ECG_MONITOR';
        procName = '12-Lead ECG & Cardiac Monitoring Procedure';
      } else if (cleanNote.includes('IV') || cleanNote.includes('CEFTRIAXONE') || cleanNote.includes('INFUSION')) {
        itemCode = 'PROC_IV_INFUSION';
        procName = 'IV Infusion & Clinical Nursing Procedure';
      }
    }

    const [tariffRows] = await connOrPool.query(
      'SELECT standard_rate, display_name FROM billing_tariffs WHERE category = "Procedures" AND item_code = ?',
      [itemCode]
    );
    const rate = tariffRows.length > 0 ? Number(tariffRows[0].standard_rate) : 3500.00;

    return {
      found: true,
      configured: true,
      tariffConfigured: true,
      category: 'Procedures',
      amount: rate,
      description: procName,
      sourceItem: procName,
      helperText: `Auto-calculated from clinical treatment: ${procName} (₹${rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })})`
    };
  }

  // Generic fallback for any other existing or future billing categories
  const [genericTariffs] = await connOrPool.query(
    'SELECT standard_rate, display_name, description FROM billing_tariffs WHERE category = ? LIMIT 1',
    [cat]
  );
  if (genericTariffs.length > 0) {
    const t = genericTariffs[0];
    const rate = Number(t.standard_rate);
    return {
      found: true,
      configured: true,
      tariffConfigured: true,
      category: cat,
      amount: rate,
      description: t.description || `${cat} Standard Charge`,
      sourceItem: t.display_name,
      helperText: `Auto-calculated from configured ${cat} tariff: ${t.display_name} (₹${rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })})`
    };
  }

  return {
    found: true,
    configured: false,
    tariffConfigured: false,
    error: `Tariff is not configured for category "${cat}". Please contact administrator.`,
    code: 'CATEGORY_TARIFF_NOT_CONFIGURED',
    category: cat
  };
}


// Room Tariffs Listing Endpoint
app.get('/api/hms/rooms/tariffs', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM room_tariffs ORDER BY id ASC');
    res.json(rows.map(r => ({
      id: r.id,
      roomType: r.room_type,
      displayName: r.display_name,
      dailyRate: Number(r.daily_rate),
      description: r.description
    })));
  } catch (err) {
    res.json(memoryFallbackDb.roomTariffs || []);
  }
});

// Admission Current Room Tariff Query Endpoint
app.get('/api/hms/admissions/:admissionId/room-tariff', async (req, res) => {
  try {
    const { admissionId } = req.params;
    const [rows] = await pool.query(
      'SELECT admission_id, patient_id, room_number, current_dept, status FROM admissions WHERE admission_id = ?',
      [admissionId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: `Admission "${admissionId}" not found.` });
    }
    const adm = rows[0];
    const currentRoom = (adm.room_number || '').trim();
    const tariff = await findRoomTariff(pool, currentRoom);

    if (!tariff) {
      return res.json({
        admissionId: adm.admission_id,
        patientId: adm.patient_id,
        currentRoom,
        status: adm.status,
        tariffConfigured: false,
        dailyRate: null,
        error: `Room tariff is not configured for current room: "${currentRoom}". Please contact an administrator.`
      });
    }

    res.json({
      admissionId: adm.admission_id,
      patientId: adm.patient_id,
      currentRoom,
      status: adm.status,
      tariffConfigured: true,
      tariff,
      dailyRate: tariff.dailyRate,
      description: `${currentRoom} — Room Rent`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admission Category Charge Preview Endpoint (Supports ALL Billing Categories)
app.get('/api/hms/admissions/:admissionId/charge-preview', async (req, res) => {
  try {
    const { admissionId } = req.params;
    const { category, description } = req.query;
    if (!category) {
      return res.status(400).json({ error: 'Query parameter "category" is required.' });
    }

    const chargeInfo = await resolveAuthoritativeCategoryCharge(pool, admissionId, category, description);
    if (!chargeInfo || chargeInfo.found === false) {
      return res.status(404).json({ error: chargeInfo?.error || `Admission "${admissionId}" not found.` });
    }

    res.json(chargeInfo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Patient Master Lookup
app.get('/api/hms/patients', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM patients_master ORDER BY created_at DESC');
    res.json(rows.map(mapPatientMaster));
  } catch (err) {
    const list = (memoryFallbackDb.patients || []).map(p => ({
      patientId: p.patientId,
      fullName: p.fullName,
      name: p.fullName,
      dob: p.dob,
      ageGender: p.ageGender,
      patientPhone: p.patientPhone,
      bloodGroup: 'B+ve',
      emergencyContactName: p.emergencyContactName,
      emergencyContactPhone: p.emergencyContactPhone,
      emergencyContactRelation: p.emergencyContactRelation
    }));
    res.json(list);
  }
});

app.get('/api/hms/patients/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const [rows] = await pool.query('SELECT * FROM patients_master WHERE patient_id = ?', [patientId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    const patient = mapPatientMaster(rows[0]);
    const [admissions] = await pool.query('SELECT * FROM admissions WHERE patient_id = ? ORDER BY created_at DESC', [patientId]);
    const previousCaregiver = admissions.length > 0 ? {
      caregiverName: admissions[0].caregiver_name,
      caregiverMobile: admissions[0].caregiver_phone,
      relationship: admissions[0].relation
    } : null;

    res.json({
      ...patient,
      name: patient.fullName,
      phone: patient.patientPhone,
      previousCaregiver,
      admissions
    });
  } catch (err) {
    const p = (memoryFallbackDb.patients || []).find(x => x.patientId === req.params.patientId);
    if (!p) return res.status(404).json({ error: 'Patient not found' });
    res.json({
      patientId: p.patientId,
      fullName: p.fullName,
      name: p.fullName,
      dob: p.dob,
      patientPhone: p.patientPhone,
      phone: p.patientPhone,
      previousCaregiver: {
        caregiverName: p.caregiverName,
        caregiverMobile: p.caregiverPhone,
        relationship: p.relation
      },
      admissions: [p]
    });
  }
});

// ---------------------------------------------------------------
// 5. Doctor Appointment Scheduling (Req 5 - Duty Nurse)
// ---------------------------------------------------------------
app.get('/api/hms/appointments', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM doctor_appointments ORDER BY appointment_date ASC, appointment_time ASC');
    res.json(rows.map(mapAppointment));
  } catch (err) {
    res.json(memoryFallbackDb.appointments || []);
  }
});

// ---------------------------------------------------------------
// Assigned Lab Reports & Investigations Endpoints (Duty Nurse -> Lab Portal)
// ---------------------------------------------------------------
app.get('/api/hms/lab-assignments', async (req, res) => {
  try {
    const { admissionId, patientId, status } = req.query;
    let sql = 'SELECT * FROM lab_assignments WHERE 1=1';
    const params = [];
    if (admissionId) {
      sql += ' AND admission_id = ?';
      params.push(admissionId);
    }
    if (patientId) {
      sql += ' AND patient_id = ?';
      params.push(patientId);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC';
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, assignments: rows.map(mapLabAssignment) });
  } catch (err) {
    let list = memoryFallbackDb.labAssignments || [];
    if (req.query.admissionId) list = list.filter(a => a.admissionId === req.query.admissionId);
    if (req.query.patientId) list = list.filter(a => a.patientId === req.query.patientId);
    if (req.query.status) list = list.filter(a => a.status === req.query.status);
    res.json({ success: true, assignments: list });
  }
});

app.get('/api/v1/admissions/:admissionId/lab-assignments', async (req, res) => {
  try {
    const { admissionId } = req.params;
    const { status } = req.query;
    let sql = 'SELECT * FROM lab_assignments WHERE admission_id = ?';
    const params = [admissionId];
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC';
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, assignments: rows.map(mapLabAssignment) });
  } catch (err) {
    let list = (memoryFallbackDb.labAssignments || []).filter(a => a.admissionId === req.params.admissionId);
    if (req.query.status) list = list.filter(a => a.status === req.query.status);
    res.json({ success: true, assignments: list });
  }
});

app.post('/api/hms/lab-assignments', async (req, res) => {
  try {
    const { admissionId, patientId, investigations, assignedBy, appointmentId } = req.body;
    if (!admissionId) {
      return res.status(400).json({ error: 'Admission ID is required.' });
    }
    const [admRows] = await pool.query(
      "SELECT admission_id, patient_id, status FROM admissions WHERE admission_id = ?",
      [admissionId]
    );
    if (admRows.length === 0) {
      return res.status(404).json({ error: `Admission "${admissionId}" not found.` });
    }
    const adm = admRows[0];
    if (adm.status !== 'ADMITTED' && adm.status !== 'ACTIVE') {
      return res.status(400).json({ error: `Admission "${admissionId}" is discharged (${adm.status}). Investigations can only be assigned to active admissions.` });
    }
    const effectivePatientId = patientId || adm.patient_id;

    let list = [];
    if (Array.isArray(investigations)) {
      list = investigations.map(s => String(s).trim()).filter(Boolean);
    } else if (investigations && typeof investigations === 'string') {
      try {
        const parsed = JSON.parse(investigations);
        if (Array.isArray(parsed)) list = parsed.map(s => String(s).trim()).filter(Boolean);
        else list = [investigations.trim()];
      } catch (_) {
        list = investigations.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    if (list.length === 0) {
      return res.status(400).json({ error: 'At least one investigation is required.' });
    }

    const inserted = [];
    for (const invName of list) {
      const [existing] = await pool.query(
        "SELECT id FROM lab_assignments WHERE admission_id = ? AND LOWER(TRIM(investigation_name)) = LOWER(TRIM(?)) AND status = 'ASSIGNED'",
        [admissionId, invName]
      );
      if (existing.length === 0) {
        const cat = getInvestigationCategory(invName);
        const [ins] = await pool.query(
          "INSERT INTO lab_assignments (admission_id, patient_id, investigation_name, category, status, assigned_by, appointment_id) VALUES (?, ?, ?, ?, 'ASSIGNED', ?, ?)",
          [admissionId, effectivePatientId, invName, cat, assignedBy || 'Duty Nurse', appointmentId || null]
        );
        inserted.push({ id: ins.insertId, investigationName: invName, category: cat, status: 'ASSIGNED' });
      } else {
        inserted.push({ id: existing[0].id, investigationName: invName, category: getInvestigationCategory(invName), status: 'ASSIGNED', alreadyAssigned: true });
      }
    }

    res.json({ success: true, count: inserted.length, assignments: inserted });
  } catch (err) {
    console.error('Create lab assignments error:', err);
    const { admissionId, patientId, investigations, assignedBy } = req.body || {};
    if (admissionId && memoryFallbackDb) {
      let list = Array.isArray(investigations) ? investigations : [investigations];
      list = list.map(s => String(s).trim()).filter(Boolean);
      memoryFallbackDb.labAssignments = memoryFallbackDb.labAssignments || [];
      const inserted = [];
      for (const invName of list) {
        const cat = getInvestigationCategory(invName);
        const rec = {
          id: Date.now() + Math.floor(Math.random() * 1000),
          admissionId,
          patientId: patientId || '26PAT0001',
          investigationName: invName,
          category: cat,
          status: 'ASSIGNED',
          assignedBy: assignedBy || 'Duty Nurse',
          appointmentId: null,
          reportId: null
        };
        memoryFallbackDb.labAssignments.push(rec);
        inserted.push(rec);
      }
      return res.json({ success: true, count: inserted.length, assignments: inserted, offline: true });
    }
    res.status(500).json({ error: err.message });
  }
});


// Helper for validating dynamic 14-day appointment scheduling window (Req 6)
function validateAppointmentDate(dateStr) {
  if (!dateStr) return { valid: false, error: 'Appointment date is required.' };
  const str = String(dateStr).slice(0, 10);
  const parts = str.split('-');
  if (parts.length !== 3) return { valid: false, error: 'Invalid appointment date format. Expected YYYY-MM-DD.' };

  const targetYear = parseInt(parts[0], 10);
  const targetMonth = parseInt(parts[1], 10) - 1;
  const targetDay = parseInt(parts[2], 10);
  const targetDate = new Date(targetYear, targetMonth, targetDay);
  if (isNaN(targetDate.getTime())) return { valid: false, error: 'Invalid appointment date.' };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const maxDate = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);

  if (targetDate < today) {
    return { valid: false, error: `Appointment date (${str}) cannot be in the past. Date must be between today and 14 days ahead.` };
  }
  if (targetDate > maxDate) {
    const maxStr = maxDate.toISOString().slice(0, 10);
    return { valid: false, error: `Appointment date (${str}) exceeds the 14-day scheduling window (maximum allowed: ${maxStr}).` };
  }

  return { valid: true, date: str };
}

// Helper for updating existing appointment record (Req 2)
async function handleUpdateAppointmentRecord(targetId, updateData) {
  const [existingRows] = await pool.query('SELECT * FROM doctor_appointments WHERE id = ?', [targetId]);
  if (existingRows.length === 0) {
    return { status: 404, error: `Appointment ${targetId} not found.` };
  }
  const currentAppt = existingRows[0];

  // Status can only be changed to SCHEDULED, COMPLETED, or CANCELLED (Req 2)
  let newStatus = currentAppt.status;
  if (updateData.status) {
    const norm = String(updateData.status).trim().toUpperCase();
    if (!['SCHEDULED', 'COMPLETED', 'CANCELLED'].includes(norm)) {
      return { status: 400, error: `Invalid status "${updateData.status}". Allowed values: SCHEDULED, COMPLETED, CANCELLED.` };
    }
    newStatus = norm;
  }

  // Doctor compatibility with appointment's department
  const finalDoctor = updateData.doctorName ? String(updateData.doctorName).trim() : currentAppt.doctor_name;
  if (updateData.doctorName && !isDoctorCompatibleWithDepartment(finalDoctor, currentAppt.department)) {
    return {
      status: 400,
      error: `Doctor "${finalDoctor}" does not belong to appointment department "${currentAppt.department}".`,
      code: 'INCOMPATIBLE_DOCTOR_DEPARTMENT'
    };
  }

  // 14-day scheduling window validation if date is updated
  let finalDate = currentAppt.appointment_date;
  if (updateData.appointmentDate) {
    const dVal = validateAppointmentDate(updateData.appointmentDate);
    if (!dVal.valid) {
      return { status: 400, error: dVal.error };
    }
    finalDate = dVal.date;
  }

  const finalTime = updateData.appointmentTime ? String(updateData.appointmentTime).trim() : currentAppt.appointment_time;
  const finalType = updateData.appointmentType ? String(updateData.appointmentType).trim() : currentAppt.appointment_type;

  // Status changes and updates apply exclusively to the selected appointment (Req 2)
  await pool.query(
    `UPDATE doctor_appointments
     SET doctor_name = ?,
         appointment_date = ?,
         appointment_time = ?,
         appointment_type = ?,
         status = ?
     WHERE id = ?`,
    [finalDoctor, finalDate, finalTime, finalType, newStatus, targetId]
  );

  if (updateData.assignedLabReports !== undefined || updateData.assignedInvestigations !== undefined) {
    const rawAssigned = updateData.assignedLabReports !== undefined ? updateData.assignedLabReports : updateData.assignedInvestigations;
    let assignedList = [];
    if (Array.isArray(rawAssigned)) {
      assignedList = rawAssigned.map(s => String(s).trim()).filter(Boolean);
    } else if (rawAssigned && typeof rawAssigned === 'string') {
      try {
        const parsedArr = JSON.parse(rawAssigned);
        if (Array.isArray(parsedArr)) assignedList = parsedArr.map(s => String(s).trim()).filter(Boolean);
        else assignedList = [rawAssigned.trim()];
      } catch (_) {
        assignedList = rawAssigned.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    const assignedStr = assignedList.join(', ');
    await pool.query('UPDATE doctor_appointments SET assigned_lab_reports = ? WHERE id = ?', [assignedStr, targetId]).catch(() => {});

    for (const invName of assignedList) {
      const [existingAssigned] = await pool.query(
        "SELECT id FROM lab_assignments WHERE admission_id = ? AND LOWER(TRIM(investigation_name)) = LOWER(TRIM(?)) AND status = 'ASSIGNED'",
        [currentAppt.admission_id, invName]
      );
      if (existingAssigned.length === 0) {
        const cat = getInvestigationCategory(invName);
        await pool.query(
          "INSERT INTO lab_assignments (admission_id, patient_id, investigation_name, category, status, assigned_by, appointment_id) VALUES (?, ?, ?, ?, 'ASSIGNED', ?, ?)",
          [currentAppt.admission_id, currentAppt.patient_id, invName, cat, 'Duty Nurse', targetId]
        );
      }
    }
  }

  return { success: true, id: targetId };
}

app.post('/api/hms/appointments', async (req, res) => {
  try {
    const {
      id,
      recordId,
      admissionId,
      doctorName,
      department,
      appointmentDate,
      appointmentTime,
      appointmentType,
      room,
      status,
      scheduledBy,
      assignedLabReports,
      assignedInvestigations
    } = req.body;

    const targetId = id || recordId;
    if (targetId) {
      // EDIT WORKFLOW (Req 2): Status changes and updates apply only to this selected appointment
      const result = await handleUpdateAppointmentRecord(targetId, {
        doctorName,
        appointmentDate,
        appointmentTime,
        appointmentType,
        status,
        assignedLabReports: assignedLabReports !== undefined ? assignedLabReports : assignedInvestigations
      });
      if (!result.success) {
        return res.status(result.status || 400).json({ error: result.error, code: result.code });
      }
      return res.json({ success: true, id: targetId, snapshot: await buildSnapshot() });
    }

    // NEW APPOINTMENT WORKFLOW (Req 1, 3, 4, 5, 6, 7, 9)
    if (!admissionId) {
      return res.status(400).json({ error: 'Admission ID is required.' });
    }
    if (!doctorName || !String(doctorName).trim() || String(doctorName).trim() === 'Select Doctor') {
      return res.status(400).json({ error: 'Please select an Attending Doctor.' });
    }
    if (!appointmentTime) {
      return res.status(400).json({ error: 'Appointment time is required.' });
    }
    if (!appointmentType || !String(appointmentType).trim()) {
      return res.status(400).json({ error: 'Appointment type / reason is required.' });
    }

    // 1. Validate Active Admission
    const [admRows] = await pool.query(
      "SELECT admission_id, patient_id, admitting_dept, current_dept, room_number, attending_doctor, status FROM admissions WHERE admission_id = ?",
      [admissionId]
    );
    if (admRows.length === 0) {
      return res.status(404).json({ error: `Admission "${admissionId}" not found.` });
    }
    const adm = admRows[0];
    if (adm.status !== 'ADMITTED' && adm.status !== 'ACTIVE') {
      return res.status(400).json({
        error: `Admission "${admissionId}" is discharged (${adm.status}). Appointments can only be scheduled for active admissions.`
      });
    }

    const patientId = adm.patient_id;
    const patientDept = adm.current_dept || adm.admitting_dept || 'General';
    // Req 4: Room is automatically obtained from active admission
    const patientRoom = adm.room_number || 'General Ward';

    // 2. Validate Doctor belongs to patient's department (Req 5)
    const cleanDoctor = String(doctorName).trim();
    if (!isDoctorCompatibleWithDepartment(cleanDoctor, patientDept)) {
      return res.status(400).json({
        error: `Doctor "${cleanDoctor}" does not belong to patient department "${patientDept}". Appointments can only be assigned to doctors belonging to ${patientDept}.`,
        code: 'INCOMPATIBLE_DOCTOR_DEPARTMENT'
      });
    }

    // 3. Validate appointment date within next 14 days (Req 6)
    const dateValidation = validateAppointmentDate(appointmentDate);
    if (!dateValidation.valid) {
      return res.status(400).json({ error: dateValidation.error });
    }
    const validDate = dateValidation.date;

    // 4. Parse optional assigned lab reports
    const rawAssigned = assignedLabReports !== undefined ? assignedLabReports : assignedInvestigations;
    let assignedList = [];
    if (Array.isArray(rawAssigned)) {
      assignedList = rawAssigned.map(s => String(s).trim()).filter(Boolean);
    } else if (rawAssigned && typeof rawAssigned === 'string') {
      try {
        const parsedArr = JSON.parse(rawAssigned);
        if (Array.isArray(parsedArr)) assignedList = parsedArr.map(s => String(s).trim()).filter(Boolean);
        else assignedList = [rawAssigned.trim()];
      } catch (_) {
        assignedList = rawAssigned.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    const assignedStr = assignedList.join(', ');

    // 5. Req 1: Status must automatically be set to 'SCHEDULED' on creation
    const initialStatus = 'SCHEDULED';

    // Deduplicate: check if an appointment already exists for this admission, doctor, date, and time
    const [existingAppt] = await pool.query(
      `SELECT id FROM doctor_appointments 
       WHERE admission_id = ? AND doctor_name = ? AND appointment_date = ? AND appointment_time = ?`,
      [admissionId, cleanDoctor, validDate, appointmentTime]
    );
    if (existingAppt.length > 0) {
      await pool.query(
        `UPDATE doctor_appointments
         SET department = ?,
             appointment_type = ?,
             room = ?,
             assigned_lab_reports = COALESCE(NULLIF(?, ''), assigned_lab_reports),
             status = 'SCHEDULED'
         WHERE id = ?`,
        [patientDept, appointmentType.trim(), patientRoom, assignedStr, existingAppt[0].id]
      );

      for (const invName of assignedList) {
        const [existingAssigned] = await pool.query(
          "SELECT id FROM lab_assignments WHERE admission_id = ? AND LOWER(TRIM(investigation_name)) = LOWER(TRIM(?)) AND status = 'ASSIGNED'",
          [admissionId, invName]
        );
        if (existingAssigned.length === 0) {
          const cat = getInvestigationCategory(invName);
          await pool.query(
            "INSERT INTO lab_assignments (admission_id, patient_id, investigation_name, category, status, assigned_by, appointment_id) VALUES (?, ?, ?, ?, 'ASSIGNED', ?, ?)",
            [admissionId, patientId, invName, cat, scheduledBy || 'Duty Nurse', existingAppt[0].id]
          );
        }
      }

      return res.json({ success: true, id: existingAppt[0].id, assignedLabReports: assignedStr, snapshot: await buildSnapshot() });
    }

    const [result] = await pool.query(
      `INSERT INTO doctor_appointments (admission_id, patient_id, doctor_name, department, appointment_date, appointment_time, appointment_type, room, status, scheduled_by, assigned_lab_reports)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SCHEDULED', ?, ?)`,
      [admissionId, patientId, cleanDoctor, patientDept, validDate, appointmentTime, appointmentType.trim(), patientRoom, scheduledBy || 'Duty Nurse', assignedStr]
    );

    for (const invName of assignedList) {
      const [existingAssigned] = await pool.query(
        "SELECT id FROM lab_assignments WHERE admission_id = ? AND LOWER(TRIM(investigation_name)) = LOWER(TRIM(?)) AND status = 'ASSIGNED'",
        [admissionId, invName]
      );
      if (existingAssigned.length === 0) {
        const cat = getInvestigationCategory(invName);
        await pool.query(
          "INSERT INTO lab_assignments (admission_id, patient_id, investigation_name, category, status, assigned_by, appointment_id) VALUES (?, ?, ?, ?, 'ASSIGNED', ?, ?)",
          [admissionId, patientId, invName, cat, scheduledBy || 'Duty Nurse', result.insertId]
        );
      }
    }

    res.json({ success: true, id: result.insertId, assignedLabReports: assignedStr, snapshot: await buildSnapshot() });
  } catch (err) {
    console.error('Save appointment error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/hms/appointments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await handleUpdateAppointmentRecord(id, req.body);
    if (!result.success) {
      return res.status(result.status || 400).json({ error: result.error, code: result.code });
    }
    res.json({ success: true, id, snapshot: await buildSnapshot() });
  } catch (err) {
    console.error('Update appointment error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/hms/appointments/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const norm = String(status || '').trim().toUpperCase();
    if (!['SCHEDULED', 'COMPLETED', 'CANCELLED'].includes(norm)) {
      return res.status(400).json({ error: `Invalid status "${status}". Allowed values: SCHEDULED, COMPLETED, CANCELLED.` });
    }
    const [result] = await pool.query('UPDATE doctor_appointments SET status = ? WHERE id = ?', [norm, id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: `Appointment ${id} not found.` });
    }
    res.json({ success: true, id, status: norm, snapshot: await buildSnapshot() });
  } catch (err) {
    console.error('Status update error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// 6. Pharmacy Dispensing & Emergency "Pay Later" (Req 8, 9)
// ---------------------------------------------------------------
app.post('/api/hms/pharmacy/dispense', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const {
      admissionId,
      prescriptionId,
      transactionType, // 'IMMEDIATE' or 'EMERGENCY_PAY_LATER'
      dispensedBy,
      pickupCounter,
      notes
    } = req.body;

    if (!admissionId) {
      return res.status(400).json({ error: 'Admission ID is required.' });
    }
    if (!prescriptionId) {
      return res.status(400).json({ error: 'Linked Doctor Prescription is required for pharmacy dispensing.' });
    }

    const validCounters = [
      'Ground Floor Counter 1',
      'Ground Floor Counter 2',
      'Ground Floor Counter 3',
      'Emergency Pharmacy Counter'
    ];
    if (!pickupCounter || !validCounters.includes(pickupCounter.trim())) {
      return res.status(400).json({ error: 'A valid Pickup Counter / Location must be selected from the available counters.' });
    }
    const counter = pickupCounter.trim();

    await conn.beginTransaction();

    // Authoritative verification: linked prescription must exist and belong to this admission
    const [rxRows] = await conn.query('SELECT * FROM prescriptions WHERE id = ? AND admission_id = ?', [prescriptionId, admissionId]);
    if (rxRows.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: `Prescription ${prescriptionId} not found or does not belong to admission ${admissionId}.` });
    }
    const linkedRx = rxRows[0];

    // Deduplicate: prevent dispensing an already collected prescription or duplicate transaction
    if (linkedRx.is_collected === 1 || linkedRx.status === 'Collected by Caregiver') {
      await conn.rollback();
      return res.status(409).json({ error: `Prescription ${prescriptionId} has already been dispensed and collected.` });
    }
    const [existingTx] = await conn.query('SELECT id, tx_id FROM pharmacy_transactions WHERE prescription_id = ?', [prescriptionId]);
    if (existingTx.length > 0) {
      await conn.rollback();
      return res.status(409).json({ error: `Prescription ${prescriptionId} has already been dispensed (Transaction: ${existingTx[0].tx_id}).` });
    }

    const medicineName = linkedRx.name;

    // Authoritative pricing: retrieve authoritative unit price from medicine_master
    const [medMasterRows] = await conn.query('SELECT * FROM medicine_master WHERE name = ?', [medicineName]);
    let authoritativeUnitPrice = 0;
    if (medMasterRows.length > 0) {
      authoritativeUnitPrice = Number(medMasterRows[0].unit_price);
    } else {
      const [fuzzyRows] = await conn.query('SELECT * FROM medicine_master WHERE ? LIKE CONCAT("%", generic_name, "%") OR name LIKE ?', [medicineName, `%${medicineName.split(' ')[0]}%`]);
      if (fuzzyRows.length > 0) {
        authoritativeUnitPrice = Number(fuzzyRows[0].unit_price);
      } else {
        authoritativeUnitPrice = Number(req.body.unitPrice) || 25.00;
      }
    }

    // Authoritative quantity: derive from prescription data
    const qty = Number(req.body.quantity) || linkedRx.quantity || calculatePrescriptionQuantity(linkedRx.dosage, linkedRx.frequency, linkedRx.duration) || 1;
    if (qty <= 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Valid dispense quantity is required.' });
    }

    // Authoritative total calculation (Dispense Quantity * Unit Price)
    const price = authoritativeUnitPrice;
    const total = Number((qty * price).toFixed(2));

    const [admRows] = await conn.query('SELECT patient_id FROM admissions WHERE admission_id = ?', [admissionId]);
    let patientId = admRows[0] ? admRows[0].patient_id : null;
    if (!patientId) {
      const [pRows] = await conn.query('SELECT patient_id FROM patients WHERE admission_id = ?', [admissionId]);
      patientId = pRows[0] ? pRows[0].patient_id : 'UNKNOWN';
    }

    const txId = 'PTX-' + Math.floor(100000 + Math.random() * 900000);
    const isEmergency = transactionType === 'EMERGENCY_PAY_LATER';
    const paymentStatus = isEmergency ? 'PENDING' : 'PAID';
    const token = linkedRx.token || req.body.pickupToken || ('PH-' + Math.floor(1000 + Math.random() * 9000));

    await conn.query(
      `INSERT INTO pharmacy_transactions (tx_id, admission_id, patient_id, prescription_id, medicine_name, quantity, unit_price, total_amount, transaction_type, payment_status, dispensed_by, pickup_counter, pickup_token, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [txId, admissionId, patientId, prescriptionId, medicineName, qty, price, total,
       isEmergency ? 'EMERGENCY_PAY_LATER' : 'IMMEDIATE', paymentStatus, dispensedBy || 'Pharmacy Staff',
       counter, token, notes || '']
    );

    // Update status in prescriptions table
    await conn.query(
      "UPDATE prescriptions SET status = 'Collected by Caregiver', badge_class = 'badge-success', is_collected = 1 WHERE id = ?",
      [prescriptionId]
    );

    // If emergency pay later, add to admission's bill and increase remaining payable
    if (isEmergency && total > 0) {
      await conn.query(
        `INSERT INTO bill_items (admission_id, description, category, amount)
         VALUES (?, ?, 'Pharmacy', ?)`,
        [admissionId, `Emergency Pharmacy (Pay Later): ${medicineName} (Qty: ${qty})`, total]
      );

      await conn.query(
        `INSERT INTO billing_summary (admission_id, total_bill, insurance_covered, remaining_payable, claim_status)
         VALUES (?, ?, 0, ?, 'Pending')
         ON DUPLICATE KEY UPDATE total_bill = total_bill + VALUES(total_bill),
                                 remaining_payable = remaining_payable + VALUES(remaining_payable)`,
        [admissionId, total, total]
      );
    }

    await conn.commit();
    res.json({
      success: true,
      txId,
      paymentStatus,
      unitPrice: price,
      totalAmount: total,
      quantity: qty,
      medicineName,
      prescriptionId,
      snapshot: await buildSnapshot()
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

app.post('/api/hms/pharmacy/pay-emergency', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const txId = req.body.txId || req.body.transactionId;
    const method = req.body.method || req.body.paymentMethod || 'UPI (HMS Counter)';
    if (!txId) return res.status(400).json({ error: 'Transaction ID is required.' });

    await conn.beginTransaction();
    const [txRows] = await conn.query('SELECT * FROM pharmacy_transactions WHERE tx_id = ?', [txId]);
    if (txRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Pharmacy transaction not found.' });
    }

    const tx = txRows[0];
    if (tx.payment_status === 'PAID') {
      await conn.commit();
      return res.json({ success: true, message: 'Already paid', snapshot: await buildSnapshot() });
    }

    const amount = Number(tx.total_amount);
    const admissionId = tx.admission_id;

    // Mark transaction as PAID
    await conn.query("UPDATE pharmacy_transactions SET payment_status = 'PAID' WHERE tx_id = ?", [txId]);

    // Record payment entry
    const paymentTxId = 'TXN-' + Math.floor(100000 + Math.random() * 900000);
    await conn.query(
      `INSERT INTO payments (tx_id, admission_id, date_label, method, amount, status)
       VALUES (?, ?, 'Today', ?, ?, 'Paid')`,
      [paymentTxId, admissionId, (method || 'Cash') + ' (Emergency Settlement)', amount]
    );

    // Reduce remaining payable
    await conn.query(
      `UPDATE billing_summary
       SET remaining_payable = GREATEST(0, remaining_payable - ?)
       WHERE admission_id = ?`,
      [amount, admissionId]
    );

    await conn.commit();
    res.json({ success: true, snapshot: await buildSnapshot() });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// --- Spring Boot / Flutter Compatibility Routes (/api/v1) ---
app.get('/api/v1/patients', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM patients_master ORDER BY created_at DESC');
    res.json(rows.map(p => ({
      patientId: p.patient_id,
      name: p.full_name,
      phone: p.patient_phone,
      bloodGroup: p.blood_group,
      ageGender: p.age_gender
    })));
  } catch (err) {
    const fallbackList = (memoryFallbackDb.patients || []).map(p => ({
      patientId: p.patientId,
      name: p.fullName,
      phone: p.patientPhone,
      bloodGroup: 'B+ve',
      ageGender: p.ageGender
    }));
    res.json(fallbackList);
  }
});

app.get('/api/v1/patients/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const [rows] = await pool.query('SELECT * FROM patients_master WHERE patient_id = ?', [patientId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Patient not found' });
    const p = rows[0];
    let dobFormatted = null;
    if (p.dob) {
      if (p.dob instanceof Date) {
        dobFormatted = p.dob.toISOString().slice(0, 10);
      } else {
        dobFormatted = String(p.dob).slice(0, 10);
      }
    }
    res.json({
      patientId: p.patient_id,
      name: p.full_name,
      dob: dobFormatted,
      phone: p.patient_phone,
      bloodGroup: p.blood_group,
      ageGender: p.age_gender
    });
  } catch (err) {
    const p = (memoryFallbackDb.patients || []).find(x => x.patientId === req.params.patientId);
    if (!p) return res.status(404).json({ error: 'Patient not found' });
    res.json({
      patientId: p.patientId,
      name: p.fullName,
      dob: p.dob,
      phone: p.patientPhone,
      bloodGroup: 'B+ve',
      ageGender: p.ageGender
    });
  }
});

function formatAdmissionResponse(a, isReadOnly = false, customCaregiver = null) {
  let patientAge = null;
  let gender = '';
  if (a.age_gender) {
    const ageMatch = String(a.age_gender).match(/(\d+)\s*(?:Years|yr|y\.?o\.?)?/i);
    if (ageMatch) {
      patientAge = parseInt(ageMatch[1], 10);
    }
    const lower = String(a.age_gender).toLowerCase();
    if (lower.includes('female')) {
      gender = 'Female';
    } else if (lower.includes('male')) {
      gender = 'Male';
    } else if (lower.includes('other')) {
      gender = 'Other';
    }
  }

  let admDateStr = null;
  if (a.admission_date) {
    if (a.admission_date instanceof Date) {
      admDateStr = a.admission_date.toISOString();
    } else if (typeof a.admission_date === 'string') {
      admDateStr = a.admission_date.includes('T') ? a.admission_date : `${a.admission_date}T00:00:00.000Z`;
    }
  }
  let disDateStr = null;
  if (a.discharge_date) {
    if (a.discharge_date instanceof Date) {
      disDateStr = a.discharge_date.toISOString();
    } else if (typeof a.discharge_date === 'string') {
      disDateStr = a.discharge_date.includes('T') ? a.discharge_date : `${a.discharge_date}T00:00:00.000Z`;
    }
  }

  const effectiveReadOnly = Boolean(isReadOnly || a.status === 'DISCHARGED' || a.access_role === 'READ_ONLY');

  return {
    admissionId: a.admission_id,
    id: a.admission_id,
    patientId: a.patient_id,
    patientName: a.patient_name || a.full_name || '',
    patientAge: patientAge,
    gender: gender,
    phone: a.patient_phone || '',
    bloodGroup: a.blood_group || '',
    status: a.status === 'ADMITTED' ? 'ACTIVE' : a.status,
    rawStatus: a.status,
    doctor: a.attending_doctor || 'Attending Physician',
    department: a.current_dept || a.admitting_dept || 'General',
    room: a.room_number || '',
    roomWard: a.room_number || '',
    admissionDate: admDateStr || new Date().toISOString(),
    dischargeDate: disDateStr,
    reason: a.reason_for_admission || '',
    hospitalName: 'CareBridge Medical Center',
    isReadOnly: effectiveReadOnly,
    role: effectiveReadOnly ? 'READ_ONLY' : 'FULL_ACCESS',
    caregiverRole: effectiveReadOnly ? 'family' : 'primary',
    caregiver: customCaregiver || {
      caregiverName: a.caregiver_name || '',
      caregiverMobile: a.caregiver_phone || '',
      relationship: a.relation || a.emergency_contact_relation || 'Primary Caregiver',
      accessStatus: (a.carebridge_access === 'Active' || a.carebridge_status === 'Active') ? 'ACTIVE' : (a.carebridge_access || 'ACTIVE')
    }
  };
}

app.get('/api/v1/patients/:patientId/admissions', async (req, res) => {
  try {
    const { patientId } = req.params;
    const [rows] = await pool.query(
      `SELECT a.*, p.full_name as patient_name, p.age_gender, p.patient_phone, p.blood_group,
              p.emergency_contact_name, p.emergency_contact_phone, p.emergency_contact_relation
       FROM admissions a
       LEFT JOIN patients_master p ON a.patient_id = p.patient_id
       WHERE a.patient_id = ?
       ORDER BY CASE WHEN a.status IN ('ADMITTED', 'ACTIVE') THEN 0 ELSE 1 END, a.created_at DESC`,
      [patientId]
    );
    res.json(rows.map(r => formatAdmissionResponse(r, false)));
  } catch (err) {
    const matching = (memoryFallbackDb.patients || []).filter(p => p.patientId === req.params.patientId);
    res.json(matching.map(p => ({
      admissionId: p.admissionId,
      id: p.admissionId,
      patientId: p.patientId,
      patientName: p.fullName,
      patientAge: p.age,
      gender: p.gender,
      phone: p.patientPhone,
      bloodGroup: 'B+ve',
      status: p.status === 'ADMITTED' ? 'ACTIVE' : p.status,
      doctor: p.attendingDoctor,
      department: p.department,
      room: p.roomNumber,
      admissionDate: p.admissionDate,
      reason: p.reasonForAdmission,
      hospitalName: 'CareBridge Medical Center',
      caregiver: {
        caregiverName: p.caregiverName,
        caregiverMobile: p.caregiverPhone,
        relationship: p.relation,
        accessStatus: 'ACTIVE'
      }
    })));
  }
});

app.get('/api/v1/admissions/:admissionId', async (req, res) => {
  try {
    const { admissionId } = req.params;
    const caregiverHeader = req.headers['x-caregiver-mobile'] || req.query.caregiverMobile || '';
    const rawDigits = String(caregiverHeader).replace(/\D/g, '');
    const last10 = rawDigits.slice(-10);

    const [rows] = await pool.query(
      `SELECT a.*, p.full_name as patient_name, p.age_gender, p.patient_phone, p.blood_group,
              p.emergency_contact_name, p.emergency_contact_phone, p.emergency_contact_relation
       FROM admissions a
       LEFT JOIN patients_master p ON a.patient_id = p.patient_id
       WHERE a.admission_id = ?`,
      [admissionId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Admission not found' });
    }

    let isReadOnly = false;
    let customCaregiver = null;

    if (last10) {
      const [familyRows] = await pool.query(
        `SELECT * FROM admission_caregivers 
         WHERE admission_id = ? 
           AND REPLACE(REPLACE(REPLACE(caregiver_mobile, ' ', ''), '-', ''), '+', '') LIKE ?
           AND access_status = 'ACTIVE' AND disabled_at IS NULL`,
        [admissionId, `%${last10}%`]
      );
      if (familyRows.length > 0) {
        isReadOnly = familyRows[0].role === 'READ_ONLY';
        customCaregiver = {
          caregiverName: familyRows[0].caregiver_name,
          caregiverMobile: familyRows[0].caregiver_mobile,
          relationship: familyRows[0].relationship || 'Extended Family Member',
          accessStatus: familyRows[0].access_status
        };
      }
    }

    res.json(formatAdmissionResponse(rows[0], isReadOnly, customCaregiver));
  } catch (err) {
    const p = (memoryFallbackDb.patients || []).find(x => x.admissionId === req.params.admissionId);
    if (!p) return res.status(404).json({ error: 'Admission not found' });
    return res.json({
      admissionId: p.admissionId,
      id: p.admissionId,
      patientId: p.patientId,
      patientName: p.fullName,
      patientAge: p.age,
      gender: p.gender,
      phone: p.patientPhone,
      bloodGroup: 'B+ve',
      status: p.status === 'ADMITTED' ? 'ACTIVE' : p.status,
      doctor: p.attendingDoctor,
      department: p.department,
      room: p.roomNumber,
      admissionDate: p.admissionDate,
      reason: p.reasonForAdmission,
      hospitalName: 'CareBridge Medical Center',
      isReadOnly: false,
      role: 'FULL_ACCESS',
      caregiverRole: 'primary',
      caregiver: {
        caregiverName: p.caregiverName,
        caregiverMobile: p.caregiverPhone,
        relationship: p.relation,
        accessStatus: 'ACTIVE'
      }
    });
  }
});

app.get('/api/v1/caregivers/previous', async (req, res) => {
  try {
    const { patientId } = req.query;
    const [rows] = await pool.query('SELECT * FROM admissions WHERE patient_id = ? ORDER BY created_at DESC LIMIT 1', [patientId]);
    if (rows.length === 0) return res.json(null);
    res.json({
      caregiverName: rows[0].caregiver_name,
      caregiverMobile: rows[0].caregiver_phone,
      relationship: rows[0].relation
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/v1/caregivers/:mobile/admissions', async (req, res) => {
  try {
    const rawDigits = (req.params.mobile || '').replace(/\D/g, '');
    const last10 = rawDigits.slice(-10);

    // 1. Identify primary caregiver patient IDs
    const [patRows] = await pool.query(
      `SELECT DISTINCT patient_id 
       FROM admissions 
       WHERE REPLACE(REPLACE(REPLACE(caregiver_phone, ' ', ''), '-', ''), '+', '') LIKE ?
       UNION
       SELECT DISTINCT patient_id 
       FROM patients_master 
       WHERE REPLACE(REPLACE(REPLACE(emergency_contact_phone, ' ', ''), '-', ''), '+', '') LIKE ?`,
      [`%${last10}%`, `%${last10}%`]
    );
    const pids = patRows.map(r => r.patient_id).filter(Boolean);

    // 2. Identify authorized secondary / family admissions
    const [familyRows] = await pool.query(
      `SELECT ac.admission_id, ac.caregiver_name, ac.caregiver_mobile, ac.relationship, ac.role, ac.access_status
       FROM admission_caregivers ac
       WHERE REPLACE(REPLACE(REPLACE(ac.caregiver_mobile, ' ', ''), '-', ''), '+', '') LIKE ?
         AND ac.access_status = 'ACTIVE' AND ac.disabled_at IS NULL`,
      [`%${last10}%`]
    );

    const familyAdmMap = new Map();
    for (const f of familyRows) {
      familyAdmMap.set(f.admission_id, f);
    }
    const familyAdmIds = Array.from(familyAdmMap.keys());

    // Fallback: direct match on caregiver_phone if no patient_id or family found
    if (pids.length === 0 && familyAdmIds.length === 0) {
      const [directRows] = await pool.query(
        `SELECT a.*, p.full_name as patient_name, p.age_gender, p.patient_phone, p.blood_group,
                p.emergency_contact_name, p.emergency_contact_phone, p.emergency_contact_relation
         FROM admissions a
         LEFT JOIN patients_master p ON a.patient_id = p.patient_id
         WHERE REPLACE(REPLACE(REPLACE(a.caregiver_phone, ' ', ''), '-', ''), '+', '') LIKE ?
         ORDER BY CASE WHEN a.status IN ('ADMITTED', 'ACTIVE') THEN 0 ELSE 1 END, a.created_at DESC`,
        [`%${last10}%`]
      );
      return res.json(directRows.map(r => formatAdmissionResponse(r, false)));
    }

    const combinedResults = [];
    const seenAdmIds = new Set();

    // Add primary admissions
    if (pids.length > 0) {
      const [primaryRows] = await pool.query(
        `SELECT a.*, p.full_name as patient_name, p.age_gender, p.patient_phone, p.blood_group,
                p.emergency_contact_name, p.emergency_contact_phone, p.emergency_contact_relation
         FROM admissions a
         LEFT JOIN patients_master p ON a.patient_id = p.patient_id
         WHERE a.patient_id IN (?)
         ORDER BY CASE WHEN a.status IN ('ADMITTED', 'ACTIVE') THEN 0 ELSE 1 END, a.created_at DESC`,
        [pids]
      );
      for (const r of primaryRows) {
        seenAdmIds.add(r.admission_id);
        combinedResults.push(formatAdmissionResponse(r, false));
      }
    }

    // Add authorized secondary / family admissions
    if (familyAdmIds.length > 0) {
      const missingAdmIds = familyAdmIds.filter(id => !seenAdmIds.has(id));
      if (missingAdmIds.length > 0) {
        const [secondaryRows] = await pool.query(
          `SELECT a.*, p.full_name as patient_name, p.age_gender, p.patient_phone, p.blood_group,
                  p.emergency_contact_name, p.emergency_contact_phone, p.emergency_contact_relation
           FROM admissions a
           LEFT JOIN patients_master p ON a.patient_id = p.patient_id
           WHERE a.admission_id IN (?)
           ORDER BY CASE WHEN a.status IN ('ADMITTED', 'ACTIVE') THEN 0 ELSE 1 END, a.created_at DESC`,
          [missingAdmIds]
        );
        for (const r of secondaryRows) {
          const famInfo = familyAdmMap.get(r.admission_id);
          const isReadOnly = famInfo ? famInfo.role === 'READ_ONLY' : true;
          combinedResults.push(formatAdmissionResponse(r, isReadOnly, {
            caregiverName: famInfo?.caregiver_name || r.caregiver_name,
            caregiverMobile: famInfo?.caregiver_mobile || r.caregiver_phone,
            relationship: famInfo?.relationship || 'Extended Family Member',
            accessStatus: famInfo?.access_status || 'ACTIVE'
          }));
        }
      }
    }

    res.json(combinedResults);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Family Access Management Endpoints
app.get('/api/v1/admissions/:admissionId/family', async (req, res) => {
  try {
    const { admissionId } = req.params;
    const [rows] = await pool.query(
      `SELECT id, admission_id, caregiver_name, caregiver_mobile, relationship, access_status, role, created_at
       FROM admission_caregivers
       WHERE admission_id = ? AND access_status = 'ACTIVE' AND disabled_at IS NULL
       ORDER BY created_at ASC`,
      [admissionId]
    );

    const list = rows.map(r => ({
      id: String(r.id),
      admissionId: r.admission_id,
      name: r.caregiver_name,
      phone: r.caregiver_mobile,
      relation: r.relationship || 'Extended Family Member',
      role: r.role === 'READ_ONLY' ? 'Extended Family Member (Read-Only)' : (r.role || 'Extended Family Member (Read-Only)'),
      accessStatus: r.access_status,
      isPrimary: 'false'
    }));

    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/v1/admissions/:admissionId/family', async (req, res) => {
  try {
    const { admissionId } = req.params;
    const { name, phone, relation, role } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required.' });
    }

    const [admRows] = await pool.query('SELECT admission_id FROM admissions WHERE admission_id = ?', [admissionId]);
    if (admRows.length === 0) {
      return res.status(404).json({ error: 'Admission not found.' });
    }

    const rawDigits = String(phone).replace(/\D/g, '');
    const nationalNumber = rawDigits.length === 12 && rawDigits.startsWith('91') ? rawDigits.slice(2) : rawDigits;
    const normalizedMobile = nationalNumber.length === 10 ? `+91${nationalNumber}` : String(phone).trim();

    await pool.query(
      `INSERT INTO admission_caregivers (admission_id, caregiver_name, caregiver_mobile, relationship, access_status, role, disabled_at)
       VALUES (?, ?, ?, ?, 'ACTIVE', 'READ_ONLY', NULL)
       ON DUPLICATE KEY UPDATE
         caregiver_name = VALUES(caregiver_name),
         relationship = VALUES(relationship),
         access_status = 'ACTIVE',
         role = 'READ_ONLY',
         disabled_at = NULL`,
      [admissionId, name.trim(), normalizedMobile, relation || 'Extended Family Member']
    );

    res.status(201).json({
      success: true,
      message: 'Extended family member added — access granted!',
      member: {
        admissionId,
        name: name.trim(),
        phone: normalizedMobile,
        relation: relation || 'Extended Family Member',
        role: 'Extended Family Member (Read-Only)',
        isPrimary: 'false'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/v1/admissions/:admissionId/family/:mobile', async (req, res) => {
  try {
    const { admissionId, mobile } = req.params;
    const rawDigits = String(mobile || '').replace(/\D/g, '');
    const last10 = rawDigits.slice(-10);

    await pool.query(
      `UPDATE admission_caregivers 
       SET access_status = 'DISABLED', disabled_at = NOW() 
       WHERE admission_id = ? 
         AND REPLACE(REPLACE(REPLACE(caregiver_mobile, ' ', ''), '-', ''), '+', '') LIKE ?`,
      [admissionId, `%${last10}%`]
    );

    res.json({ success: true, message: 'Family access revoked' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Alias endpoints for OpenAPI compatibility
app.get('/api/v1/family', async (req, res) => {
  const admissionId = req.query.admissionId || req.headers['x-admission-id'];
  if (!admissionId) return res.json([]);
  req.params.admissionId = admissionId;
  return app._router.handle(req, res);
});


app.post('/api/v1/auth/send-otp', (req, res) => {
  res.json({ developmentOnly: true, otp: '123456' });
});

app.post('/api/v1/auth/verify-otp', (req, res) => {
  res.json({ success: true, message: 'OTP verified successfully' });
});

// Observation / Treatment Updates
app.get('/api/v1/admissions/:admissionId/observations', async (req, res) => {
  try {
    const { admissionId } = req.params;
    const [rows] = await pool.query('SELECT * FROM treatments WHERE admission_id = ? ORDER BY id DESC', [admissionId]);
    res.json(rows.map(t => ({
      id: t.id,
      patientId: t.patient_id,
      admissionId: t.admission_id,
      doctorName: t.doctor_name,
      department: t.dept,
      note: t.note,
      vitals: t.vitals,
      createdAt: t.created_at || new Date().toISOString()
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/v1/admissions/:admissionId/observations', async (req, res) => {
  try {
    const { admissionId } = req.params;
    const { doctorName, department, note, vitals, patientId } = req.body;
    let pid = patientId;
    if (!pid) {
      const [adm] = await pool.query('SELECT patient_id FROM admissions WHERE admission_id = ?', [admissionId]);
      pid = adm[0]?.patient_id || 'UNKNOWN';
    }
    // Deduplicate: check if an identical note + vitals was already submitted recently
    const [existingObs] = await pool.query(
      `SELECT id FROM treatments WHERE admission_id = ? AND note = ? AND vitals = ? AND created_at >= NOW() - INTERVAL 10 SECOND`,
      [admissionId, note || '', vitals || '']
    );
    if (existingObs.length > 0) {
      return res.json({
        id: existingObs[0].id,
        admissionId,
        patientId: pid,
        doctorName: doctorName || 'Physician',
        department: department || 'General',
        note: note || '',
        vitals: vitals || '',
        createdAt: new Date().toISOString()
      });
    }

    const [result] = await pool.query(
      `INSERT INTO treatments (admission_id, patient_id, doctor_name, dept, date_label, note, vitals)
       VALUES (?, ?, ?, ?, 'Today', ?, ?)`,
      [admissionId, pid, doctorName || 'Physician', department || 'General', note || '', vitals || '']
    );
    res.json({
      id: result.insertId,
      admissionId,
      patientId: pid,
      doctorName,
      department,
      note,
      vitals,
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generic records endpoints for prescriptions, schedule, lab reports, pharmacy
app.get('/api/v1/admissions/:admissionId/records/:type', async (req, res) => {
  try {
    const { admissionId, type } = req.params;
    if (type === 'schedule') {
      const [rows] = await pool.query('SELECT * FROM doctor_appointments WHERE admission_id = ?', [admissionId]);
      return res.json(rows.map(r => ({
        id: r.id,
        resourceType: 'schedule',
        payload: JSON.stringify({
          recordId: r.id,
          admissionId: r.admission_id,
          patientId: r.patient_id,
          doctor: r.doctor_name,
          department: r.department,
          eventDate: r.appointment_date,
          appointmentTime: r.appointment_time,
          appointmentType: r.appointment_type,
          room: r.room,
          status: r.status
        })
      })));
    }
    if (type === 'prescriptions') {
      const [rows] = await pool.query('SELECT * FROM prescriptions WHERE admission_id = ? ORDER BY created_at ASC', [admissionId]);
      return res.json(rows.map(r => {
        const pDate = formatDateOnly(r.prescription_date || r.created_at);
        return {
          id: r.id,
          resourceType: 'prescriptions',
          payload: JSON.stringify({
            recordId: r.id,
            prescriptionId: r.id,
            admissionId: r.admission_id,
            patientId: r.patient_id,
            medicineName: r.name,
            dosage: r.dosage,
            frequency: r.frequency || '',
            duration: r.duration,
            quantity: r.quantity || calculatePrescriptionQuantity(r.dosage, r.frequency, r.duration),
            prescribedQuantity: r.quantity || calculatePrescriptionQuantity(r.dosage, r.frequency, r.duration),
            route: r.route || '',
            intake: r.route || '',
            instructions: r.instructions || '',
            prescriptionDate: pDate,
            doctor: r.doctor || 'Attending Physician',
            counter: r.counter,
            token: r.token,
            status: r.status,
            badgeClass: r.badge_class,
            isCollected: !!r.is_collected
          })
        };
      }));
    }
    if (type === 'tests') {
      const [rows] = await pool.query(
        `SELECT * FROM lab_reports 
         WHERE admission_id = ? 
           AND NOT (LOWER(category) = 'radiology' OR LOWER(title) REGEXP 'x-ray|ct scan|mri|ultrasound')`,
        [admissionId]
      );
      return res.json(rows.map(r => ({
        id: r.id,
        resourceType: 'tests',
        payload: JSON.stringify({
          reportId: r.id,
          admissionId: r.admission_id,
          patientId: r.patient_id,
          title: r.title,
          department: r.category,
          status: r.status,
          notes: r.notes
        })
      })));
    }
    if (type === 'scans') {
      const [rows] = await pool.query(
        `SELECT * FROM lab_reports 
         WHERE admission_id = ? 
           AND (LOWER(category) = 'radiology' OR LOWER(title) REGEXP 'x-ray|ct scan|mri|ultrasound')`,
        [admissionId]
      );
      return res.json(rows.map(r => ({
        id: r.id,
        resourceType: 'scans',
        payload: JSON.stringify({
          reportId: r.id,
          admissionId: r.admission_id,
          patientId: r.patient_id,
          title: r.title,
          department: r.category,
          status: r.status,
          notes: r.notes
        })
      })));
    }
    if (type === 'pharmacy') {
      const [rows] = await pool.query('SELECT * FROM pharmacy_transactions WHERE admission_id = ?', [admissionId]);
      return res.json(rows.map(r => ({
        id: r.id,
        resourceType: 'pharmacy',
        payload: JSON.stringify({
          recordId: r.id,
          orderId: r.tx_id,
          admissionId: r.admission_id,
          patientId: r.patient_id,
          prescriptionId: r.prescription_id,
          medicine: r.medicine_name,
          quantity: r.quantity,
          price: r.total_amount,
          orderDate: r.created_at,
          orderStatus: 'COMPLETED',
          pickupStatus: r.dispensed_by ? 'COLLECTED' : 'READY',
          paymentStatus: r.payment_status,
          pickupLocation: r.pickup_counter,
          pickupToken: r.pickup_token
        })
      })));
    }
    res.json([]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const handleAdmissionRecordsPost = async (req, res) => {
  try {
    const { admissionId, recordId: routeRecordId } = req.params;
    const { resourceType, payload } = req.body;
    const parsed = typeof payload === 'string' ? JSON.parse(payload) : (payload || {});

    const [adm] = await pool.query('SELECT patient_id FROM admissions WHERE admission_id = ?', [admissionId]);
    const patientId = adm[0]?.patient_id || 'UNKNOWN';

    if (resourceType === 'prescriptions') {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        let targetId = routeRecordId || parsed.recordId || parsed.id;
        let isExisting = false;

        if (targetId) {
          const [exists] = await conn.query('SELECT id, admission_id FROM prescriptions WHERE id = ?', [targetId]);
          if (exists.length > 0) isExisting = true;
        }
        if (!isExisting && parsed.prescriptionId) {
          const [exists] = await conn.query('SELECT id, admission_id FROM prescriptions WHERE id = ?', [parsed.prescriptionId]);
          if (exists.length > 0) {
            targetId = parsed.prescriptionId;
            isExisting = true;
          }
        }

        const doctor = parsed.doctor || 'Attending Physician';
        const prescriptionDate = parsed.prescriptionDate || new Date().toISOString().slice(0, 10);
        const counter = parsed.counter || 'Ground Floor Counter 3';
        const token = parsed.token || ('PH-' + Math.floor(1000 + Math.random() * 9000));
        const status = parsed.status || 'Ready for Collection';
        const badgeClass = parsed.badgeClass || 'badge-warning';

        // Check if multiple medicines were submitted together
        if (Array.isArray(parsed.medicines) && parsed.medicines.length > 0) {
          const prescriptionId = await generateStructuredPrescriptionId(conn, admissionId);
          for (let i = 0; i < parsed.medicines.length; i++) {
            const med = parsed.medicines[i];
            const medName = med.name || med.medicineName || 'Prescribed Medicine';
            const medDosage = med.dosage ? `${med.dosage} ${med.dosageUnit || med.unit || ''}`.trim() : (med.dosageAmount ? `${med.dosageAmount} ${med.dosageUnit || ''}`.trim() : '1 dose');
            const medFreq = med.frequency || 'Once daily';
            const medDur = med.duration ? (med.durationCount ? `${med.durationCount} ${med.durationUnit || 'Days'}`.trim() : med.duration) : '5 Days';
            const medRoute = med.route || med.intake || 'Oral';
            const medInstructions = med.instructions || '';
            const qty = med.quantity || calculatePrescriptionQuantity(medDosage, medFreq, medDur);
            const rowId = parsed.medicines.length === 1 ? prescriptionId : `${prescriptionId}-${i + 1}`;

            await conn.query(
              `INSERT INTO prescriptions (id, group_id, admission_id, patient_id, name, dosage, frequency, duration, quantity, route, instructions, prescription_date, doctor, counter, token, status, badge_class, payment_status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNPAID')
               ON DUPLICATE KEY UPDATE 
                 name=VALUES(name), 
                 dosage=VALUES(dosage), 
                 frequency=VALUES(frequency), 
                 duration=VALUES(duration), 
                 quantity=VALUES(quantity),
                 route=VALUES(route), 
                 instructions=VALUES(instructions),
                 prescription_date=VALUES(prescription_date),
                 doctor=VALUES(doctor)`,
              [rowId, prescriptionId, admissionId, patientId, medName, medDosage, medFreq, medDur, qty, medRoute, medInstructions, prescriptionDate, doctor, counter, token, status, badgeClass]
            );
          }

          await conn.commit();

          const responsePayload = {
            recordId: prescriptionId,
            prescriptionId,
            groupId: prescriptionId,
            admissionId,
            patientId,
            medicines: parsed.medicines,
            doctor,
            prescriptionDate,
            counter,
            token,
            status,
            badgeClass,
            isCollected: false
          };
          return res.json({ id: prescriptionId, resourceType, payload: JSON.stringify(responsePayload) });
        }

        // Single medicine fallback
        const medName = parsed.medicineName || parsed.name || 'Prescribed Medicine';
        let prescriptionId;

        if (!isExisting) {
          const [dupRx] = await conn.query(
            'SELECT id FROM prescriptions WHERE admission_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) AND is_collected = 0 LIMIT 1',
            [admissionId, medName]
          );
          if (dupRx.length > 0) {
            targetId = dupRx[0].id;
            prescriptionId = targetId;
            isExisting = true;
          }
        }

        if (isExisting) {
          prescriptionId = targetId;
        } else {
          prescriptionId = await generateStructuredPrescriptionId(conn, admissionId);
        }
        const dosage = parsed.dosage || '';
        const frequency = parsed.frequency || '';
        const duration = parsed.duration || '5 Days';
        const route = parsed.route || parsed.intake || 'Oral';
        const instructions = parsed.instructions || '';
        const qty = parsed.quantity || calculatePrescriptionQuantity(dosage, frequency, duration);

        await conn.query(
          `INSERT INTO prescriptions (id, group_id, admission_id, patient_id, name, dosage, frequency, duration, quantity, route, instructions, prescription_date, doctor, counter, token, status, badge_class, payment_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNPAID')
           ON DUPLICATE KEY UPDATE 
             name=VALUES(name), 
             dosage=VALUES(dosage), 
             frequency=VALUES(frequency), 
             duration=VALUES(duration), 
             quantity=VALUES(quantity),
             route=VALUES(route), 
             instructions=VALUES(instructions),
             prescription_date=VALUES(prescription_date),
             doctor=VALUES(doctor)`,
          [prescriptionId, prescriptionId, admissionId, patientId, medName, dosage, frequency, duration, qty, route, instructions, prescriptionDate, doctor, counter, token, status, badgeClass]
        );

        await conn.commit();

        const responsePayload = {
          recordId: prescriptionId,
          prescriptionId,
          groupId: prescriptionId,
          admissionId,
          patientId,
          medicineName: medName,
          name: medName,
          dosage,
          frequency,
          duration,
          quantity: qty,
          prescribedQuantity: qty,
          route,
          intake: route,
          instructions,
          prescriptionDate,
          doctor,
          counter,
          token,
          status,
          badgeClass,
          isCollected: false
        };

        return res.json({ id: prescriptionId, resourceType, payload: JSON.stringify(responsePayload) });
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    }

    if (resourceType === 'schedule') {
      const docName = parsed.doctor || parsed.doctorName || 'Attending Physician';
      const apptDate = parsed.eventDate || parsed.appointmentDate;
      const apptTime = parsed.appointmentTime;
      const apptType = parsed.appointmentType || 'Consultation';

      // 1. Validate active admission
      const [admRows] = await pool.query(
        "SELECT admission_id, patient_id, admitting_dept, current_dept, room_number, status FROM admissions WHERE admission_id = ?",
        [admissionId]
      );
      if (admRows.length === 0) {
        return res.status(404).json({ error: `Admission "${admissionId}" not found.` });
      }
      const adm = admRows[0];
      if (adm.status !== 'ADMITTED' && adm.status !== 'ACTIVE') {
        return res.status(400).json({ error: `Admission "${admissionId}" is discharged. Appointments can only be scheduled for active admissions.` });
      }

      const patientDept = adm.current_dept || adm.admitting_dept || 'General';
      const patientRoom = adm.room_number || 'General Ward';

      // 2. Validate doctor compatibility
      if (!isDoctorCompatibleWithDepartment(docName, patientDept)) {
        return res.status(400).json({
          error: `Doctor "${docName}" does not belong to patient department "${patientDept}".`,
          code: 'INCOMPATIBLE_DOCTOR_DEPARTMENT'
        });
      }

      // 3. Validate appointment date within 14 days
      const dateVal = validateAppointmentDate(apptDate);
      if (!dateVal.valid) {
        return res.status(400).json({ error: dateVal.error });
      }
      const validDate = dateVal.date;

      // Parse optional assigned lab reports
      const rawAssigned = parsed.assignedLabReports !== undefined ? parsed.assignedLabReports : parsed.assignedInvestigations;
      let assignedList = [];
      if (Array.isArray(rawAssigned)) {
        assignedList = rawAssigned.map(s => String(s).trim()).filter(Boolean);
      } else if (rawAssigned && typeof rawAssigned === 'string') {
        try {
          const parsedArr = JSON.parse(rawAssigned);
          if (Array.isArray(parsedArr)) assignedList = parsedArr.map(s => String(s).trim()).filter(Boolean);
          else assignedList = [rawAssigned.trim()];
        } catch (_) {
          assignedList = rawAssigned.split(',').map(s => s.trim()).filter(Boolean);
        }
      }
      const assignedStr = assignedList.join(', ');

      // Deduplicate: check if appointment already exists for this admission, doctor, date, and time
      const [existingAppt] = await pool.query(
        `SELECT id FROM doctor_appointments 
         WHERE admission_id = ? AND doctor_name = ? AND appointment_date = ? AND appointment_time = ?`,
        [admissionId, docName, validDate, apptTime]
      );
      if (existingAppt.length > 0) {
        await pool.query(
          `UPDATE doctor_appointments SET department = ?, appointment_type = ?, room = ?, assigned_lab_reports = COALESCE(NULLIF(?, ''), assigned_lab_reports), status = 'SCHEDULED' WHERE id = ?`,
          [patientDept, apptType, patientRoom, assignedStr, existingAppt[0].id]
        );
        for (const invName of assignedList) {
          const [existingAssigned] = await pool.query(
            "SELECT id FROM lab_assignments WHERE admission_id = ? AND LOWER(TRIM(investigation_name)) = LOWER(TRIM(?)) AND status = 'ASSIGNED'",
            [admissionId, invName]
          );
          if (existingAssigned.length === 0) {
            const cat = getInvestigationCategory(invName);
            await pool.query(
              "INSERT INTO lab_assignments (admission_id, patient_id, investigation_name, category, status, assigned_by, appointment_id) VALUES (?, ?, ?, ?, 'ASSIGNED', 'Duty Nurse', ?)",
              [admissionId, adm.patient_id, invName, cat, existingAppt[0].id]
            );
          }
        }
        return res.json({ id: existingAppt[0].id, resourceType, payload: JSON.stringify({ ...parsed, recordId: existingAppt[0].id, admissionId, patientId: adm.patient_id, room: patientRoom, status: 'SCHEDULED', assignedLabReports: assignedStr }) });
      }

      const [result] = await pool.query(
        `INSERT INTO doctor_appointments (admission_id, patient_id, doctor_name, department, appointment_date, appointment_time, appointment_type, room, status, scheduled_by, assigned_lab_reports)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SCHEDULED', 'Duty Nurse', ?)`,
        [admissionId, adm.patient_id, docName, patientDept, validDate, apptTime, apptType, patientRoom, assignedStr]
      );

      for (const invName of assignedList) {
        const [existingAssigned] = await pool.query(
          "SELECT id FROM lab_assignments WHERE admission_id = ? AND LOWER(TRIM(investigation_name)) = LOWER(TRIM(?)) AND status = 'ASSIGNED'",
          [admissionId, invName]
        );
        if (existingAssigned.length === 0) {
          const cat = getInvestigationCategory(invName);
          await pool.query(
            "INSERT INTO lab_assignments (admission_id, patient_id, investigation_name, category, status, assigned_by, appointment_id) VALUES (?, ?, ?, ?, 'ASSIGNED', 'Duty Nurse', ?)",
            [admissionId, adm.patient_id, invName, cat, result.insertId]
          );
        }
      }

      return res.json({ id: result.insertId, resourceType, payload: JSON.stringify({ ...parsed, recordId: result.insertId, admissionId, patientId: adm.patient_id, room: patientRoom, status: 'SCHEDULED', assignedLabReports: assignedStr }) });
    }

    if (resourceType === 'tests' || resourceType === 'scans') {
      const title = (parsed.title || '').trim();
      if (!title) {
        return res.status(400).json({ error: 'Investigation title / report name is required.' });
      }

      // 1. Validate active admission
      const [admRows] = await pool.query(
        "SELECT admission_id, patient_id, status FROM admissions WHERE admission_id = ?",
        [admissionId]
      );
      if (admRows.length === 0) {
        return res.status(404).json({ error: `Admission "${admissionId}" not found.` });
      }
      const adm = admRows[0];
      if (adm.status !== 'ADMITTED' && adm.status !== 'ACTIVE') {
        return res.status(400).json({ error: `Admission "${admissionId}" is discharged. Lab reports can only be uploaded for active admissions.` });
      }

      const effectivePatientId = adm.patient_id;
      if (patientId && patientId !== effectivePatientId) {
        return res.status(400).json({
          error: `Patient ID "${patientId}" does not match active admission "${admissionId}".`,
          code: 'PATIENT_ADMISSION_MISMATCH'
        });
      }

      // 2. Req 5: Backend validation: Selected Patient -> Active Admission -> Assigned Investigation belongs to that Patient + Admission
      const [assignedRows] = await pool.query(
        `SELECT id, category, status FROM lab_assignments 
         WHERE admission_id = ? 
           AND patient_id = ?
           AND LOWER(TRIM(investigation_name)) = LOWER(TRIM(?))
         ORDER BY id DESC LIMIT 1`,
        [admissionId, effectivePatientId, title]
      );

      if (assignedRows.length === 0) {
        return res.status(400).json({
          error: `Investigation "${title}" is not assigned to patient "${effectivePatientId}" (admission "${admissionId}"). Upload rejected. Only investigations assigned to this active admission can be uploaded.`,
          code: 'UNASSIGNED_INVESTIGATION'
        });
      }

      const assignRow = assignedRows[0];
      const [existingLab] = await pool.query(
        `SELECT id FROM lab_reports WHERE admission_id = ? AND LOWER(TRIM(title)) = LOWER(TRIM(?)) LIMIT 1`,
        [admissionId, title]
      );
      const id = (existingLab.length > 0) ? existingLab[0].id : (parsed.reportId || ('LAB-' + Date.now()));
      const fileUrl = parsed.fileUrl || parsed.file_url || null;
      const fileName = parsed.fileName || parsed.file_name || null;
      await pool.query(
        `INSERT INTO lab_reports (id, admission_id, patient_id, title, category, status, badge_class, notes, file_url, file_name)
         VALUES (?, ?, ?, ?, ?, ?, 'badge-success', ?, ?, ?)
         ON DUPLICATE KEY UPDATE title=VALUES(title), category=VALUES(category), status=VALUES(status), notes=VALUES(notes), file_url=VALUES(file_url), file_name=VALUES(file_name)`,
        [id, admissionId, effectivePatientId, title, parsed.department || parsed.testType || assignRow.category || 'Pathology', parsed.status || 'Normal', parsed.notes || '', fileUrl, fileName]
      );

      // Req 7: Track whether an assigned investigation is Assigned -> Report Uploaded / Completed
      await pool.query(
        "UPDATE lab_assignments SET status = 'COMPLETED', report_id = ? WHERE id = ?",
        [id, assignRow.id]
      );

      return res.json({ id, resourceType, payload: JSON.stringify({ ...parsed, reportId: id, admissionId, patientId: effectivePatientId, fileUrl, fileName }) });
    }

    res.json({ success: true });
  } catch (err) {
    if (req.body?.resourceType === 'tests' || req.body?.resourceType === 'scans') {
      const { admissionId } = req.params;
      const parsed = typeof req.body.payload === 'string' ? JSON.parse(req.body.payload) : (req.body.payload || {});
      const title = (parsed.title || '').trim();
      const id = parsed.reportId || ('LAB-' + Date.now());
      const fileUrl = parsed.fileUrl || parsed.file_url || null;
      const fileName = parsed.fileName || parsed.file_name || null;
      const patientId = parsed.patientId || '26PAT0001';

      memoryFallbackDb.labReports = memoryFallbackDb.labReports || [];
      const newReport = {
        id,
        admissionId,
        patientId,
        title,
        category: parsed.department || parsed.testType || 'Pathology',
        status: parsed.status || 'Completed',
        badgeClass: 'badge-success',
        notes: parsed.notes || `Diagnostic Lab Report: ${title}`,
        fileUrl,
        fileName
      };
      memoryFallbackDb.labReports.push(newReport);

      if (memoryFallbackDb.labAssignments) {
        const found = memoryFallbackDb.labAssignments.find(a => a.admissionId === admissionId && a.investigationName.toLowerCase() === title.toLowerCase());
        if (found) {
          found.status = 'COMPLETED';
          found.reportId = id;
        }
      }

      return res.json({ id, resourceType: req.body.resourceType, payload: JSON.stringify({ ...parsed, reportId: id, admissionId, patientId, fileUrl, fileName }) });
    }
    res.status(500).json({ error: err.message });
  }
};

app.post('/api/v1/admissions/:admissionId/records', handleAdmissionRecordsPost);
app.post('/api/v1/admissions/:admissionId/records/:recordId', handleAdmissionRecordsPost);

// Discharge admission handler (supports both POST and PUT for /api/v1 and /api/hms)
const handleAdmissionDischarge = async (req, res) => {
  try {
    const { admissionId } = req.params;
    const dischargeSummary = req.body?.fileUrl || req.body?.dischargeSummary || req.body?.summary || 'Patient discharged in stable condition.';

    const [rows] = await pool.query('SELECT admission_id, patient_id, room_number, status FROM admissions WHERE admission_id = ?', [admissionId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: `Admission ${admissionId} not found.` });
    }

    await pool.query(
      `UPDATE admissions SET status = 'DISCHARGED', discharge_summary = ?, discharge_date = CURDATE() WHERE admission_id = ?`,
      [dischargeSummary, admissionId]
    );
    await pool.query(
      `UPDATE patients SET status = 'DISCHARGED' WHERE admission_id = ?`,
      [admissionId]
    );

    res.json({
      success: true,
      admissionId,
      status: 'DISCHARGED',
      message: `Admission ${admissionId} discharged successfully. Room/bed released.`,
      snapshot: await buildSnapshot()
    });
  } catch (err) {
    console.error('Discharge error:', err);
    res.status(500).json({ error: err.message });
  }
};

app.post('/api/v1/admissions/:admissionId/discharge', handleAdmissionDischarge);
app.put('/api/v1/admissions/:admissionId/discharge', handleAdmissionDischarge);
app.post('/api/hms/admissions/:admissionId/discharge', handleAdmissionDischarge);
app.put('/api/hms/admissions/:admissionId/discharge', handleAdmissionDischarge);

// Toggle prescription payment status (Paid / Not Paid)
app.put('/api/hms/prescriptions/:id/payment', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const { paymentStatus } = req.body;
    const newStatus = (paymentStatus === 'PAID' || paymentStatus === 'Paid') ? 'PAID' : 'UNPAID';

    await conn.beginTransaction();
    await conn.query(
      'UPDATE prescriptions SET payment_status = ? WHERE id = ? OR group_id = ?',
      [newStatus, id, id]
    );
    await conn.commit();

    res.json({
      success: true,
      id,
      paymentStatus: newStatus,
      snapshot: await buildSnapshot()
    });
  } catch (err) {
    await conn.rollback();
    console.error('Prescription payment update error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// ---------------------------------------------------------------
// CareBridge Mobile App: Billing & Payments Endpoints
// ---------------------------------------------------------------
app.get('/api/v1/admissions/:admissionId/billing', async (req, res) => {
  try {
    const { admissionId } = req.params;

    // Check admission status
    const [adms] = await pool.query(
      'SELECT status FROM admissions WHERE admission_id = ?',
      [admissionId]
    );
    const isReadOnly = adms.length > 0 && adms[0].status === 'DISCHARGED';

    // Fetch billing summary
    const [billingRows] = await pool.query(
      'SELECT * FROM billing_summary WHERE admission_id = ? LIMIT 1',
      [admissionId]
    );

    // Fetch bill items
    const [itemsRows] = await pool.query(
      'SELECT * FROM bill_items WHERE admission_id = ? ORDER BY id ASC',
      [admissionId]
    );

    // Fetch payments
    const [paymentsRows] = await pool.query(
      'SELECT * FROM payments WHERE admission_id = ? ORDER BY id DESC',
      [admissionId]
    );

    if (billingRows.length === 0 && itemsRows.length === 0 && adms.length === 0) {
      return res.status(204).end();
    }

    const items = itemsRows.map(r => ({
      desc: r.description,
      category: r.category,
      amount: Number(r.amount) || 0,
    }));

    const payments = paymentsRows.map(p => ({
      txId: p.tx_id,
      date: p.date_label,
      method: p.method,
      amount: Number(p.amount) || 0,
      status: p.status,
    }));

    const paidAmount = payments
      .filter(p => {
        const s = (p.status || '').toLowerCase();
        return s === 'paid' || s === 'success';
      })
      .reduce((sum, p) => sum + p.amount, 0);

    let totalBill = 0;
    let insuranceCovered = 0;
    let claimStatus = 'Approved';
    let balance = 0;

    if (billingRows.length > 0) {
      const b = billingRows[0];
      totalBill = Number(b.total_bill) || 0;
      insuranceCovered = Number(b.insurance_covered) || 0;
      claimStatus = b.claim_status || 'Approved';
      balance = Math.max(0, Number(b.remaining_payable != null ? b.remaining_payable : (totalBill - insuranceCovered - paidAmount)));
    } else {
      totalBill = items.reduce((sum, i) => sum + i.amount, 0);
      insuranceCovered = 0;
      claimStatus = 'Pending';
      balance = Math.max(0, totalBill - paidAmount);
    }

    res.json({
      admissionId,
      items,
      totalBill,
      insuranceCovered,
      paidAmount,
      balance,
      claimStatus,
      payments,
      isReadOnly,
      recordId: billingRows[0]?.id || null,
    });
  } catch (err) {
    console.error('Error fetching billing:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/v1/admissions/:admissionId/billing/payments', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { admissionId } = req.params;
    const { method = 'UPI', amount = 0 } = req.body || {};

    const [adms] = await conn.query(
      'SELECT status FROM admissions WHERE admission_id = ?',
      [admissionId]
    );
    if (adms.length > 0 && adms[0].status === 'DISCHARGED') {
      return res.status(409).json({ error: 'Discharged admissions are read-only' });
    }

    const numAmount = Number(amount) || 0;
    const txId = 'TXN-' + Math.floor(100000 + Math.random() * 900000);
    const now = new Date();
    const dateLabel = now.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO payments (tx_id, admission_id, date_label, method, amount, status)
       VALUES (?, ?, ?, ?, ?, 'Paid')`,
      [txId, admissionId, dateLabel, method, numAmount]
    );

    await conn.query(
      `UPDATE billing_summary 
       SET remaining_payable = GREATEST(0, remaining_payable - ?) 
       WHERE admission_id = ?`,
      [numAmount, admissionId]
    );

    await conn.commit();

    res.json({
      txId,
      date: dateLabel,
      method,
      amount: numAmount,
      status: 'Paid',
    });
  } catch (err) {
    await conn.rollback();
    console.error('Error recording payment:', err);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// Notifications fallback endpoints
app.get('/api/v1/admissions/:admissionId/notifications', (req, res) => {
  res.json([]);
});

app.post('/api/v1/notifications/:notificationId/read', (req, res) => {
  res.json({ success: true });
});


// Itemized billing charges endpoint with Authoritative Tariff Validation for ALL Categories
app.post('/api/hms/billing/items', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { admissionId, description, category, amount } = req.body;
    if (!admissionId || !category) {
      return res.status(400).json({ error: 'Admission ID and category are required.' });
    }

    // Resolve authoritative category charge from DB configuration
    const chargeInfo = await resolveAuthoritativeCategoryCharge(conn, admissionId, category, description);
    if (!chargeInfo || chargeInfo.found === false) {
      return res.status(404).json({ error: chargeInfo?.error || `Admission "${admissionId}" not found.` });
    }

    if (!chargeInfo.configured) {
      if (category === 'Room Rent') {
        return res.status(400).json({
          error: chargeInfo.error,
          code: 'ROOM_TARIFF_NOT_CONFIGURED',
          currentRoom: chargeInfo.currentRoom
        });
      }
      return res.status(400).json({
        error: chargeInfo.error,
        code: chargeInfo.code || 'CATEGORY_TARIFF_NOT_CONFIGURED',
        category
      });
    }

    // Server-side authoritative tariff rate is enforced (tamper-proof)
    const finalCharge = Number(chargeInfo.amount);
    let finalDescription = (description || '').trim();

    if (category === 'Room Rent') {
      if (!finalDescription || finalDescription.toLowerCase() === 'room rent') {
        finalDescription = chargeInfo.description;
      }
    } else {
      if (!finalDescription || finalDescription.toLowerCase() === category.toLowerCase()) {
        finalDescription = chargeInfo.description;
      }
    }

    await conn.beginTransaction();

    // Deduplicate: check if an identical charge item already exists for this admission
    const [existingItem] = await conn.query(
      `SELECT id FROM bill_items WHERE admission_id = ? AND description = ? AND amount = ?`,
      [admissionId, finalDescription, finalCharge]
    );
    if (existingItem.length > 0) {
      await conn.rollback();
      return res.status(409).json({
        error: `Duplicate billing item: "${finalDescription}" with amount ₹${finalCharge} already exists for admission ${admissionId}.`,
        code: 'DUPLICATE_BILLING_ITEM'
      });
    }

    await conn.query(
      `INSERT INTO bill_items (admission_id, description, category, amount) VALUES (?, ?, ?, ?)`,
      [admissionId, finalDescription, category, finalCharge]
    );
    await conn.query(
      `INSERT INTO billing_summary (admission_id, total_bill, insurance_covered, remaining_payable, claim_status)
       VALUES (?, ?, 0, ?, 'Pending')
       ON DUPLICATE KEY UPDATE total_bill = total_bill + VALUES(total_bill),
                               remaining_payable = remaining_payable + VALUES(remaining_payable)`,
      [admissionId, finalCharge, finalCharge]
    );
    await conn.commit();
    res.json({
      success: true,
      admissionId,
      description: finalDescription,
      category,
      amount: finalCharge,
      snapshot: await buildSnapshot()
    });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.json({ status: 'ok', database: 'fallback-ready', warning: err.message });
  }
});

// Start API server on port 8080
app.listen(8080, '0.0.0.0', () => {
  console.log('====================================================');
  console.log('CareBridge / HMS Shared MySQL REST API Server');
  console.log('Port 8080: API endpoints (internal)');
  console.log('  Health: http://localhost:8080/api/health');
  console.log('  Data: http://localhost:8080/api/hms/data');
  console.log('====================================================');
});

// Create HMS portal server on port 8085
const hmsApp = express();
hmsApp.use(cors());
hmsApp.use(express.json({ limit: '25mb' }));
hmsApp.use(express.urlencoded({ extended: true, limit: '25mb' }));
hmsApp.get('/', (req, res) => {
  res.redirect('/login.html');
});
hmsApp.use(express.static(path.join(__dirname, '..', 'hms_staff_portal'), { maxAge: 0, setHeaders: (res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
}}));
const proxyApiRequest = (req, res) => {
  const url = `http://127.0.0.1:8080${req.originalUrl}`;
  const isBodyAllowed = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase());
  const bodyData = isBodyAllowed && req.body && Object.keys(req.body).length > 0 ? JSON.stringify(req.body) : null;
  const headers = { ...req.headers, host: '127.0.0.1:8080' };
  if (bodyData) {
    headers['content-type'] = 'application/json';
    headers['content-length'] = Buffer.byteLength(bodyData);
  } else {
    delete headers['content-length'];
  }
  const proxyReq = require('http').request(url, { method: req.method, headers }, (apiRes) => {
    res.writeHead(apiRes.statusCode, apiRes.headers);
    apiRes.pipe(res);
  });
  proxyReq.on('error', (err) => {
    res.status(502).json({ error: 'Proxy error', details: err.message });
  });
  if (bodyData) {
    proxyReq.write(bodyData);
  }
  proxyReq.end();
};

// Proxy API calls from HMS to main server
hmsApp.use('/api', proxyApiRequest);
hmsApp.listen(8085, '0.0.0.0', () => {
  console.log('Port 8085: HMS Staff Portal');
  console.log('  Login: http://localhost:8085/login.html');
  console.log('  App:   http://localhost:8085/index.html');
  console.log('====================================================\n');
});

/**
 * CareBridge HMS - Global Admission Store (IPD Context)
 * Provides global access to active admissions, patient details, and room transfer audit logs.
 */
import { useState, useEffect } from 'react';

// Default mock/seed data matching St. Jude HMS hospital records
const INITIAL_ADMISSIONS = [
  {
    admissionId: '26CAR008',
    patientId: '26PAT0001',
    fullName: 'Meenakshi Ravi',
    ageGender: '58 Y / Female',
    admissionDate: '2026-10-18',
    admissionTime: '09:30:00',
    department: 'Cardiology',
    roomNumber: 'Cardio Ward Bed 3',
    attendingDoctor: 'Dr. Aris Thorne (Cardiology)',
    caregiverName: 'Sarah Vance',
    caregiverPhone: '+91 98765 43210',
    status: 'ADMITTED',
    advanceDeposit: 5000.00
  },
  {
    admissionId: '26CAR007',
    patientId: '26PAT0009',
    fullName: 'Kumar Sundaram',
    ageGender: '45 Y / Male',
    admissionDate: '2026-10-19',
    admissionTime: '11:15:00',
    department: 'Paediatrics',
    roomNumber: 'Semi-Private Room 401',
    attendingDoctor: 'Dr. Anita Rao (Paediatrics)',
    caregiverName: 'Sundaram K',
    caregiverPhone: '+91 98111 22334',
    status: 'ADMITTED',
    advanceDeposit: 8000.00
  },
  {
    admissionId: 'HMS-2026-8842',
    patientId: 'P-100001',
    fullName: 'Eleanor Vance',
    ageGender: '58 Years • Female (A+)',
    admissionDate: '2026-08-30',
    admissionTime: '09:42:00',
    department: 'Cardiology',
    roomNumber: 'ICU Room 304',
    attendingDoctor: 'Dr. Aris Thorne (Cardiology)',
    caregiverName: 'Sarah Vance',
    caregiverPhone: '+91 98765 43210',
    status: 'ADMITTED',
    advanceDeposit: 10000.00
  }
];

// Room Transfer Audit Logs (Reception IPD transfer history)
const INITIAL_ROOM_TRANSFERS = [
  {
    id: 1,
    admissionId: '26CAR008',
    patientId: '26PAT0001',
    fromDept: 'Emergency',
    toDept: 'Cardiology',
    fromRoom: 'ICU Room 304',
    toRoom: 'Cardio Ward Bed 3',
    attendingDoctor: 'Dr. Aris Thorne (Cardiology)',
    transferReason: 'Post-stabilization clinical transfer from ICU to step-down ward bed',
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
    transferReason: 'Step-down to semi-private room on patient recovery request',
    transferredBy: 'Reception Desk',
    transferDate: '2026-10-21 14:15:00'
  },
  {
    id: 3,
    admissionId: 'HMS-2026-8842',
    patientId: 'P-100001',
    fromDept: 'Cardiology',
    toDept: 'Cardiology',
    fromRoom: 'Emergency Bay 1',
    toRoom: 'ICU Room 304',
    attendingDoctor: 'Dr. Aris Thorne (Cardiology)',
    transferReason: 'Immediate post-op ICU monitoring',
    transferredBy: 'Clara Sterling (Head Nurse)',
    transferDate: '2026-08-31 16:00:00'
  }
];

// Room Tariff Standard Rates
export const ROOM_TARIFF_RATES = {
  ICU: { tier: 'ICU Tier', rate: 12000.00 },
  DELUXE: { tier: 'Deluxe Room Tier', rate: 5500.00 },
  PRIVATE: { tier: 'Private Room Tier', rate: 3500.00 },
  'SEMI-PRIVATE': { tier: 'Semi-Private Tier', rate: 2200.00 },
  WARD: { tier: 'General Ward Tier', rate: 1200.00 }
};

export function getRoomDailyRate(roomName = '') {
  const clean = String(roomName).toUpperCase();
  if (clean.includes('ICU') || clean.includes('CRITICAL')) return ROOM_TARIFF_RATES.ICU;
  if (clean.includes('DELUXE') || clean.includes('SUITE')) return ROOM_TARIFF_RATES.DELUXE;
  if (clean.includes('SEMI-PRIVATE')) return ROOM_TARIFF_RATES['SEMI-PRIVATE'];
  if (clean.includes('PRIVATE')) return ROOM_TARIFF_RATES.PRIVATE;
  return ROOM_TARIFF_RATES.WARD;
}

/**
 * useAdmissionStore Hook
 */
export function useAdmissionStore() {
  const [admissions, setAdmissions] = useState(INITIAL_ADMISSIONS);
  const [roomTransfers, setRoomTransfers] = useState(INITIAL_ROOM_TRANSFERS);
  const [selectedAdmissionId, setSelectedAdmissionId] = useState(INITIAL_ADMISSIONS[0].admissionId);

  // Active admission context
  const activeAdmission = admissions.find(a => a.admissionId === selectedAdmissionId) || admissions[0];

  // Room transfer audit logs for active admission
  const activeTransferLogs = roomTransfers.filter(
    t => t.admissionId === activeAdmission.admissionId || t.patientId === activeAdmission.patientId
  );

  return {
    admissions,
    activeAdmission,
    selectedAdmissionId,
    setSelectedAdmissionId,
    roomTransfers,
    activeTransferLogs,
    getTransferLogsForAdmission: (admId) => roomTransfers.filter(t => t.admissionId === admId),
    setRoomTransfers
  };
}

export default useAdmissionStore;

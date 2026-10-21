-- ====================================================================
-- St. Jude HMS & CareBridge — Shared MySQL Database
-- One database, read/written by BOTH the HMS Staff Web Portal and the
-- CareBridge Caregiver Mobile App, through the shared Node/Express API.
-- Run this once in MySQL Workbench / phpMyAdmin / mysql CLI before
-- starting the backend.
-- ====================================================================

CREATE DATABASE IF NOT EXISTS carebridge_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE carebridge_db;

ALTER DATABASE carebridge_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS bill_items;
DROP TABLE IF EXISTS billing_summary;
DROP TABLE IF EXISTS prescriptions;
DROP TABLE IF EXISTS lab_reports;
DROP TABLE IF EXISTS treatments;
DROP TABLE IF EXISTS patients;

-- 1. Patients (also carries the bound primary caregiver's details)
CREATE TABLE patients (
    admission_id               VARCHAR(64) PRIMARY KEY,
    patient_id                 VARCHAR(64) NOT NULL,
    full_name                  VARCHAR(128) NOT NULL,
    age_gender                 VARCHAR(64) NOT NULL,
    patient_phone              VARCHAR(32) NOT NULL,
    room_number                VARCHAR(64) NOT NULL,
    attending_doctor           VARCHAR(128) NOT NULL,
    status                     VARCHAR(32) NOT NULL DEFAULT 'ADMITTED',
    caregiver_name             VARCHAR(128) NOT NULL,
    caregiver_id               VARCHAR(64) NOT NULL,
    caregiver_phone            VARCHAR(32) NOT NULL,
    relation                   VARCHAR(64) NOT NULL DEFAULT 'Primary Caregiver',
    admission_type             VARCHAR(32) NOT NULL DEFAULT 'Emergency',
    reason_for_admission       VARCHAR(255) NOT NULL DEFAULT '',
    emergency_contact_name     VARCHAR(128) NOT NULL DEFAULT '',
    emergency_contact_phone    VARCHAR(32) NOT NULL DEFAULT '',
    emergency_contact_relation VARCHAR(64) NOT NULL DEFAULT 'Other',
    carebridge_status          VARCHAR(32) NOT NULL DEFAULT 'Active',
    carebridge_access          VARCHAR(32) NOT NULL DEFAULT 'Active',
    admission_date             DATE DEFAULT NULL,
    admission_time             TIME DEFAULT NULL,
    created_at                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Doctor ward-round notes / treatment updates
CREATE TABLE treatments (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    admission_id  VARCHAR(64) NOT NULL,
    doctor_name   VARCHAR(128) NOT NULL,
    dept          VARCHAR(128) NOT NULL,
    date_label    VARCHAR(64) NOT NULL,
    note          TEXT NOT NULL,
    vitals        VARCHAR(255) NOT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admission_id) REFERENCES patients(admission_id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Laboratory / diagnostic reports
CREATE TABLE lab_reports (
    id            VARCHAR(64) PRIMARY KEY,
    admission_id  VARCHAR(64) NOT NULL,
    title         VARCHAR(128) NOT NULL,
    category      VARCHAR(64) NOT NULL,
    status        VARCHAR(64) NOT NULL,
    badge_class   VARCHAR(32) NOT NULL,
    notes         TEXT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admission_id) REFERENCES patients(admission_id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3b. Assigned Lab Reports / Required Investigations (Duty Nurse assignment)
CREATE TABLE IF NOT EXISTS lab_assignments (
    id                 INT AUTO_INCREMENT PRIMARY KEY,
    admission_id       VARCHAR(64) NOT NULL,
    patient_id         VARCHAR(64) NOT NULL,
    investigation_name VARCHAR(160) NOT NULL,
    category           VARCHAR(64) NOT NULL DEFAULT 'Pathology',
    status             VARCHAR(32) NOT NULL DEFAULT 'ASSIGNED',
    assigned_by        VARCHAR(128) NOT NULL DEFAULT 'Duty Nurse',
    appointment_id     INT NULL,
    report_id          VARCHAR(64) NULL,
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_lab_assign_adm (admission_id),
    INDEX idx_lab_assign_pat (patient_id),
    INDEX idx_lab_assign_status (status),
    FOREIGN KEY (admission_id) REFERENCES patients(admission_id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3c. Doctor Appointments / Visit Schedules
CREATE TABLE IF NOT EXISTS doctor_appointments (
    id                   INT AUTO_INCREMENT PRIMARY KEY,
    admission_id         VARCHAR(64) NOT NULL,
    patient_id           VARCHAR(64) NOT NULL,
    doctor_name          VARCHAR(128) NOT NULL,
    department           VARCHAR(64) NOT NULL,
    appointment_date     DATE NOT NULL,
    appointment_time     VARCHAR(32) NOT NULL,
    appointment_type     VARCHAR(160) NOT NULL DEFAULT 'Regular Physician Visit',
    room                 VARCHAR(64) NULL,
    status               VARCHAR(32) NOT NULL DEFAULT 'SCHEDULED',
    scheduled_by         VARCHAR(128) NOT NULL DEFAULT 'Duty Nurse',
    assigned_lab_reports VARCHAR(255) NULL,
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_doc_app_adm (admission_id),
    INDEX idx_doc_app_date (appointment_date),
    FOREIGN KEY (admission_id) REFERENCES patients(admission_id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Prescriptions / pharmacy dispensing queue
CREATE TABLE prescriptions (
    id            VARCHAR(64) PRIMARY KEY,
    admission_id  VARCHAR(64) NOT NULL,
    name          VARCHAR(128) NOT NULL,
    dosage        VARCHAR(128) NOT NULL,
    duration      VARCHAR(64) NOT NULL,
    counter       VARCHAR(128) NOT NULL,
    token         VARCHAR(32) NOT NULL,
    status        VARCHAR(64) NOT NULL,
    badge_class   VARCHAR(32) NOT NULL,
    instructions  TEXT,
    is_collected  TINYINT(1) NOT NULL DEFAULT 0,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admission_id) REFERENCES patients(admission_id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Billing summary (one row per admission)
CREATE TABLE billing_summary (
    admission_id       VARCHAR(64) PRIMARY KEY,
    total_bill         DECIMAL(12,2) NOT NULL DEFAULT 0,
    insurance_covered  DECIMAL(12,2) NOT NULL DEFAULT 0,
    remaining_payable  DECIMAL(12,2) NOT NULL DEFAULT 0,
    claim_status       VARCHAR(64) NOT NULL DEFAULT 'Pending',
    FOREIGN KEY (admission_id) REFERENCES patients(admission_id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Itemized hospital charges
CREATE TABLE bill_items (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    admission_id  VARCHAR(64) NOT NULL,
    description   VARCHAR(255) NOT NULL,
    category      VARCHAR(64) NOT NULL,
    amount        DECIMAL(12,2) NOT NULL,
    FOREIGN KEY (admission_id) REFERENCES patients(admission_id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Caregiver payments
CREATE TABLE payments (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    tx_id         VARCHAR(64) NOT NULL,
    admission_id  VARCHAR(64) NOT NULL,
    date_label    VARCHAR(64) NOT NULL,
    method        VARCHAR(64) NOT NULL,
    amount        DECIMAL(12,2) NOT NULL,
    status        VARCHAR(32) NOT NULL DEFAULT 'Paid',
    FOREIGN KEY (admission_id) REFERENCES patients(admission_id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---- Seed data: Eleanor Vance, Admission HMS-2026-8842 ----
INSERT INTO patients (admission_id, patient_id, full_name, age_gender, patient_phone, room_number, attending_doctor, status, caregiver_name, caregiver_id, caregiver_phone, relation, admission_type, reason_for_admission, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, carebridge_status, carebridge_access, admission_date, admission_time) VALUES
('HMS-2026-8842', 'P-100001', 'Eleanor Vance', '58 Years • Female (A+)', '+91 98111 22334', 'ICU Room 304', 'Dr. Aris Thorne (Cardiology)', 'ADMITTED', 'Sarah Vance', 'CG-991823', '+91 98765 43210', 'Daughter', 'Emergency', 'Post-operative observation and recovery', 'Daniel Vance', '+91 98761 23456', 'Other', 'Active', 'Active', '2026-08-30', '09:42:00');

INSERT INTO treatments (admission_id, doctor_name, dept, date_label, note, vitals) VALUES
('HMS-2026-8842', 'Dr. Aris Thorne', 'Cardiology Dept', 'Today 09:30 AM', 'Patient responding exceptionally well to IV Ceftriaxone. SpO2 stable at 98%. Maintain light liquid diet and monitor blood pressure every 4 hours.', 'BP: 120/80 mmHg | HR: 74 bpm | SpO2: 98% | Temp: 98.6°F'),
('HMS-2026-8842', 'Dr. Elena Rostova', 'Pulmonology Dept', 'Yesterday 06:00 PM', 'Nebulization completed. Patient reported reduced breathlessness. Recommended light walking in corridor.', 'BP: 124/82 mmHg | HR: 78 bpm | SpO2: 97% | Temp: 98.4°F');

INSERT INTO lab_reports (id, admission_id, title, category, status, badge_class, notes) VALUES
('LAB-9921', 'HMS-2026-8842', 'Complete Blood Count (CBC)', 'Pathology', 'Normal', 'badge-success', 'WBC and Platelets within normal limits. Hemoglobin: 13.8 g/dL.'),
('LAB-9925', 'HMS-2026-8842', 'Cardiac Enzymes (Troponin T)', 'Biochemistry', 'Elevated (Monitored)', 'badge-warning', 'Troponin T levels elevated at admission, dropping steadily on day 2.');

INSERT INTO prescriptions (id, admission_id, name, dosage, duration, counter, token, status, badge_class, instructions, is_collected) VALUES
('RX-101', 'HMS-2026-8842', 'Ceftriaxone 1g Injection (IV)', '1g Once Daily (09:00 AM)', '5 Days Pack', 'Ground Floor Counter 3', 'PH-4082', 'Ready for Collection', 'badge-warning', 'Administer slowly via IV line under nursing supervision.', 0),
('RX-102', 'HMS-2026-8842', 'Atorvastatin 20mg Tablet', '1 tablet at bedtime (09:00 PM)', '30 Tablets Pack', 'Ground Floor Counter 3', 'PH-4079', 'Collected by Caregiver', 'badge-success', 'Take after dinner with water.', 1);

INSERT INTO billing_summary (admission_id, total_bill, insurance_covered, remaining_payable, claim_status) VALUES
('HMS-2026-8842', 64500.00, 50000.00, 14500.00, 'Approved');

INSERT INTO bill_items (admission_id, description, category, amount) VALUES
('HMS-2026-8842', 'ICU Room Charges (3 Days @ ₹12,000/day)', 'Room Rent', 36000.00),
('HMS-2026-8842', 'Doctor & Consultant Fee (Cardiology)', 'Consultation', 12000.00),
('HMS-2026-8842', 'Pharmacy & IV Medications', 'Pharmacy', 8500.00),
('HMS-2026-8842', 'Laboratory & CT Diagnostics', 'Diagnostics', 8000.00);

INSERT INTO payments (tx_id, admission_id, date_label, method, amount, status) VALUES
('TXN-991823', 'HMS-2026-8842', '13 Aug 2026', 'UPI (Google Pay)', 10000.00, 'Paid');

USE carebridge_db;

-- Add missing columns to patients table if not present
SET @dbname = DATABASE();
SET @tablename = 'patients';

-- Helper to safely add column if not exists
DROP PROCEDURE IF EXISTS AddColumnIfNotExists;
DELIMITER $$
CREATE PROCEDURE AddColumnIfNotExists(
    IN tableName VARCHAR(64),
    IN colName VARCHAR(64),
    IN colDef VARCHAR(255)
)
BEGIN
    IF NOT EXISTS (
        SELECT * FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = tableName
        AND COLUMN_NAME = colName
    ) THEN
        SET @sql = CONCAT('ALTER TABLE `', tableName, '` ADD COLUMN `', colName, '` ', colDef);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$
DELIMITER ;

CALL AddColumnIfNotExists('patients', 'admission_type', "VARCHAR(32) NOT NULL DEFAULT 'Emergency'");
CALL AddColumnIfNotExists('patients', 'reason_for_admission', "VARCHAR(255) NOT NULL DEFAULT ''");
CALL AddColumnIfNotExists('patients', 'emergency_contact_name', "VARCHAR(128) NOT NULL DEFAULT ''");
CALL AddColumnIfNotExists('patients', 'emergency_contact_phone', "VARCHAR(32) NOT NULL DEFAULT ''");
CALL AddColumnIfNotExists('patients', 'emergency_contact_relation', "VARCHAR(64) NOT NULL DEFAULT 'Other'");
CALL AddColumnIfNotExists('patients', 'carebridge_status', "VARCHAR(32) NOT NULL DEFAULT 'Active'");
CALL AddColumnIfNotExists('patients', 'carebridge_access', "VARCHAR(32) NOT NULL DEFAULT 'Active'");
CALL AddColumnIfNotExists('patients', 'admission_date', "DATE DEFAULT NULL");
CALL AddColumnIfNotExists('patients', 'admission_time', "TIME DEFAULT NULL");

CALL AddColumnIfNotExists('treatments', 'patient_id', "VARCHAR(64) DEFAULT NULL");
CALL AddColumnIfNotExists('lab_reports', 'patient_id', "VARCHAR(64) DEFAULT NULL");
CALL AddColumnIfNotExists('prescriptions', 'patient_id', "VARCHAR(64) DEFAULT NULL");
CALL AddColumnIfNotExists('doctor_appointments', 'assigned_lab_reports', "VARCHAR(255) DEFAULT NULL");

-- 1. Patients Master (Unique Patient Identity)
CREATE TABLE IF NOT EXISTS patients_master (
    patient_id                 VARCHAR(64) PRIMARY KEY,
    full_name                  VARCHAR(128) NOT NULL,
    age_gender                 VARCHAR(64) NOT NULL,
    patient_phone              VARCHAR(32) NOT NULL,
    blood_group                VARCHAR(16) DEFAULT 'Unknown',
    emergency_contact_name     VARCHAR(128) NOT NULL DEFAULT '',
    emergency_contact_phone    VARCHAR(32) NOT NULL DEFAULT '',
    emergency_contact_relation VARCHAR(64) NOT NULL DEFAULT 'Other',
    created_at                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Admissions (Particular Hospital Admission)
CREATE TABLE IF NOT EXISTS admissions (
    admission_id               VARCHAR(64) PRIMARY KEY,
    patient_id                 VARCHAR(64) NOT NULL,
    admitting_dept             VARCHAR(64) NOT NULL DEFAULT 'Cardiology',
    room_number                VARCHAR(64) NOT NULL,
    attending_doctor           VARCHAR(128) NOT NULL,
    status                     VARCHAR(32) NOT NULL DEFAULT 'ADMITTED',
    caregiver_name             VARCHAR(128) NOT NULL,
    caregiver_id               VARCHAR(64) NOT NULL,
    caregiver_phone            VARCHAR(32) NOT NULL,
    relation                   VARCHAR(64) NOT NULL DEFAULT 'Primary Caregiver',
    admission_type             VARCHAR(32) NOT NULL DEFAULT 'Emergency',
    reason_for_admission       VARCHAR(255) NOT NULL DEFAULT '',
    carebridge_status          VARCHAR(32) NOT NULL DEFAULT 'Active',
    carebridge_access          VARCHAR(32) NOT NULL DEFAULT 'Active',
    admission_date             DATE DEFAULT NULL,
    admission_time             TIME DEFAULT NULL,
    discharge_date             DATE DEFAULT NULL,
    discharge_summary          TEXT DEFAULT NULL,
    created_at                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_admission_patient_master FOREIGN KEY (patient_id) REFERENCES patients_master(patient_id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Doctor Appointments (Scheduled by Duty Nurse, visible to Doctor)
CREATE TABLE IF NOT EXISTS doctor_appointments (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    admission_id     VARCHAR(64) NOT NULL,
    patient_id       VARCHAR(64) NOT NULL,
    doctor_name      VARCHAR(128) NOT NULL,
    department       VARCHAR(128) NOT NULL,
    appointment_date DATE NOT NULL,
    appointment_time VARCHAR(32) NOT NULL,
    appointment_type VARCHAR(160) NOT NULL,
    room             VARCHAR(128) DEFAULT '',
    status           VARCHAR(32) NOT NULL DEFAULT 'SCHEDULED',
    assigned_lab_reports VARCHAR(255) DEFAULT NULL,
    scheduled_by     VARCHAR(128) NOT NULL DEFAULT 'Duty Nurse',
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admission_id) REFERENCES patients(admission_id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4b. Assigned Lab Reports / Required Investigations (Duty Nurse assignment)
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

-- 7. Pharmacy Transactions (Dispensing & Emergency Pay Later)
CREATE TABLE IF NOT EXISTS pharmacy_transactions (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    tx_id            VARCHAR(64) NOT NULL UNIQUE,
    admission_id     VARCHAR(64) NOT NULL,
    patient_id       VARCHAR(64) NOT NULL,
    prescription_id  VARCHAR(64) DEFAULT NULL,
    medicine_name    VARCHAR(160) NOT NULL,
    quantity         INT NOT NULL DEFAULT 1,
    unit_price       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_amount     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    transaction_type VARCHAR(32) NOT NULL DEFAULT 'IMMEDIATE',
    payment_status   VARCHAR(32) NOT NULL DEFAULT 'PAID',
    dispensed_by     VARCHAR(128) NOT NULL DEFAULT 'Pharmacy Staff',
    pickup_counter   VARCHAR(64) NOT NULL DEFAULT 'Ground Floor Counter 3',
    pickup_token     VARCHAR(32) NOT NULL DEFAULT '',
    notes            TEXT DEFAULT NULL,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admission_id) REFERENCES patients(admission_id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ID Sequence Tracking Table (Safe concurrent atomic increments)
CREATE TABLE IF NOT EXISTS id_sequences (
    seq_type       VARCHAR(64) NOT NULL,
    seq_prefix     VARCHAR(32) NOT NULL,
    current_value  INT NOT NULL DEFAULT 0,
    PRIMARY KEY (seq_type, seq_prefix)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Clean up helper procedure
DROP PROCEDURE IF EXISTS AddColumnIfNotExists;

-- Seed initial patient & admission if not present
INSERT IGNORE INTO patients_master (patient_id, full_name, age_gender, patient_phone, blood_group, emergency_contact_name, emergency_contact_phone, emergency_contact_relation)
VALUES ('26PAT0001', 'Eleanor Vance', '58 Years • Female (A+)', '+91 98111 22334', 'A+', 'Daniel Vance', '+91 98761 23456', 'Other');

INSERT IGNORE INTO admissions (admission_id, patient_id, admitting_dept, room_number, attending_doctor, status, caregiver_name, caregiver_id, caregiver_phone, relation, admission_type, reason_for_admission, carebridge_status, carebridge_access, admission_date, admission_time)
VALUES ('HMS-2026-8842', '26PAT0001', 'Cardiology', 'ICU Room 304', 'Dr. Aris Thorne (Cardiology)', 'ADMITTED', 'Sarah Vance', 'CG-991823', '+91 98765 43210', 'Daughter', 'Emergency', 'Post-operative observation and recovery', 'Active', 'Active', '2026-08-30', '09:42:00');

INSERT IGNORE INTO patients (admission_id, patient_id, full_name, age_gender, patient_phone, room_number, attending_doctor, status, caregiver_name, caregiver_id, caregiver_phone, relation, admission_type, reason_for_admission, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, carebridge_status, carebridge_access, admission_date, admission_time)
VALUES ('HMS-2026-8842', '26PAT0001', 'Eleanor Vance', '58 Years • Female (A+)', '+91 98111 22334', 'ICU Room 304', 'Dr. Aris Thorne (Cardiology)', 'ADMITTED', 'Sarah Vance', 'CG-991823', '+91 98765 43210', 'Daughter', 'Emergency', 'Post-operative observation and recovery', 'Daniel Vance', '+91 98761 23456', 'Other', 'Active', 'Active', '2026-08-30', '09:42:00');

INSERT IGNORE INTO treatments (id, admission_id, patient_id, doctor_name, dept, date_label, note, vitals)
VALUES (1, 'HMS-2026-8842', '26PAT0001', 'Dr. Aris Thorne', 'Cardiology Dept', 'Today 09:30 AM', 'Patient responding exceptionally well to IV Ceftriaxone. SpO2 stable at 98%. Maintain light liquid diet and monitor blood pressure every 4 hours.', 'BP: 120/80 mmHg | HR: 74 bpm | SpO2: 98% | Temp: 98.6°F'),
       (2, 'HMS-2026-8842', '26PAT0001', 'Dr. Elena Rostova', 'Pulmonology Dept', 'Yesterday 06:00 PM', 'Nebulization completed. Patient reported reduced breathlessness. Recommended light walking in corridor.', 'BP: 124/82 mmHg | HR: 78 bpm | SpO2: 97% | Temp: 98.4°F');

INSERT IGNORE INTO lab_reports (id, admission_id, patient_id, title, category, status, badge_class, notes)
VALUES ('LAB-9921', 'HMS-2026-8842', '26PAT0001', 'Complete Blood Count (CBC)', 'Pathology', 'Normal', 'badge-success', 'WBC and Platelets within normal limits. Hemoglobin: 13.8 g/dL.'),
       ('LAB-9925', 'HMS-2026-8842', '26PAT0001', 'Cardiac Enzymes (Troponin T)', 'Biochemistry', 'Elevated (Monitored)', 'badge-warning', 'Troponin T levels elevated at admission, dropping steadily on day 2.');

INSERT IGNORE INTO prescriptions (id, admission_id, patient_id, name, dosage, duration, counter, token, status, badge_class, instructions, is_collected)
VALUES ('RX-101', 'HMS-2026-8842', '26PAT0001', 'Ceftriaxone 1g Injection (IV)', '1g Once Daily (09:00 AM)', '5 Days Pack', 'Ground Floor Counter 3', 'PH-4082', 'Ready for Collection', 'badge-warning', 'Administer slowly via IV line under nursing supervision.', 0),
       ('RX-102', 'HMS-2026-8842', '26PAT0001', 'Atorvastatin 20mg Tablet', '1 tablet at bedtime (09:00 PM)', '30 Tablets Pack', 'Ground Floor Counter 3', 'PH-4079', 'Collected by Caregiver', 'badge-success', 'Take after dinner with water.', 1);

INSERT IGNORE INTO billing_summary (admission_id, total_bill, insurance_covered, remaining_payable, claim_status)
VALUES ('HMS-2026-8842', 64500.00, 50000.00, 14500.00, 'Approved');

INSERT IGNORE INTO bill_items (admission_id, description, category, amount)
VALUES ('HMS-2026-8842', 'ICU Room Charges (3 Days @ ₹12,000/day)', 'Room Rent', 36000.00),
       ('HMS-2026-8842', 'Doctor & Consultant Fee (Cardiology)', 'Consultation', 12000.00),
       ('HMS-2026-8842', 'Pharmacy & IV Medications', 'Pharmacy', 8500.00),
       ('HMS-2026-8842', 'Laboratory & CT Diagnostics', 'Diagnostics', 8000.00);

INSERT IGNORE INTO payments (tx_id, admission_id, date_label, method, amount, status)
VALUES ('TXN-991823', 'HMS-2026-8842', '13 Aug 2026', 'UPI (Google Pay)', 10000.00, 'Paid');

INSERT IGNORE INTO doctor_appointments (admission_id, patient_id, doctor_name, department, appointment_date, appointment_time, appointment_type, room, status, scheduled_by)
VALUES ('HMS-2026-8842', '26PAT0001', 'Dr. Aris Thorne', 'Cardiology', CURDATE(), '11:00 AM', 'Cardiology Follow-up & ECG Review', 'ICU Room 304', 'SCHEDULED', 'Duty Nurse Sister Sarah');

INSERT IGNORE INTO id_sequences (seq_type, seq_prefix, current_value)
VALUES ('PATIENT', '26PAT', 1),
       ('ADMISSION', '26CAR', 1);

-- Prescriptions structured workflow fields migration
ALTER TABLE prescriptions 
  ADD COLUMN IF NOT EXISTS frequency VARCHAR(64) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS route VARCHAR(64) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS prescription_date DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS doctor VARCHAR(128) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS quantity INT DEFAULT NULL;

-- Centralized Medicine Master & Inventory Pricing Data
CREATE TABLE IF NOT EXISTS medicine_master (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(160) NOT NULL UNIQUE,
    generic_name VARCHAR(128) DEFAULT NULL,
    form         VARCHAR(32) NOT NULL DEFAULT 'Tablet',
    unit_price   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO medicine_master (name, generic_name, form, unit_price) VALUES
('Atorvastatin 40mg', 'Atorvastatin', 'Tablet', 25.00),
('Atorvastatin 20mg Tablet', 'Atorvastatin', 'Tablet', 25.00),
('Ceftriaxone 1g Injection (IV)', 'Ceftriaxone', 'Injection', 140.00),
('Metformin 500mg Tablet', 'Metformin', 'Tablet', 12.00),
('Amlodipine 5mg Tablet', 'Amlodipine', 'Tablet', 10.00),
('Pantoprazole 40mg Tablet', 'Pantoprazole', 'Tablet', 15.00),
('Amoxicillin 500mg Capsule', 'Amoxicillin', 'Capsule', 18.00),
('Paracetamol 500mg Tablet', 'Paracetamol', 'Tablet', 5.00),
('Azithromycin 250mg Tablet', 'Azithromycin', 'Tablet', 35.00),
('Ondansetron 4mg Injection (IV)', 'Ondansetron', 'Injection', 45.00),
('Heparin 5000 IU Injection (SC)', 'Heparin', 'Injection', 190.00),
('Insulin Glargine 10 Units (SC)', 'Insulin Glargine', 'Injection', 350.00),
('Furosemide 40mg Tablet', 'Furosemide', 'Tablet', 8.00),
('Metoprolol 25mg Tablet', 'Metoprolol', 'Tablet', 14.00),
('Salbutamol 2.5mg Nebulisation', 'Salbutamol', 'Nebulisation', 30.00),
('Dexamethasone 4mg Injection (IV)', 'Dexamethasone', 'Injection', 22.00);

-- Global HMS Data Consistency: Track current department and patient transfers
ALTER TABLE admissions ADD COLUMN IF NOT EXISTS current_dept VARCHAR(64) DEFAULT NULL AFTER admitting_dept;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS current_dept VARCHAR(64) DEFAULT NULL AFTER room_number;

CREATE TABLE IF NOT EXISTS patient_transfers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admission_id VARCHAR(64) NOT NULL,
    patient_id VARCHAR(64) NOT NULL,
    from_dept VARCHAR(64) NOT NULL,
    to_dept VARCHAR(64) NOT NULL,
    from_room VARCHAR(64) NOT NULL,
    to_room VARCHAR(64) NOT NULL,
    attending_doctor VARCHAR(128) DEFAULT NULL,
    transfer_reason VARCHAR(255) DEFAULT '',
    transferred_by VARCHAR(128) DEFAULT 'HMS Staff',
    transfer_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_transfer_adm (admission_id),
    INDEX idx_transfer_pat (patient_id)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Authoritative Room & Ward Tariffs
CREATE TABLE IF NOT EXISTS room_tariffs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_type VARCHAR(64) NOT NULL UNIQUE,
    display_name VARCHAR(128) NOT NULL,
    daily_rate DECIMAL(10,2) NOT NULL,
    description VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed standard room and ward tariffs established in project data
INSERT INTO room_tariffs (room_type, display_name, daily_rate, description)
VALUES 
  ('ICU', 'Critical Care / ICU', 12000.00, 'Intensive Care Unit / Critical Care bed daily charge'),
  ('DELUXE', 'Deluxe Room / Suite', 5500.00, 'Premium private air-conditioned room with attendant bed'),
  ('PRIVATE', 'Private Room', 3500.00, 'Standard single private room with attached bathroom'),
  ('SEMI-PRIVATE', 'Semi-Private Room', 2200.00, 'Twin-sharing room with shared facilities'),
  ('WARD', 'General Ward Bed', 1200.00, 'Multi-bed general and specialty ward accommodation')
ON DUPLICATE KEY UPDATE 
  display_name = VALUES(display_name),
  daily_rate = VALUES(daily_rate),
  description = VALUES(description);

-- Authoritative Billing Tariffs for Consultation, Diagnostics, Procedures & Services
CREATE TABLE IF NOT EXISTS billing_tariffs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category VARCHAR(64) NOT NULL,
    item_code VARCHAR(64) NOT NULL UNIQUE,
    display_name VARCHAR(128) NOT NULL,
    standard_rate DECIMAL(10,2) NOT NULL,
    description VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO billing_tariffs (category, item_code, display_name, standard_rate, description)
VALUES 
  ('Consultation', 'DOC_CARDIO', 'Cardiology Specialist Consultation (Dr. Aris Thorne)', 12000.00, 'Senior Consultant Cardiologist clinical examination & review'),
  ('Consultation', 'DOC_PULMO', 'Pulmonology Specialist Consultation (Dr. Elena Rostova)', 8500.00, 'Consultant Pulmonologist respiratory evaluation & review'),
  ('Consultation', 'DOC_INTERNAL', 'Internal Medicine Specialist Consultation (Dr. Marcus Vance)', 5000.00, 'Senior Consultant Physician clinical evaluation & review'),
  ('Consultation', 'DOC_GENERAL', 'Senior Consultant Inpatient Review / Routine Consultation', 2500.00, 'Attending physician routine inpatient review & consultation'),
  ('Diagnostics', 'DIAG_CT_THORAX', 'CT Scan Thorax (Contrast)', 8000.00, 'High-resolution diagnostic contrast CT imaging'),
  ('Diagnostics', 'DIAG_TROPONIN', 'Cardiac Enzymes (Troponin T)', 2500.00, 'Cardiac biomarker quantitative serum analysis'),
  ('Diagnostics', 'DIAG_CBC', 'Complete Blood Count (CBC)', 850.00, 'Automated 5-part differential hemogram & platelet count'),
  ('Diagnostics', 'DIAG_ELECTROLYTES', 'Electrolytes Panel (Serum)', 950.00, 'Serum sodium, potassium, chloride & bicarbonate assessment'),
  ('Diagnostics', 'DIAG_GENERAL', 'Laboratory & CT Diagnostics', 8000.00, 'Standard diagnostic and laboratory investigation package'),
  ('Procedures', 'PROC_NEBULIZATION', 'Nebulization & Inhalation Procedure', 1500.00, 'Aerosolized bronchodilator delivery and respiratory care'),
  ('Procedures', 'PROC_IV_INFUSION', 'IV Infusion & Clinical Nursing Procedure', 3500.00, 'Intravenous cannulation, drug titration & continuous monitoring'),
  ('Procedures', 'PROC_BRONCHOSCOPY', 'Bronchoscopy / Pulmonary Procedure', 6500.00, 'Diagnostic fiberoptic bronchoscopic airway visualization'),
  ('Procedures', 'PROC_ECG_MONITOR', '12-Lead ECG & Cardiac Monitoring Procedure', 2200.00, 'Continuous cardiovascular telemetry and rhythm interpretation'),
  ('Procedures', 'PROC_GENERAL', 'Standard Inpatient Clinical Procedure', 3500.00, 'Specialized inpatient procedural care and monitoring'),
  ('Pharmacy', 'PHARM_GENERAL', 'Pharmacy & IV Medications', 8500.00, 'Inpatient prescription medications and IV drug supplies')
ON DUPLICATE KEY UPDATE 
  display_name = VALUES(display_name),
  standard_rate = VALUES(standard_rate),
  description = VALUES(description);




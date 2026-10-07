-- CareBridge HMS MySQL Database Schema Script
-- Created for CareBridge Caregiver Companion Platform

CREATE DATABASE IF NOT EXISTS carebridge_db;
USE carebridge_db;

-- 1. Patients Table
CREATE TABLE IF NOT EXISTS patients (
    patient_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    admission_id VARCHAR(64) UNIQUE NOT NULL,
    full_name VARCHAR(128) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(16) NOT NULL,
    blood_group VARCHAR(8),
    room_number VARCHAR(32) NOT NULL,
    attending_doctor VARCHAR(128) NOT NULL,
    department VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ADMITTED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Caregivers Table
CREATE TABLE IF NOT EXISTS caregivers (
    caregiver_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    firebase_uid VARCHAR(128) UNIQUE NOT NULL,
    full_name VARCHAR(128) NOT NULL,
    phone_number VARCHAR(32) UNIQUE NOT NULL,
    admission_id VARCHAR(64) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'PRIMARY_CAREGIVER',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admission_id) REFERENCES patients(admission_id) ON DELETE CASCADE
);

-- 3. Family Members Table
CREATE TABLE IF NOT EXISTS family_members (
    member_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    primary_caregiver_id BIGINT NOT NULL,
    full_name VARCHAR(128) NOT NULL,
    phone_number VARCHAR(32) NOT NULL,
    relation VARCHAR(64) NOT NULL,
    access_level VARCHAR(32) NOT NULL DEFAULT 'READ_ONLY',
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (primary_caregiver_id) REFERENCES caregivers(caregiver_id) ON DELETE CASCADE
);

-- 4. Admissions Table
CREATE TABLE IF NOT EXISTS admissions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    admission_id VARCHAR(64) NOT NULL,
    admission_date TIMESTAMP NOT NULL,
    discharge_date TIMESTAMP NULL,
    primary_diagnosis TEXT NOT NULL,
    hospital_name VARCHAR(128) NOT NULL,
    FOREIGN KEY (admission_id) REFERENCES patients(admission_id) ON DELETE CASCADE
);

-- 5. Treatment Updates Table
CREATE TABLE IF NOT EXISTS treatment_updates (
    update_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    admission_id VARCHAR(64) NOT NULL,
    doctor_name VARCHAR(128) NOT NULL,
    department VARCHAR(64) NOT NULL,
    instructions TEXT NOT NULL,
    vitals_bp VARCHAR(32),
    vitals_spo2 VARCHAR(32),
    vitals_hr VARCHAR(32),
    vitals_temp VARCHAR(32),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admission_id) REFERENCES patients(admission_id) ON DELETE CASCADE
);

-- 6. Lab Reports Table
CREATE TABLE IF NOT EXISTS lab_reports (
    report_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    admission_id VARCHAR(64) NOT NULL,
    report_name VARCHAR(128) NOT NULL,
    category VARCHAR(64) NOT NULL,
    reference_number VARCHAR(64) UNIQUE NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED',
    file_url VARCHAR(255),
    doctor_notes TEXT,
    report_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admission_id) REFERENCES patients(admission_id) ON DELETE CASCADE
);

-- 7. Prescriptions Table
CREATE TABLE IF NOT EXISTS prescriptions (
    prescription_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    admission_id VARCHAR(64) NOT NULL,
    medicine_name VARCHAR(128) NOT NULL,
    dosage VARCHAR(64) NOT NULL,
    frequency VARCHAR(64) NOT NULL,
    duration VARCHAR(64) NOT NULL,
    instructions TEXT,
    prescribed_by VARCHAR(128) NOT NULL,
    pharmacy_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    prescribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admission_id) REFERENCES patients(admission_id) ON DELETE CASCADE
);

-- 8. Bills Table
CREATE TABLE IF NOT EXISTS bills (
    bill_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    admission_id VARCHAR(64) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    insurance_covered DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    patient_payable DECIMAL(10,2) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'UNPAID',
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admission_id) REFERENCES patients(admission_id) ON DELETE CASCADE
);

-- 9. Bill Items Table
CREATE TABLE IF NOT EXISTS bill_items (
    item_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    bill_id BIGINT NOT NULL,
    description VARCHAR(255) NOT NULL,
    category VARCHAR(64) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (bill_id) REFERENCES bills(bill_id) ON DELETE CASCADE
);

-- 10. Payments Table
CREATE TABLE IF NOT EXISTS payments (
    payment_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    bill_id BIGINT NOT NULL,
    transaction_id VARCHAR(128) UNIQUE NOT NULL,
    payment_method VARCHAR(32) NOT NULL,
    amount_paid DECIMAL(10,2) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'SUCCESS',
    receipt_url VARCHAR(255),
    payment_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bill_id) REFERENCES bills(bill_id) ON DELETE CASCADE
);

-- 11. Insurance Claims Table
CREATE TABLE IF NOT EXISTS insurance_claims (
    claim_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    admission_id VARCHAR(64) NOT NULL,
    policy_number VARCHAR(128) NOT NULL,
    provider_name VARCHAR(128) NOT NULL,
    claimed_amount DECIMAL(10,2) NOT NULL,
    approved_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(32) NOT NULL DEFAULT 'SUBMITTED',
    stage_notes TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (admission_id) REFERENCES patients(admission_id) ON DELETE CASCADE
);

-- 12. Documents Table
CREATE TABLE IF NOT EXISTS documents (
    document_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    admission_id VARCHAR(64) NOT NULL,
    title VARCHAR(128) NOT NULL,
    category VARCHAR(64) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_size_kb INT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admission_id) REFERENCES patients(admission_id) ON DELETE CASCADE
);

-- 13. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    notification_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    caregiver_id BIGINT NOT NULL,
    title VARCHAR(128) NOT NULL,
    message TEXT NOT NULL,
    category VARCHAR(32) NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (caregiver_id) REFERENCES caregivers(caregiver_id) ON DELETE CASCADE
);

-- Performance Indexes
CREATE INDEX idx_patients_admission ON patients(admission_id);
CREATE INDEX idx_caregivers_phone ON caregivers(phone_number);
CREATE INDEX idx_treatment_admission ON treatment_updates(admission_id);
CREATE INDEX idx_claims_status ON insurance_claims(status);

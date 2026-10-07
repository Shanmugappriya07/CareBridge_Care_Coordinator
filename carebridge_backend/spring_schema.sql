CREATE DATABASE IF NOT EXISTS carebridge_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE carebridge_db;

CREATE TABLE IF NOT EXISTS patients (
  patient_id VARCHAR(64) PRIMARY KEY, name VARCHAR(160) NOT NULL, age INT,
  gender VARCHAR(40), phone VARCHAR(40), blood_group VARCHAR(20),
  emergency_contact_name VARCHAR(160), emergency_contact_phone VARCHAR(40),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS admissions (
  admission_id VARCHAR(64) PRIMARY KEY, patient_id VARCHAR(64) NOT NULL,
  admission_date DATE NOT NULL, discharge_date DATE, status VARCHAR(20) NOT NULL,
  doctor VARCHAR(160) NOT NULL, department VARCHAR(160) NOT NULL,
  room_ward VARCHAR(160) NOT NULL, reason VARCHAR(500), hospital_name VARCHAR(200),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_admission_patient FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
  INDEX ix_admission_patient_date (patient_id, admission_date)
);
CREATE TABLE IF NOT EXISTS admission_caregivers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, admission_id VARCHAR(64) NOT NULL,
  caregiver_name VARCHAR(160), caregiver_mobile VARCHAR(40) NOT NULL,
  relationship VARCHAR(80), access_status VARCHAR(20) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, disabled_at TIMESTAMP NULL,
  CONSTRAINT uq_admission_caregiver UNIQUE (admission_id, caregiver_mobile),
  CONSTRAINT fk_caregiver_admission FOREIGN KEY (admission_id) REFERENCES admissions(admission_id)
);
CREATE TABLE IF NOT EXISTS admission_records (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, admission_id VARCHAR(64) NOT NULL,
  resource_type VARCHAR(40) NOT NULL, payload TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_record_admission FOREIGN KEY (admission_id) REFERENCES admissions(admission_id),
  INDEX ix_record_admission_type (admission_id, resource_type)
);
CREATE TABLE IF NOT EXISTS discharge_summaries (
  admission_id VARCHAR(64) PRIMARY KEY, summary TEXT, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_summary_admission FOREIGN KEY (admission_id) REFERENCES admissions(admission_id)
);

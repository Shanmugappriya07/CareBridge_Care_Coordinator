-- CareBridge Seed Data Script

-- 1. Patients Table Update with Age & Phone Number
INSERT INTO patients (admission_id, full_name, date_of_birth, gender, blood_group, room_number, attending_doctor, department, status)
VALUES ('HMS-2026-8842', 'Eleanor Vance', '1968-04-12', 'FEMALE', 'A+', 'ICU Room 304', 'Dr. Aris Thorne', 'Cardiology', 'ADMITTED');

-- 2. Caregivers
INSERT INTO caregivers (firebase_uid, full_name, phone_number, admission_id, role)
VALUES ('FB-UID-991823', 'Sarah Vance', '+919876543210', 'HMS-2026-8842', 'PRIMARY_CAREGIVER');

-- 3. Family Members
INSERT INTO family_members (primary_caregiver_id, full_name, phone_number, relation, access_level, status)
VALUES 
(1, 'David Vance', '+919812376543', 'Son', 'READ_ONLY', 'ACTIVE'),
(1, 'Clara Vance', '+919900112233', 'Sister', 'READ_ONLY', 'ACTIVE');

-- 4. Admissions
INSERT INTO admissions (admission_id, admission_date, primary_diagnosis, hospital_name)
VALUES ('HMS-2026-8842', '2026-08-13 10:30:00', 'Acute Coronary Syndrome & Mild Respiratory Distress', 'St. Jude Memorial Hospital');

-- 5. Treatment Updates
INSERT INTO treatment_updates (admission_id, doctor_name, department, instructions, vitals_bp, vitals_spo2, vitals_hr, vitals_temp)
VALUES 
('HMS-2026-8842', 'Dr. Aris Thorne', 'Cardiology', 'Patient responding well to IV antibiotics. SpO2 stable at 98%. Maintain light liquid diet and monitor blood pressure every 4 hours.', '120/80 mmHg', '98%', '74 bpm', '98.6°F'),
('HMS-2026-8842', 'Dr. Elena Rostova', 'Pulmonology', 'Nebulization completed. Patient reported reduced breathlessness. Recommended light walking in corridor.', '124/82 mmHg', '97%', '78 bpm', '98.4°F');

-- 6. Lab Reports
INSERT INTO lab_reports (admission_id, report_name, category, reference_number, status, doctor_notes)
VALUES 
('HMS-2026-8842', 'Complete Blood Count (CBC)', 'Pathology', 'LAB-9921', 'COMPLETED', 'WBC and Platelets within normal limits.'),
('HMS-2026-8842', 'Cardiac Enzymes (Troponin T)', 'Biochemistry', 'LAB-9925', 'ELEVATED_MONITORED', 'Troponin T levels elevated at admission, dropping steadily on day 2.'),
('HMS-2026-8842', 'High-Resolution Chest CT Scan', 'Radiology', 'RAD-4012', 'COMPLETED', 'Minor bilateral lower lobe congestion, no pulmonary embolism.');

-- 7. Prescriptions
INSERT INTO prescriptions (admission_id, medicine_name, dosage, frequency, duration, instructions, prescribed_by, pharmacy_status)
VALUES 
('HMS-2026-8842', 'Ceftriaxone 1g Injection (IV)', '1g', 'Once Daily (09:00 AM)', '5 Days', 'Administer slowly via IV line under nursing supervision.', 'Dr. Aris Thorne', 'ACTIVE'),
('HMS-2026-8842', 'Atorvastatin 20mg Tablet', '20mg', 'Bedtime (09:00 PM)', 'Ongoing 30 Days', 'Take after dinner with water.', 'Dr. Aris Thorne', 'ACTIVE');

-- 8. Bills
INSERT INTO bills (admission_id, total_amount, insurance_covered, patient_payable, status)
VALUES ('HMS-2026-8842', 64500.00, 50000.00, 14500.00, 'UNPAID');

-- 9. Bill Items
INSERT INTO bill_items (bill_id, description, category, amount)
VALUES 
(1, 'ICU Room Charges (3 Days @ ₹12,000/day)', 'Room Rent', 36000.00),
(1, 'Doctor & Consultant Fee (Cardiology)', 'Consultation', 12000.00),
(1, 'Pharmacy & IV Medications', 'Pharmacy', 8500.00),
(1, 'Laboratory & CT Diagnostics', 'Diagnostics', 8000.00);

-- 10. Payments
INSERT INTO payments (bill_id, transaction_id, payment_method, amount_paid, status)
VALUES (1, 'TXN-991823', 'UPI', 10000.00, 'SUCCESS');

-- 11. Insurance Claims
INSERT INTO insurance_claims (admission_id, policy_number, provider_name, claimed_amount, approved_amount, status, stage_notes)
VALUES ('HMS-2026-8842', 'SH-9948210394', 'Star Health Insurance', 60000.00, 50000.00, 'APPROVED', 'Pre-authorization granted for cashless hospitalization.');

-- 12. Documents
INSERT INTO documents (admission_id, title, category, file_path, file_size_kb)
VALUES 
('HMS-2026-8842', 'Hospital Admission Authorization Form', 'Admission', '/storage/docs/adm_8842.pdf', 1200),
('HMS-2026-8842', 'Insurance Pre-Auth Clearance Letter', 'Insurance', '/storage/docs/ins_8842.pdf', 2400);

-- 13. Notifications
INSERT INTO notifications (caregiver_id, title, message, category, is_read)
VALUES 
(1, 'New Doctor Instruction', 'Dr. Aris Thorne updated morning treatment instructions for Eleanor Vance.', 'TREATMENT', false),
(1, 'Insurance Pre-Approved', 'Star Health approved cashless amount of ₹50,000.', 'INSURANCE', false);

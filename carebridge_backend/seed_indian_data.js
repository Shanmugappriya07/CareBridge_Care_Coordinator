require('dotenv').config();
const mysql = require('mysql2/promise');

async function seedIndianData() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'carebridge_db',
    charset: 'utf8mb4'
  });

  console.log('Connected to carebridge_db. Starting Indian data reseeding...');

  await conn.beginTransaction();

  try {
    // Disable foreign key checks during reseed
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    // 1. Patients Master & Patients Sync Table
    const patientsData = [
      {
        patientId: '26PAT0001',
        fullName: 'Meenakshi Ravi',
        dob: '1968-04-12',
        ageGender: '58 Years • Female (A+)',
        phone: '+91 98111 22334',
        bloodGroup: 'A+',
        city: 'Chennai',
        caregiverName: 'Priya Lakshmi',
        caregiverMobile: '+91 98765 43210',
        relation: 'Daughter',
        caregiverId: 'CG-991823'
      },
      {
        patientId: '26PAT0002',
        fullName: 'Arjun Raj',
        dob: '1981-08-25',
        ageGender: '45 Years • Male (O+)',
        phone: '+91 98765 43210',
        bloodGroup: 'O+',
        city: 'Coimbatore',
        caregiverName: 'Divya Raj',
        caregiverMobile: '+91 98765 43211',
        relation: 'Spouse',
        caregiverId: 'CG-959067'
      },
      {
        patientId: '26PAT0003',
        fullName: 'Jyothika Ramesh',
        dob: '1988-11-14',
        ageGender: '38 Years • Female (B+)',
        phone: '+91 98112 23344',
        bloodGroup: 'B+',
        city: 'Madurai',
        caregiverName: 'Ramesh Kumar',
        caregiverMobile: '+91 98998 87766',
        relation: 'Spouse',
        caregiverId: 'CG-844819'
      },
      {
        patientId: '26PAT0004',
        fullName: 'Lakshmi Sundaram',
        dob: '1974-03-19',
        ageGender: '52 Years • Female (A+)',
        phone: '+91 98223 34455',
        bloodGroup: 'A+',
        city: 'Tiruchirappalli',
        caregiverName: 'Suriya Sundaram',
        caregiverMobile: '+91 98445 56677',
        relation: 'Spouse',
        caregiverId: 'CG-801663'
      },
      {
        patientId: '26PAT0008',
        fullName: 'Priya Vignesh',
        dob: '1986-06-10',
        ageGender: '40 Years • Female (B+)',
        phone: '+91 88257 48664',
        bloodGroup: 'B+',
        city: 'Salem',
        caregiverName: 'Vignesh Natarajan',
        caregiverMobile: '+91 88701 67911',
        relation: 'Spouse',
        caregiverId: 'CG-942355'
      },
      {
        patientId: '26PAT0009',
        fullName: 'Karthik Kumar',
        dob: '1976-01-20',
        ageGender: '50 Years • Male (B+)',
        phone: '+91 98765 43240',
        bloodGroup: 'B+',
        city: 'Tirunelveli',
        caregiverName: 'Ananya Krishnan',
        caregiverMobile: '+91 98435 17728',
        relation: 'Sister',
        caregiverId: 'CG-151007'
      }
    ];

    for (const p of patientsData) {
      await conn.query(
        `INSERT INTO patients_master (patient_id, full_name, dob, age_gender, patient_phone, blood_group, emergency_contact_name, emergency_contact_phone, emergency_contact_relation)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           full_name = VALUES(full_name),
           dob = VALUES(dob),
           age_gender = VALUES(age_gender),
           patient_phone = VALUES(patient_phone),
           blood_group = VALUES(blood_group),
           emergency_contact_name = VALUES(emergency_contact_name),
           emergency_contact_phone = VALUES(emergency_contact_phone)`,
        [p.patientId, p.fullName, p.dob, p.ageGender, p.phone, p.bloodGroup, p.caregiverName, p.caregiverMobile, p.relation]
      );
    }
    console.log('Updated patients_master with realistic Indian names and DOBs.');

    // 2. Update admissions table
    const admissionsData = [
      {
        admissionId: '26CAR001',
        patientId: '26PAT0001',
        admittingDept: 'Cardiology',
        currentDept: 'Cardiology',
        roomNumber: 'ICU Room 304',
        attendingDoctor: 'Dr. Aris Thorne (Cardiology)',
        status: 'ADMITTED',
        caregiverName: 'Priya Lakshmi',
        caregiverId: 'CG-991823',
        caregiverPhone: '+91 98765 43210',
        relation: 'Daughter',
        admissionType: 'Emergency',
        reasonForAdmission: 'Post-operative observation and recovery',
        admissionDate: '2026-08-30',
        admissionTime: '09:42:00'
      },
      {
        admissionId: '26PUL001',
        patientId: '26PAT0002',
        admittingDept: 'Pulmonology',
        currentDept: 'Pulmonology',
        roomNumber: 'Pulmo Ward Bed 2',
        attendingDoctor: 'Dr. Elena Rostova (Pulmonology)',
        status: 'ADMITTED',
        caregiverName: 'Divya Raj',
        caregiverId: 'CG-959067',
        caregiverPhone: '+91 98765 43211',
        relation: 'Spouse',
        admissionType: 'Planned',
        reasonForAdmission: 'Follow-up bronchoscopy',
        admissionDate: '2026-09-29',
        admissionTime: '22:19:00'
      },
      {
        admissionId: '26CAR002',
        patientId: '26PAT0002',
        admittingDept: 'Cardiology',
        currentDept: 'Cardiology',
        roomNumber: 'Cardio Ward Bed 4',
        attendingDoctor: 'Dr. Aris Thorne (Cardiology)',
        status: 'DISCHARGED',
        caregiverName: 'Divya Raj',
        caregiverId: 'CG-930524',
        caregiverPhone: '+91 98765 43211',
        relation: 'Spouse',
        admissionType: 'Emergency',
        reasonForAdmission: 'Chest pain evaluation',
        admissionDate: '2026-09-28',
        admissionTime: '22:18:00',
        dischargeDate: '2026-09-29',
        dischargeSummary: 'Chest pain evaluation completed. Patient discharged for scheduled bronchoscopy.'
      },
      {
        admissionId: '26DRE001',
        patientId: '26PAT0003',
        admittingDept: 'General',
        currentDept: 'General',
        roomNumber: 'Room 204',
        attendingDoctor: 'Dr. Elena Rostova',
        status: 'ADMITTED',
        caregiverName: 'Ramesh Kumar',
        caregiverId: 'CG-844819',
        caregiverPhone: '+91 98998 87766',
        relation: 'Spouse',
        admissionType: 'Emergency',
        reasonForAdmission: 'Acute Bronchitis & Wheezing',
        admissionDate: '2026-09-29',
        admissionTime: '22:40:00'
      },
      {
        admissionId: '26CAR004',
        patientId: '26PAT0004',
        admittingDept: 'Cardiology',
        currentDept: 'Cardiology',
        roomNumber: 'ICU Room 303',
        attendingDoctor: 'Dr. Aris Thorne (Cardiology)',
        status: 'ADMITTED',
        caregiverName: 'Suriya Sundaram',
        caregiverId: 'CG-801663',
        caregiverPhone: '+91 98445 56677',
        relation: 'Spouse',
        admissionType: 'Elective',
        reasonForAdmission: 'Post-Recovery Cardiac Screening',
        admissionDate: '2026-09-29',
        admissionTime: '22:45:00'
      },
      {
        admissionId: '26MED001',
        patientId: '26PAT0008',
        admittingDept: 'Internal Medicine',
        currentDept: 'Internal Medicine',
        roomNumber: 'Private Room 501',
        attendingDoctor: 'Dr. Marcus Vance (Internal Med)',
        status: 'ADMITTED',
        caregiverName: 'Vignesh Natarajan',
        caregiverId: 'CG-942355',
        caregiverPhone: '+91 88701 67911',
        relation: 'Spouse',
        admissionType: 'Emergency',
        reasonForAdmission: 'Internal Medicine Evaluation',
        admissionDate: '2026-10-04',
        admissionTime: '10:00:00'
      },
      {
        admissionId: '26CAR007',
        patientId: '26PAT0009',
        admittingDept: 'Cardiology',
        currentDept: 'Paediatrics',
        roomNumber: 'Paediatric Ward - Bed 1',
        attendingDoctor: 'Dr. Anita Rao (Paediatrics)',
        status: 'ADMITTED',
        caregiverName: 'Ananya Krishnan',
        caregiverId: 'CG-151007',
        caregiverPhone: '+91 98435 17728',
        relation: 'Sister',
        admissionType: 'Referral',
        reasonForAdmission: 'Paediatric Observation & Care',
        admissionDate: '2026-10-05',
        admissionTime: '00:45:00'
      }
    ];

    for (const a of admissionsData) {
      await conn.query(
        `INSERT INTO admissions (admission_id, patient_id, admitting_dept, current_dept, room_number, attending_doctor, status, caregiver_name, caregiver_id, caregiver_phone, relation, admission_type, reason_for_admission, admission_date, admission_time, discharge_date, discharge_summary)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           patient_id = VALUES(patient_id),
           admitting_dept = VALUES(admitting_dept),
           current_dept = VALUES(current_dept),
           room_number = VALUES(room_number),
           attending_doctor = VALUES(attending_doctor),
           status = VALUES(status),
           caregiver_name = VALUES(caregiver_name),
           caregiver_id = VALUES(caregiver_id),
           caregiver_phone = VALUES(caregiver_phone),
           relation = VALUES(relation),
           admission_type = VALUES(admission_type),
           reason_for_admission = VALUES(reason_for_admission),
           admission_date = VALUES(admission_date),
           admission_time = VALUES(admission_time),
           discharge_date = VALUES(discharge_date),
           discharge_summary = VALUES(discharge_summary)`,
        [a.admissionId, a.patientId, a.admittingDept, a.currentDept, a.roomNumber, a.attendingDoctor, a.status, a.caregiverName, a.caregiverId, a.caregiverPhone, a.relation, a.admissionType, a.reasonForAdmission, a.admissionDate, a.admissionTime, a.dischargeDate || null, a.dischargeSummary || null]
      );

      // Update sync patients table
      const pat = patientsData.find(p => p.patientId === a.patientId);
      if (pat) {
        await conn.query(
          `INSERT INTO patients (admission_id, patient_id, full_name, dob, age_gender, patient_phone, room_number, attending_doctor, status, caregiver_name, caregiver_id, caregiver_phone, relation, admission_type, reason_for_admission, admission_date, admission_time)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             patient_id = VALUES(patient_id),
             full_name = VALUES(full_name),
             dob = VALUES(dob),
             age_gender = VALUES(age_gender),
             patient_phone = VALUES(patient_phone),
             room_number = VALUES(room_number),
             attending_doctor = VALUES(attending_doctor),
             status = VALUES(status),
             caregiver_name = VALUES(caregiver_name),
             caregiver_id = VALUES(caregiver_id),
             caregiver_phone = VALUES(caregiver_phone),
             relation = VALUES(relation),
             admission_type = VALUES(admission_type),
             reason_for_admission = VALUES(reason_for_admission),
             admission_date = VALUES(admission_date),
             admission_time = VALUES(admission_time)`,
          [a.admissionId, a.patientId, pat.fullName, pat.dob, pat.ageGender, pat.phone, a.roomNumber, a.attendingDoctor, a.status, a.caregiverName, a.caregiverId, a.caregiverPhone, a.relation, a.admissionType, a.reasonForAdmission, a.admissionDate, a.admissionTime]
        );
      }
    }
    console.log('Updated admissions and patients sync table.');

    // 3. Update doctor appointments patient_id references and doctor names
    await conn.query("UPDATE doctor_appointments SET doctor_name = 'Dr. Anita Rao (Paediatrics)', department = 'Paediatrics' WHERE admission_id = '26CAR007'");
    console.log('Updated doctor appointments.');

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    await conn.commit();
    console.log('Reseed transaction committed successfully!');
  } catch (e) {
    await conn.rollback();
    console.error('Reseed error, rolled back:', e);
    throw e;
  } finally {
    await conn.end();
  }
}

seedIndianData().catch(console.error);

// inspect_database_records.js
// Deep inspection script for MySQL carebridge_db to find stale, duplicate, obsolete, and orphaned records

require('dotenv').config();
const mysql = require('mysql2/promise');

async function inspect() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'carebridge_db',
    charset: 'utf8mb4',
  });

  console.log('Connected to MySQL carebridge_db successfully.\n');

  // List of tables to inspect
  const tables = [
    'patients_master',
    'patients',
    'admissions',
    'admission_caregivers',
    'doctor_appointments',
    'lab_reports',
    'prescriptions',
    'treatments',
    'pharmacy_transactions',
    'bill_items',
    'billing_summary',
    'payments',
    'patient_transfers'
  ];

  console.log('=== 1. TABLE ROW COUNTS ===');
  for (const t of tables) {
    try {
      const [rows] = await conn.query(`SELECT COUNT(*) as cnt FROM ${t}`);
      console.log(`  ${t.padEnd(25)}: ${rows[0].cnt} rows`);
    } catch (e) {
      console.log(`  ${t.padEnd(25)}: Table not found or error (${e.message})`);
    }
  }

  console.log('\n=== 2. ALL PATIENTS_MASTER ROWS ===');
  const [pm] = await conn.query('SELECT patient_id, full_name, age_gender, patient_phone, blood_group, created_at FROM patients_master ORDER BY patient_id');
  console.table(pm);

  console.log('\n=== 3. ALL PATIENTS (LEGACY/SYNC TABLE) ROWS ===');
  const [p] = await conn.query('SELECT admission_id, patient_id, full_name, room_number, attending_doctor, current_dept, status FROM patients ORDER BY patient_id, admission_id');
  console.table(p);

  console.log('\n=== 4. ALL ADMISSIONS ROWS ===');
  const [adm] = await conn.query('SELECT admission_id, patient_id, admitting_dept, current_dept, room_number, attending_doctor, status, caregiver_name, caregiver_phone, admission_date, discharge_date FROM admissions ORDER BY patient_id, admission_id');
  console.table(adm);

  console.log('\n=== 5. ALL ADMISSION_CAREGIVERS ROWS ===');
  try {
    const [cg] = await conn.query('SELECT id, admission_id, caregiver_name, caregiver_mobile, relationship, access_status, role FROM admission_caregivers ORDER BY admission_id, id');
    console.table(cg);
  } catch (e) {
    console.log('  admission_caregivers error:', e.message);
  }

  console.log('\n=== 6. ALL DOCTOR APPOINTMENTS ROWS ===');
  const [appts] = await conn.query('SELECT id, admission_id, patient_id, doctor_name, department, appointment_date, appointment_time, appointment_type, room, status, scheduled_by FROM doctor_appointments ORDER BY id');
  console.table(appts);

  console.log('\n=== 7. PER-ADMISSION RELATED RECORDS AUDIT ===');
  // For each admission, list related records count across all child tables
  const [allAdms] = await conn.query('SELECT admission_id, patient_id FROM admissions ORDER BY admission_id');
  for (const a of allAdms) {
    const [rx] = await conn.query('SELECT COUNT(*) as cnt FROM prescriptions WHERE admission_id = ?', [a.admission_id]);
    const [tr] = await conn.query('SELECT COUNT(*) as cnt FROM treatments WHERE admission_id = ?', [a.admission_id]);
    const [lab] = await conn.query('SELECT COUNT(*) as cnt FROM lab_reports WHERE admission_id = ?', [a.admission_id]);
    const [phm] = await conn.query('SELECT COUNT(*) as cnt FROM pharmacy_transactions WHERE admission_id = ?', [a.admission_id]);
    const [app] = await conn.query('SELECT COUNT(*) as cnt FROM doctor_appointments WHERE admission_id = ?', [a.admission_id]);
    const [bi] = await conn.query('SELECT COUNT(*) as cnt FROM bill_items WHERE admission_id = ?', [a.admission_id]);
    const [bs] = await conn.query('SELECT COUNT(*) as cnt FROM billing_summary WHERE admission_id = ?', [a.admission_id]);
    const [pay] = await conn.query('SELECT COUNT(*) as cnt FROM payments WHERE admission_id = ?', [a.admission_id]);
    const [pt] = await conn.query('SELECT COUNT(*) as cnt FROM patient_transfers WHERE admission_id = ?', [a.admission_id]);

    console.log(`Admission: ${a.admission_id.padEnd(14)} (PID: ${a.patient_id}): Rx=${rx[0].cnt}, Treat=${tr[0].cnt}, Lab=${lab[0].cnt}, Phm=${phm[0].cnt}, Appt=${app[0].cnt}, BillItems=${bi[0].cnt}, BillSum=${bs[0].cnt}, Pay=${pay[0].cnt}, Transfers=${pt[0].cnt}`);
  }

  console.log('\n=== 8. CHECKING FOR ORPHANED CHILD RECORDS (Not in admissions table) ===');
  const checkOrphans = async (childTable, col = 'admission_id') => {
    try {
      const [orphans] = await conn.query(`
        SELECT t.* FROM ${childTable} t 
        LEFT JOIN admissions a ON t.${col} = a.admission_id 
        WHERE a.admission_id IS NULL
      `);
      if (orphans.length > 0) {
        console.log(`⚠️  ${childTable} has ${orphans.length} orphaned rows referencing non-existent admissions:`);
        console.table(orphans.slice(0, 10));
      } else {
        console.log(`✓  ${childTable}: 0 orphaned rows`);
      }
    } catch (e) {
      console.log(`  ${childTable} error:`, e.message);
    }
  };

  await checkOrphans('prescriptions');
  await checkOrphans('treatments');
  await checkOrphans('lab_reports');
  await checkOrphans('pharmacy_transactions');
  await checkOrphans('doctor_appointments');
  await checkOrphans('bill_items');
  await checkOrphans('billing_summary');
  await checkOrphans('payments');
  await checkOrphans('patient_transfers');
  await checkOrphans('admission_caregivers');

  console.log('\n=== 9. CHECKING ADMISSIONS WITHOUT PATIENTS_MASTER (Orphaned admissions) ===');
  const [orphanedAdms] = await conn.query(`
    SELECT a.* FROM admissions a 
    LEFT JOIN patients_master pm ON a.patient_id = pm.patient_id 
    WHERE pm.patient_id IS NULL
  `);
  if (orphanedAdms.length > 0) {
    console.log(`⚠️  admissions table has ${orphanedAdms.length} rows referencing non-existent patients_master:`);
    console.table(orphanedAdms);
  } else {
    console.log('✓  admissions: 0 orphaned rows against patients_master');
  }

  console.log('\n=== 10. CHECKING PATIENTS_MASTER WITHOUT ADMISSIONS ===');
  const [patientsNoAdm] = await conn.query(`
    SELECT pm.* FROM patients_master pm 
    LEFT JOIN admissions a ON pm.patient_id = a.patient_id 
    WHERE a.admission_id IS NULL
  `);
  if (patientsNoAdm.length > 0) {
    console.log(`⚠️  patients_master has ${patientsNoAdm.length} patients with NO admissions:`);
    console.table(patientsNoAdm);
  } else {
    console.log('✓  patients_master: all patients have at least one admission');
  }

  console.log('\n=== 11. CHECKING PATIENTS TABLE (LEGACY) VS ADMISSIONS TABLE ===');
  const [patientsMismatch] = await conn.query(`
    SELECT p.admission_id as p_adm, p.patient_id as p_pid, p.full_name as p_name, a.admission_id as a_adm, a.patient_id as a_pid, a.status as a_status
    FROM patients p
    FULL JOIN admissions a ON p.admission_id = a.admission_id
    WHERE p.admission_id IS NULL OR a.admission_id IS NULL OR p.patient_id != a.patient_id
  `).catch(async () => {
    // MySQL does not support FULL JOIN directly, use LEFT and RIGHT join
    const [left] = await conn.query(`
      SELECT p.admission_id as p_adm, p.patient_id as p_pid, p.full_name as p_name, a.admission_id as a_adm, a.patient_id as a_pid
      FROM patients p
      LEFT JOIN admissions a ON p.admission_id = a.admission_id
      WHERE a.admission_id IS NULL OR p.patient_id != a.patient_id
    `);
    const [right] = await conn.query(`
      SELECT p.admission_id as p_adm, p.patient_id as p_pid, a.admission_id as a_adm, a.patient_id as a_pid
      FROM admissions a
      LEFT JOIN patients p ON a.admission_id = p.admission_id
      WHERE p.admission_id IS NULL
    `);
    return [left.concat(right)];
  });
  console.log('Mismatch rows between patients table and admissions table:');
  console.table(patientsMismatch);

  await conn.end();
}

inspect().catch(err => {
  console.error('Inspection failed:', err);
  process.exit(1);
});

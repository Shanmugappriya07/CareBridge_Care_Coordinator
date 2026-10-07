require('dotenv').config();
const mysql = require('mysql2/promise');

async function runCleanup() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'carebridge_db',
    charset: 'utf8mb4'
  });

  console.log('Connected to carebridge_db.');
  console.log('Starting transactional database cleanup & reconciliation...\n');

  try {
    await conn.beginTransaction();

    // 1. Reconcile 26CAR004 to active ADMITTED status
    console.log('1. Reconciling authoritative admission 26CAR004 for Sunita Patel (26PAT0004)...');
    await conn.query(`
      UPDATE admissions 
      SET status = 'ADMITTED', 
          current_dept = 'Cardiology', 
          room_number = 'ICU Room 303', 
          attending_doctor = 'Dr. Aris Thorne', 
          discharge_date = NULL, 
          discharge_summary = NULL 
      WHERE admission_id = '26CAR004'
    `);

    await conn.query(`
      UPDATE patients 
      SET status = 'ADMITTED', 
          current_dept = 'Cardiology', 
          room_number = 'ICU Room 303', 
          attending_doctor = 'Dr. Aris Thorne' 
      WHERE admission_id = '26CAR004'
    `);

    // 2. Remove child records of obsolete duplicate admission 26CAR003
    console.log('2. Removing child records of obsolete duplicate admission 26CAR003...');
    const [delRx] = await conn.query("DELETE FROM prescriptions WHERE admission_id = '26CAR003'");
    console.log(`   - Deleted ${delRx.affectedRows} prescriptions`);

    const [delLab] = await conn.query("DELETE FROM lab_reports WHERE admission_id = '26CAR003'");
    console.log(`   - Deleted ${delLab.affectedRows} lab reports`);

    const [delPhm] = await conn.query("DELETE FROM pharmacy_transactions WHERE admission_id = '26CAR003'");
    console.log(`   - Deleted ${delPhm.affectedRows} pharmacy transactions`);

    const [delApp] = await conn.query("DELETE FROM doctor_appointments WHERE admission_id = '26CAR003'");
    console.log(`   - Deleted ${delApp.affectedRows} doctor appointments`);

    const [delPt] = await conn.query("DELETE FROM patient_transfers WHERE admission_id = '26CAR003'");
    console.log(`   - Deleted ${delPt.affectedRows} patient transfers`);

    const [delBs] = await conn.query("DELETE FROM billing_summary WHERE admission_id = '26CAR003'");
    console.log(`   - Deleted ${delBs.affectedRows} billing summary rows`);

    // 3. Delete obsolete admission 26CAR003 from patients and admissions
    console.log('3. Deleting obsolete admission 26CAR003 from admissions and patients tables...');
    const [delPat] = await conn.query("DELETE FROM patients WHERE admission_id = '26CAR003'");
    console.log(`   - Deleted ${delPat.affectedRows} rows from patients table`);

    const [delAdm] = await conn.query("DELETE FROM admissions WHERE admission_id = '26CAR003'");
    console.log(`   - Deleted ${delAdm.affectedRows} rows from admissions table`);

    const [delSeq] = await conn.query("DELETE FROM id_sequences WHERE seq_prefix = '26CAR003'");
    console.log(`   - Deleted ${delSeq.affectedRows} sequence rows`);

    // 4. Remove stale / cross-department test appointments for 26CAR007 (Year 2030)
    console.log('4. Removing obsolete test appointments in year 2030 for 26CAR007...');
    const [delTestApp] = await conn.query("DELETE FROM doctor_appointments WHERE id IN (6, 7)");
    console.log(`   - Deleted ${delTestApp.affectedRows} stale test appointments`);

    // 5. Remove obsolete test caregiver relationships from admission_caregivers
    console.log('5. Removing obsolete secondary caregiver test records...');
    const [delCg] = await conn.query("DELETE FROM admission_caregivers WHERE id IN (1, 2)");
    console.log(`   - Deleted ${delCg.affectedRows} test caregiver rows`);

    // 6. Clean redundant automated test transfer logs for 26CAR007
    console.log('6. Cleaning redundant test transfer logs for 26CAR007...');
    const [delTransfers] = await conn.query("DELETE FROM patient_transfers WHERE admission_id = '26CAR007'");
    console.log(`   - Deleted ${delTransfers.affectedRows} test transfer logs`);

    await conn.commit();
    console.log('\nTRANSACTION COMMITTED SUCCESSFULLY!\n');
  } catch (err) {
    await conn.rollback();
    console.error('Error during cleanup, transaction rolled back:', err);
    throw err;
  }

  // --- POST-CLEANUP VERIFICATION ---
  console.log('=== VERIFYING DATABASE RELATIONSHIPS POST-CLEANUP ===');

  // 1. Patient -> Admission -> Caregiver
  console.log('\n--- 1. Patient -> Admission -> Caregiver ---');
  const [pac] = await conn.query(`
    SELECT pm.patient_id, pm.full_name, a.admission_id, a.current_dept, a.room_number, a.status as adm_status,
           a.caregiver_name, a.caregiver_phone, a.relation, a.carebridge_status
    FROM patients_master pm
    JOIN admissions a ON pm.patient_id = a.patient_id
    ORDER BY pm.patient_id, a.admission_id
  `);
  console.table(pac);

  // 2. Patient -> Doctor Appointment
  console.log('\n--- 2. Patient -> Doctor Appointment ---');
  const [pda] = await conn.query(`
    SELECT da.id, da.patient_id, pm.full_name as patient_name, da.admission_id, 
           da.doctor_name, da.department, da.appointment_date, da.status
    FROM doctor_appointments da
    JOIN patients_master pm ON da.patient_id = pm.patient_id
    ORDER BY da.id
  `);
  console.table(pda);

  // 3. Admission -> Prescription
  console.log('\n--- 3. Admission -> Prescription ---');
  const [ap] = await conn.query(`
    SELECT pr.id, pr.admission_id, pr.name, pr.dosage, pr.status
    FROM prescriptions pr
    ORDER BY pr.admission_id, pr.id
  `);
  console.table(ap);

  // 4. Admission -> Treatment
  console.log('\n--- 4. Admission -> Treatment ---');
  const [at] = await conn.query(`
    SELECT t.id, t.admission_id, t.doctor_name, t.dept, t.date_label
    FROM treatments t
    ORDER BY t.admission_id, t.id
  `);
  console.table(at);

  // 5. Admission -> Lab
  console.log('\n--- 5. Admission -> Lab ---');
  const [al] = await conn.query(`
    SELECT l.id, l.admission_id, l.title, l.category, l.status
    FROM lab_reports l
    ORDER BY l.admission_id, l.id
  `);
  console.table(al);

  // 6. Admission -> Pharmacy
  console.log('\n--- 6. Admission -> Pharmacy ---');
  const [aph] = await conn.query(`
    SELECT ph.id, ph.tx_id, ph.admission_id, ph.medicine_name, ph.quantity, ph.total_amount, ph.payment_status
    FROM pharmacy_transactions ph
    ORDER BY ph.admission_id, ph.id
  `);
  console.table(aph);

  // 7. Admission -> Billing & Payment
  console.log('\n--- 7. Admission -> Billing & Payment ---');
  const [ab] = await conn.query(`
    SELECT bs.admission_id, bs.total_bill, bs.insurance_covered, bs.remaining_payable, bs.claim_status,
           COUNT(bi.id) as bill_items_count,
           COALESCE(SUM(pay.amount), 0) as total_payments
    FROM billing_summary bs
    LEFT JOIN bill_items bi ON bs.admission_id = bi.admission_id
    LEFT JOIN payments pay ON bs.admission_id = pay.admission_id AND LOWER(pay.status) = 'paid'
    GROUP BY bs.admission_id, bs.total_bill, bs.insurance_covered, bs.remaining_payable, bs.claim_status
    ORDER BY bs.admission_id
  `);
  console.table(ab);

  // Check for any remaining orphaned records
  console.log('\n--- Checking for any remaining orphaned records ---');
  const tables = ['prescriptions', 'treatments', 'lab_reports', 'pharmacy_transactions', 'doctor_appointments', 'bill_items', 'billing_summary', 'payments', 'patient_transfers'];
  let orphanFound = false;
  for (const t of tables) {
    const [orphans] = await conn.query(`
      SELECT t.* FROM ${t} t 
      LEFT JOIN admissions a ON t.admission_id = a.admission_id 
      WHERE a.admission_id IS NULL
    `);
    if (orphans.length > 0) {
      orphanFound = true;
      console.log(`⚠️  ${t} has ${orphans.length} orphaned rows`);
    }
  }
  if (!orphanFound) {
    console.log('✓  All child tables have 0 orphaned records!');
  }

  await conn.end();
  console.log('\nCleanup and reconciliation completed successfully!');
}

runCleanup().catch(err => {
  console.error('Fatal cleanup error:', err);
  process.exit(1);
});

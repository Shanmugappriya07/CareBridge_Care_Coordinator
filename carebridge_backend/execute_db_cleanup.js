require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'carebridge_db',
  });

  console.log('=== STARTING DATABASE DUPLICATE CLEANUP ===');

  // 1. Clean duplicate prescriptions
  console.log('1. Cleaning duplicate prescriptions...');
  const [rxDups] = await pool.query(`
    SELECT admission_id, name, dosage, MIN(id) as keep_id, GROUP_CONCAT(id) as all_ids, COUNT(*) as cnt
    FROM prescriptions
    GROUP BY admission_id, name, dosage
    HAVING cnt > 1
  `);
  for (const dup of rxDups) {
    const allIds = dup.all_ids.split(',');
    const idsToDelete = allIds.filter(id => id !== dup.keep_id);
    if (idsToDelete.length > 0) {
      console.log(`Deleting duplicate prescriptions: ${idsToDelete.join(', ')} (keeping ${dup.keep_id})`);
      await pool.query('DELETE FROM prescriptions WHERE id IN (?)', [idsToDelete]);
    }
  }

  // 2. Clean duplicate / invalid bill items
  console.log('2. Cleaning duplicate / invalid bill items...');
  // Delete known hacked room rent
  await pool.query("DELETE FROM bill_items WHERE description LIKE '%Hacked%'");

  const [billDups] = await pool.query(`
    SELECT admission_id, description, amount, MIN(id) as keep_id, GROUP_CONCAT(id) as all_ids, COUNT(*) as cnt
    FROM bill_items
    GROUP BY admission_id, description, amount
    HAVING cnt > 1
  `);
  for (const dup of billDups) {
    const allIds = dup.all_ids.split(',').map(Number);
    const idsToDelete = allIds.filter(id => id !== dup.keep_id);
    if (idsToDelete.length > 0) {
      console.log(`Deleting duplicate bill items: ${idsToDelete.join(', ')} (keeping ${dup.keep_id})`);
      await pool.query('DELETE FROM bill_items WHERE id IN (?)', [idsToDelete]);
    }
  }

  // 3. Recalculate billing_summary for all admissions
  console.log('3. Recalculating billing_summary totals...');
  const [admissions] = await pool.query('SELECT admission_id FROM admissions');
  for (const adm of admissions) {
    const admId = adm.admission_id;
    const [sumRows] = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM bill_items WHERE admission_id = ?',
      [admId]
    );
    const totalBill = Number(sumRows[0]?.total || 0);

    const [paidRows] = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) as paid FROM payments WHERE admission_id = ? AND LOWER(status) = 'paid'",
      [admId]
    );
    const paidAmount = Number(paidRows[0]?.paid || 0);

    const [curSummary] = await pool.query('SELECT insurance_covered FROM billing_summary WHERE admission_id = ?', [admId]);
    const insurance = Number(curSummary[0]?.insurance_covered || 0);
    const remaining = Math.max(0, totalBill - insurance - paidAmount);

    await pool.query(
      `INSERT INTO billing_summary (admission_id, total_bill, insurance_covered, remaining_payable, claim_status)
       VALUES (?, ?, ?, ?, 'Approved')
       ON DUPLICATE KEY UPDATE total_bill = VALUES(total_bill), remaining_payable = VALUES(remaining_payable)`,
      [admId, totalBill, insurance, remaining]
    );
  }

  // 4. Clean duplicate patient transfers
  console.log('4. Cleaning duplicate patient transfers...');
  const [transDups] = await pool.query(`
    SELECT admission_id, from_room, to_room, from_dept, to_dept, MIN(id) as keep_id, GROUP_CONCAT(id) as all_ids, COUNT(*) as cnt
    FROM patient_transfers
    GROUP BY admission_id, from_room, to_room, from_dept, to_dept
    HAVING cnt > 1
  `);
  for (const dup of transDups) {
    const allIds = dup.all_ids.split(',').map(Number);
    const idsToDelete = allIds.filter(id => id !== dup.keep_id);
    if (idsToDelete.length > 0) {
      console.log(`Deleting duplicate transfers: ${idsToDelete.join(', ')} (keeping ${dup.keep_id})`);
      await pool.query('DELETE FROM patient_transfers WHERE id IN (?)', [idsToDelete]);
    }
  }

  // 5. Clean duplicate patients: merge 26PAT0005 into 26PAT0004
  console.log('5. Merging duplicate patient profiles (26PAT0005 -> 26PAT0004)...');
  const [pat5] = await pool.query("SELECT * FROM patients_master WHERE patient_id = '26PAT0005'");
  if (pat5.length > 0) {
    console.log('Migrating references from 26PAT0005 to 26PAT0004...');
    await pool.query("UPDATE admissions SET patient_id = '26PAT0004' WHERE patient_id = '26PAT0005'");
    await pool.query("UPDATE patients SET patient_id = '26PAT0004' WHERE patient_id = '26PAT0005'");
    await pool.query("UPDATE lab_reports SET patient_id = '26PAT0004' WHERE patient_id = '26PAT0005'");
    await pool.query("UPDATE prescriptions SET patient_id = '26PAT0004' WHERE patient_id = '26PAT0005'");
    await pool.query("UPDATE pharmacy_transactions SET patient_id = '26PAT0004' WHERE patient_id = '26PAT0005'");
    await pool.query("UPDATE doctor_appointments SET patient_id = '26PAT0004' WHERE patient_id = '26PAT0005'");
    await pool.query("UPDATE patient_transfers SET patient_id = '26PAT0004' WHERE patient_id = '26PAT0005'");
    await pool.query("DELETE FROM patients_master WHERE patient_id = '26PAT0005'");
    console.log('26PAT0005 successfully merged and deleted from patients_master.');
  }

  // 6. Clean any duplicate lab reports in DB
  console.log('6. Checking duplicate lab reports...');
  const [labDups] = await pool.query(`
    SELECT admission_id, title, MIN(id) as keep_id, GROUP_CONCAT(id) as all_ids, COUNT(*) as cnt
    FROM lab_reports
    GROUP BY admission_id, title
    HAVING cnt > 1
  `);
  for (const dup of labDups) {
    const allIds = dup.all_ids.split(',');
    const idsToDelete = allIds.filter(id => id !== dup.keep_id);
    if (idsToDelete.length > 0) {
      console.log(`Deleting duplicate lab reports: ${idsToDelete.join(', ')} (keeping ${dup.keep_id})`);
      await pool.query('DELETE FROM lab_reports WHERE id IN (?)', [idsToDelete]);
    }
  }

  // 7. Verify all tables
  console.log('\n=== VERIFICATION AFTER CLEANUP ===');
  const [finalRx] = await pool.query('SELECT id, admission_id, name, dosage, is_collected FROM prescriptions');
  console.log('Prescriptions:', finalRx);

  const [finalBills] = await pool.query('SELECT id, admission_id, description, amount FROM bill_items');
  console.log('Bill Items:', finalBills);

  const [finalTrans] = await pool.query('SELECT id, admission_id, from_room, to_room FROM patient_transfers');
  console.log('Transfers:', finalTrans);

  const [finalPatients] = await pool.query('SELECT patient_id, full_name, patient_phone FROM patients_master');
  console.log('Patients Master:', finalPatients);

  const [finalLabs] = await pool.query('SELECT id, admission_id, patient_id, title FROM lab_reports');
  console.log('Lab Reports:', finalLabs);

  await pool.end();
  console.log('\n=== CLEANUP FINISHED SUCCESSFULLY ===');
}

main().catch(console.error);

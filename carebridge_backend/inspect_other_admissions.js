require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'carebridge_db',
    charset: 'utf8mb4',
  });

  const checkAdm = async (admId) => {
    console.log(`\n=================== ${admId} ===================`);
    const [adm] = await conn.query('SELECT * FROM admissions WHERE admission_id = ?', [admId]);
    console.log('Admission:', adm[0]);
    const [p] = await conn.query('SELECT * FROM patients WHERE admission_id = ?', [admId]);
    console.log('Patients table:', p[0]);
    const [rx] = await conn.query('SELECT id, name FROM prescriptions WHERE admission_id = ?', [admId]);
    console.log('Prescriptions:', rx);
    const [tr] = await conn.query('SELECT id, doctor_name, note FROM treatments WHERE admission_id = ?', [admId]);
    console.log('Treatments:', tr);
    const [lab] = await conn.query('SELECT id, title FROM lab_reports WHERE admission_id = ?', [admId]);
    console.log('Lab Reports:', lab);
    const [phm] = await conn.query('SELECT id, medicine_name FROM pharmacy_transactions WHERE admission_id = ?', [admId]);
    console.log('Pharmacy:', phm);
    const [app] = await conn.query('SELECT id, doctor_name, status FROM doctor_appointments WHERE admission_id = ?', [admId]);
    console.log('Appointments:', app);
    const [bi] = await conn.query('SELECT id, description, amount FROM bill_items WHERE admission_id = ?', [admId]);
    console.log('Bill Items:', bi);
    const [bs] = await conn.query('SELECT * FROM billing_summary WHERE admission_id = ?', [admId]);
    console.log('Billing Summary:', bs);
    const [pay] = await conn.query('SELECT tx_id, amount FROM payments WHERE admission_id = ?', [admId]);
    console.log('Payments:', pay);
    const [cg] = await conn.query('SELECT * FROM admission_caregivers WHERE admission_id = ?', [admId]);
    console.log('Secondary Caregivers:', cg);
    const [pt] = await conn.query('SELECT id, from_room, to_room FROM patient_transfers WHERE admission_id = ?', [admId]);
    console.log('Transfers:', pt.length);
  };

  await checkAdm('26CAR002');
  await checkAdm('26PUL001');
  await checkAdm('26DRE001');
  await checkAdm('26MED001');
  await checkAdm('26CAR007');

  await conn.end();
})();

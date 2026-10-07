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

  console.log('=== 26CAR002 ===');
  const [adm] = await conn.query('SELECT * FROM admissions WHERE admission_id = ?', ['26CAR002']);
  console.log('Admission:', adm[0]);
  const [p] = await conn.query('SELECT * FROM patients WHERE admission_id = ?', ['26CAR002']);
  console.log('Patients table:', p[0]);
  const [rx] = await conn.query('SELECT * FROM prescriptions WHERE admission_id = ?', ['26CAR002']);
  console.log('Prescriptions:', rx);
  const [tr] = await conn.query('SELECT * FROM treatments WHERE admission_id = ?', ['26CAR002']);
  console.log('Treatments:', tr);
  const [lab] = await conn.query('SELECT * FROM lab_reports WHERE admission_id = ?', ['26CAR002']);
  console.log('Lab Reports:', lab);
  const [phm] = await conn.query('SELECT * FROM pharmacy_transactions WHERE admission_id = ?', ['26CAR002']);
  console.log('Pharmacy:', phm);
  const [app] = await conn.query('SELECT * FROM doctor_appointments WHERE admission_id = ?', ['26CAR002']);
  console.log('Appointments:', app);
  const [bi] = await conn.query('SELECT * FROM bill_items WHERE admission_id = ?', ['26CAR002']);
  console.log('Bill Items:', bi);
  const [bs] = await conn.query('SELECT * FROM billing_summary WHERE admission_id = ?', ['26CAR002']);
  console.log('Billing Summary:', bs);

  await conn.end();
})();

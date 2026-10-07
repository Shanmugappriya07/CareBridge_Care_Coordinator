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

  console.log('=== 26CAR003 RECORDS ===');
  const [rx3] = await conn.query('SELECT id, name, dosage, doctor, status FROM prescriptions WHERE admission_id = ?', ['26CAR003']);
  console.log('Prescriptions:', rx3);
  const [lab3] = await conn.query('SELECT id, title, category, status FROM lab_reports WHERE admission_id = ?', ['26CAR003']);
  console.log('Lab Reports:', lab3);
  const [phm3] = await conn.query('SELECT id, medicine_name, quantity, total_amount, payment_status FROM pharmacy_transactions WHERE admission_id = ?', ['26CAR003']);
  console.log('Pharmacy:', phm3);
  const [app3] = await conn.query('SELECT id, doctor_name, department, appointment_date, status FROM doctor_appointments WHERE admission_id = ?', ['26CAR003']);
  console.log('Appointments:', app3);
  const [bi3] = await conn.query('SELECT id, description, category, amount FROM bill_items WHERE admission_id = ?', ['26CAR003']);
  console.log('Bill Items:', bi3);
  const [bs3] = await conn.query('SELECT * FROM billing_summary WHERE admission_id = ?', ['26CAR003']);
  console.log('Billing Summary:', bs3);
  const [pt3] = await conn.query('SELECT id, from_dept, to_dept, from_room, to_room, transfer_reason FROM patient_transfers WHERE admission_id = ?', ['26CAR003']);
  console.log('Transfers count:', pt3.length);

  console.log('\n=== 26CAR004 RECORDS ===');
  const [rx4] = await conn.query('SELECT id, name, dosage, doctor, status FROM prescriptions WHERE admission_id = ?', ['26CAR004']);
  console.log('Prescriptions:', rx4);
  const [lab4] = await conn.query('SELECT id, title, category, status FROM lab_reports WHERE admission_id = ?', ['26CAR004']);
  console.log('Lab Reports:', lab4);
  const [phm4] = await conn.query('SELECT id, medicine_name, quantity, total_amount, payment_status FROM pharmacy_transactions WHERE admission_id = ?', ['26CAR004']);
  console.log('Pharmacy:', phm4);
  const [app4] = await conn.query('SELECT id, doctor_name, department, appointment_date, status FROM doctor_appointments WHERE admission_id = ?', ['26CAR004']);
  console.log('Appointments:', app4);
  const [bi4] = await conn.query('SELECT id, description, category, amount FROM bill_items WHERE admission_id = ?', ['26CAR004']);
  console.log('Bill Items:', bi4);
  const [bs4] = await conn.query('SELECT * FROM billing_summary WHERE admission_id = ?', ['26CAR004']);
  console.log('Billing Summary:', bs4);
  const [pay4] = await conn.query('SELECT tx_id, method, amount, status FROM payments WHERE admission_id = ?', ['26CAR004']);
  console.log('Payments:', pay4);

  await conn.end();
})();

const mysql = require('./node_modules/mysql2/promise');

async function inspectKumar() {
  const pool = mysql.createPool({ host: 'localhost', user: 'root', password: 'root', database: 'carebridge_db' });
  const [adm] = await pool.query("SELECT * FROM admissions WHERE patient_id = '26PAT0009'");
  console.log('Admission for Kumar:', adm);
  const [transfers] = await pool.query("SELECT * FROM patient_transfers WHERE patient_id = '26PAT0009'");
  console.log('Transfers for Kumar:', transfers);
  await pool.end();
}

inspectKumar();

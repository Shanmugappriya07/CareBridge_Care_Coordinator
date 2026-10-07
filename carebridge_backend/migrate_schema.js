require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'carebridge_db'
  });

  async function addCol(table, col, def) {
    const [cols] = await conn.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [col]);
    if (cols.length === 0) {
      await conn.query(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
      console.log(`Added ${col} to ${table}`);
    } else {
      console.log(`${col} already in ${table}`);
    }
  }

  await addCol('patients_master', 'dob', 'DATE DEFAULT NULL');
  await addCol('patients', 'dob', 'DATE DEFAULT NULL');
  await addCol('lab_reports', 'file_url', 'VARCHAR(255) DEFAULT NULL');
  await addCol('lab_reports', 'file_name', 'VARCHAR(255) DEFAULT NULL');
  await addCol('medicine_master', 'dosage_unit', "VARCHAR(32) DEFAULT 'mg'");
  await addCol('prescriptions', 'group_id', 'VARCHAR(64) DEFAULT NULL');
  await addCol('prescriptions', 'payment_status', "VARCHAR(32) DEFAULT 'UNPAID'");

  // Update dosage units in medicine_master
  const units = [
    { name: 'Ceftriaxone 1g Injection (IV)', unit: 'g' },
    { name: 'Atorvastatin 20mg Tablet', unit: 'mg' },
    { name: 'Atorvastatin 40mg', unit: 'mg' },
    { name: 'Metformin 500mg Tablet', unit: 'mg' },
    { name: 'Amlodipine 5mg Tablet', unit: 'mg' },
    { name: 'Pantoprazole 40mg Tablet', unit: 'mg' },
    { name: 'Amoxicillin 500mg Capsule', unit: 'mg' },
    { name: 'Paracetamol 500mg Tablet', unit: 'mg' },
    { name: 'Azithromycin 250mg Tablet', unit: 'mg' },
    { name: 'Ondansetron 4mg Injection (IV)', unit: 'mg' },
    { name: 'Heparin 5000 IU Injection (SC)', unit: 'IU' },
    { name: 'Insulin Glargine 10 Units (SC)', unit: 'IU' },
    { name: 'Furosemide 40mg Tablet', unit: 'mg' },
    { name: 'Metoprolol 25mg Tablet', unit: 'mg' },
    { name: 'Salbutamol 2.5mg Nebulisation', unit: 'mg' },
    { name: 'Dexamethasone 4mg Injection (IV)', unit: 'mg' }
  ];

  for (const u of units) {
    await conn.query('UPDATE medicine_master SET dosage_unit = ? WHERE name = ?', [u.unit, u.name]);
  }
  console.log('Updated medicine_master dosage_units.');

  // Set existing group_id to id for existing prescriptions if NULL
  await conn.query('UPDATE prescriptions SET group_id = id WHERE group_id IS NULL');
  console.log('Backfilled prescription group_ids.');

  // Map any existing "Others" gender to "Transgender"
  await conn.query("UPDATE patients_master SET age_gender = REPLACE(age_gender, 'Other', 'Transgender') WHERE age_gender LIKE '%Other%'");
  await conn.query("UPDATE patients SET age_gender = REPLACE(age_gender, 'Other', 'Transgender') WHERE age_gender LIKE '%Other%'");
  console.log('Updated gender Other -> Transgender in patients.');

  await conn.end();
  console.log('Migration complete!');
}

migrate().catch(console.error);

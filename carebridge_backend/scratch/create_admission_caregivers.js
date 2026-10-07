const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'carebridge_db'
  });

  console.log('Connected to MySQL. Creating admission_caregivers table...');

  await conn.query(`
    CREATE TABLE IF NOT EXISTS admission_caregivers (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      admission_id VARCHAR(64) NOT NULL,
      caregiver_name VARCHAR(160) NOT NULL,
      caregiver_mobile VARCHAR(40) NOT NULL,
      relationship VARCHAR(80) NOT NULL DEFAULT 'Extended Family Member',
      access_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      role VARCHAR(32) NOT NULL DEFAULT 'READ_ONLY',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      disabled_at TIMESTAMP NULL,
      CONSTRAINT uq_admission_caregiver UNIQUE (admission_id, caregiver_mobile),
      INDEX idx_caregiver_mobile (caregiver_mobile),
      INDEX idx_caregiver_adm (admission_id),
      FOREIGN KEY (admission_id) REFERENCES admissions(admission_id) ON DELETE CASCADE
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log('admission_caregivers table created successfully!');

  // Check table description
  const [desc] = await conn.query('DESCRIBE admission_caregivers');
  console.log('Columns:', desc.map(d => `${d.Field} (${d.Type})`));

  await conn.end();
}

main().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});

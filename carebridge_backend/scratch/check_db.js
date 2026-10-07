const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'carebridge_db'
  });

  const [tables] = await conn.query("SHOW TABLES LIKE 'admission_caregivers'");
  console.log('admission_caregivers exists:', tables.length > 0);

  const [allTables] = await conn.query("SHOW TABLES");
  console.log('All tables:', allTables.map(t => Object.values(t)[0]));

  await conn.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

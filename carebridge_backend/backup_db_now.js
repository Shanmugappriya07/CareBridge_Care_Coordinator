require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');

async function backup() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'carebridge_db',
    charset: 'utf8mb4'
  });

  const [tables] = await conn.query('SHOW TABLES');
  const tableNames = tables.map(r => Object.values(r)[0]);
  let sql = '-- CAREBRIDGE_DB FULL BACKUP CREATED ' + new Date().toISOString() + '\n\n';

  for (const t of tableNames) {
    const [rows] = await conn.query('SELECT * FROM ' + t);
    sql += '-- Table: ' + t + ' (' + rows.length + ' rows)\n';
    if (rows.length > 0) {
      const keys = Object.keys(rows[0]);
      for (const r of rows) {
        const vals = keys.map(k => {
          const v = r[k];
          if (v === null || v === undefined) return 'NULL';
          if (v instanceof Date) return "'" + v.toISOString().slice(0, 19).replace('T', ' ') + "'";
          if (typeof v === 'number') return v;
          return "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";
        });
        sql += 'INSERT INTO ' + t + ' (' + keys.join(', ') + ') VALUES (' + vals.join(', ') + ');\n';
      }
    }
    sql += '\n';
  }

  fs.writeFileSync('carebridge_db_backup_20261005.sql', sql);
  console.log('Backup written successfully to carebridge_db_backup_20261005.sql (' + sql.length + ' bytes)');
  await conn.end();
}

backup().catch(console.error);

const mysql = require('./node_modules/mysql2/promise');

async function seedRoomTariffs() {
  console.log('============================================================');
  console.log('SEEDING STANDARD ROOM TARIFFS INTO CAREBRIDGE DATABASE');
  console.log('============================================================\n');

  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'carebridge_db',
    waitForConnections: true,
    connectionLimit: 5,
    charset: 'utf8mb4'
  });

  const tariffs = [
    {
      room_type: 'ICU',
      display_name: 'Critical Care / ICU',
      daily_rate: 12000.00,
      description: 'Intensive Care Unit / Critical Care bed daily charge'
    },
    {
      room_type: 'DELUXE',
      display_name: 'Deluxe Room / Suite',
      daily_rate: 5500.00,
      description: 'Premium private air-conditioned room with attendant bed'
    },
    {
      room_type: 'PRIVATE',
      display_name: 'Private Room',
      daily_rate: 3500.00,
      description: 'Standard single private room with attached bathroom'
    },
    {
      room_type: 'SEMI-PRIVATE',
      display_name: 'Semi-Private Room',
      daily_rate: 2200.00,
      description: 'Twin-sharing room with shared facilities'
    },
    {
      room_type: 'WARD',
      display_name: 'General Ward Bed',
      daily_rate: 1200.00,
      description: 'Multi-bed general and specialty ward accommodation'
    }
  ];

  try {
    for (const t of tariffs) {
      await pool.query(
        `INSERT INTO room_tariffs (room_type, display_name, daily_rate, description)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           display_name = VALUES(display_name),
           daily_rate = VALUES(daily_rate),
           description = VALUES(description)`,
        [t.room_type, t.display_name, t.daily_rate, t.description]
      );
      console.log(`[OK] Configured tariff: ${t.display_name} (${t.room_type}) -> ₹${t.daily_rate.toFixed(2)}/day`);
    }

    console.log('\n--- VERIFYING CURRENT ROOM TARIFFS IN DATABASE ---');
    const [rows] = await pool.query('SELECT id, room_type, display_name, daily_rate, description FROM room_tariffs ORDER BY id ASC');
    console.table(rows);

    console.log('\n✅ Successfully seeded standard room tariffs!');
  } catch (err) {
    console.error('❌ Error seeding room tariffs:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedRoomTariffs();

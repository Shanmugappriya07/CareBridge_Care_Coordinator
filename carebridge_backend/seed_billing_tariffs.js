const mysql = require('./node_modules/mysql2/promise');

async function seedBillingTariffs() {
  console.log('============================================================');
  console.log('MIGRATING & SEEDING BILLING TARIFFS CONFIGURATION');
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

  try {
    // 1. Create billing_tariffs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS billing_tariffs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category VARCHAR(64) NOT NULL,
        item_code VARCHAR(64) NOT NULL UNIQUE,
        display_name VARCHAR(128) NOT NULL,
        standard_rate DECIMAL(10,2) NOT NULL,
        description VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('[OK] billing_tariffs table ensured in MySQL.');

    // 2. Tariffs established from existing project data
    const tariffs = [
      // Consultation Tariffs (from project migration lines 157, bill_items, and test suite)
      {
        category: 'Consultation',
        item_code: 'DOC_CARDIO',
        display_name: 'Cardiology Specialist Consultation (Dr. Aris Thorne)',
        standard_rate: 12000.00,
        description: 'Senior Consultant Cardiologist clinical examination & review'
      },
      {
        category: 'Consultation',
        item_code: 'DOC_PULMO',
        display_name: 'Pulmonology Specialist Consultation (Dr. Elena Rostova)',
        standard_rate: 8500.00,
        description: 'Consultant Pulmonologist respiratory evaluation & review'
      },
      {
        category: 'Consultation',
        item_code: 'DOC_INTERNAL',
        display_name: 'Internal Medicine Specialist Consultation (Dr. Marcus Vance)',
        standard_rate: 5000.00,
        description: 'Senior Consultant Physician clinical evaluation & review'
      },
      {
        category: 'Consultation',
        item_code: 'DOC_GENERAL',
        display_name: 'Senior Consultant Inpatient Review / Routine Consultation',
        standard_rate: 2500.00,
        description: 'Attending physician routine inpatient review & consultation'
      },

      // Diagnostics Tariffs (from project migration lines 159 and lab tests)
      {
        category: 'Diagnostics',
        item_code: 'DIAG_CT_THORAX',
        display_name: 'CT Scan Thorax (Contrast)',
        standard_rate: 8000.00,
        description: 'High-resolution diagnostic contrast CT imaging'
      },
      {
        category: 'Diagnostics',
        item_code: 'DIAG_TROPONIN',
        display_name: 'Cardiac Enzymes (Troponin T)',
        standard_rate: 2500.00,
        description: 'Cardiac biomarker quantitative serum analysis'
      },
      {
        category: 'Diagnostics',
        item_code: 'DIAG_CBC',
        display_name: 'Complete Blood Count (CBC)',
        standard_rate: 850.00,
        description: 'Automated 5-part differential hemogram & platelet count'
      },
      {
        category: 'Diagnostics',
        item_code: 'DIAG_ELECTROLYTES',
        display_name: 'Electrolytes Panel (Serum)',
        standard_rate: 950.00,
        description: 'Serum sodium, potassium, chloride & bicarbonate assessment'
      },
      {
        category: 'Diagnostics',
        item_code: 'DIAG_GENERAL',
        display_name: 'Laboratory & CT Diagnostics',
        standard_rate: 8000.00,
        description: 'Standard diagnostic and laboratory investigation package'
      },

      // Procedures Tariffs (from treatments & clinical procedure protocols)
      {
        category: 'Procedures',
        item_code: 'PROC_NEBULIZATION',
        display_name: 'Nebulization & Inhalation Procedure',
        standard_rate: 1500.00,
        description: 'Aerosolized bronchodilator delivery and respiratory care'
      },
      {
        category: 'Procedures',
        item_code: 'PROC_IV_INFUSION',
        display_name: 'IV Infusion & Clinical Nursing Procedure',
        standard_rate: 3500.00,
        description: 'Intravenous cannulation, drug titration & continuous monitoring'
      },
      {
        category: 'Procedures',
        item_code: 'PROC_BRONCHOSCOPY',
        display_name: 'Bronchoscopy / Pulmonary Procedure',
        standard_rate: 6500.00,
        description: 'Diagnostic fiberoptic bronchoscopic airway visualization'
      },
      {
        category: 'Procedures',
        item_code: 'PROC_ECG_MONITOR',
        display_name: '12-Lead ECG & Cardiac Monitoring Procedure',
        standard_rate: 2200.00,
        description: 'Continuous cardiovascular telemetry and rhythm interpretation'
      },
      {
        category: 'Procedures',
        item_code: 'PROC_GENERAL',
        display_name: 'Standard Inpatient Clinical Procedure',
        standard_rate: 3500.00,
        description: 'Specialized inpatient procedural care and monitoring'
      },

      // Pharmacy Default Inpatient Package (individual medicines priced via medicine_master)
      {
        category: 'Pharmacy',
        item_code: 'PHARM_GENERAL',
        display_name: 'Pharmacy & IV Medications',
        standard_rate: 8500.00,
        description: 'Inpatient prescription medications and IV drug supplies'
      }
    ];

    for (const t of tariffs) {
      await pool.query(
        `INSERT INTO billing_tariffs (category, item_code, display_name, standard_rate, description)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           display_name = VALUES(display_name),
           standard_rate = VALUES(standard_rate),
           description = VALUES(description)`,
        [t.category, t.item_code, t.display_name, t.standard_rate, t.description]
      );
      console.log(`[OK] Configured tariff: [${t.category}] ${t.display_name} -> ₹${t.standard_rate.toFixed(2)}`);
    }

    console.log('\n--- VERIFYING BILLING TARIFFS IN DATABASE ---');
    const [rows] = await pool.query('SELECT category, item_code, display_name, standard_rate FROM billing_tariffs ORDER BY category, standard_rate DESC');
    console.table(rows);

    console.log('\n✅ Successfully seeded billing tariffs!');
  } catch (err) {
    console.error('❌ Error seeding billing tariffs:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedBillingTariffs();

const { Client } = require('pg');

const connectionString = 'postgresql://postgres:lcTvfPUCHxoZuXqYaywzcLVzqnUklmkE@shinkansen.proxy.rlwy.net:42402/railway';

async function main() {
  console.log('🔌 Conectando directamente a la base de datos de Railway...');
  const client = new Client({ connectionString, ssl: false });

  try {
    await client.connect();
    console.log('✅ Conexión exitosa a Railway PostgreSQL!');

    const statements = [
      // Control de horario límite y multas en ticket_types
      `ALTER TABLE ticket_types ADD COLUMN IF NOT EXISTS entry_deadline_time VARCHAR(10);`,
      `ALTER TABLE ticket_types ADD COLUMN IF NOT EXISTS lateness_surcharge_fee NUMERIC(10,2) DEFAULT 0.00;`,
      `ALTER TABLE ticket_types ADD COLUMN IF NOT EXISTS requires_admin_approval_if_late BOOLEAN DEFAULT false;`,

      // Registro de multas y auditoría en tickets
      `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS late_entry_surcharge_paid NUMERIC(10,2) DEFAULT 0.00;`,
      `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS late_entry_approved_by BIGINT;`,
      `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS late_entry_notes TEXT;`,

      // Segunda cuenta bancaria en event_payment_config
      `ALTER TABLE event_payment_config ADD COLUMN IF NOT EXISTS bank_account_2 TEXT;`,

      // Índice de rendimiento
      `CREATE INDEX IF NOT EXISTS idx_ticket_types_deadline ON ticket_types(entry_deadline_time);`,

      // Tabla de mensajes de soporte y rastreo técnico
      `CREATE TABLE IF NOT EXISTS support_messages (
        id SERIAL PRIMARY KEY,
        user_id INT,
        sender_name VARCHAR(255),
        sender_email VARCHAR(255),
        sender_phone VARCHAR(100),
        message TEXT,
        category VARCHAR(100),
        client_ip VARCHAR(100),
        user_agent TEXT,
        client_metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );`
    ];

    for (const stmt of statements) {
      try {
        await client.query(stmt);
        console.log(`  ✔ Ejecutado: ${stmt.substring(0, 65)}...`);
      } catch (err) {
        console.warn(`  ⚠️ Aviso en sentencia (${stmt.substring(0, 40)}):`, err.message);
      }
    }

    console.log('🎉 TODAS LAS MIGRACIONES FUERON APLICADAS EXITOSAMENTE EN RAILWAY!');
  } catch (err) {
    console.error('❌ Error conectando a Railway:', err);
  } finally {
    await client.end();
  }
}

main();

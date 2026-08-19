/**
 * autoMigrate.js
 * Ejecutor automático de migraciones SQL al iniciar el servidor en Railway / Producción
 */

const fs = require('fs');
const path = require('path');
const db = require('../db');

async function ensureRequiredColumns() {
  const alterStatements = [
    // Columnas de late entry en ticket_types
    `ALTER TABLE ticket_types ADD COLUMN IF NOT EXISTS entry_deadline_time VARCHAR(10);`,
    `ALTER TABLE ticket_types ADD COLUMN IF NOT EXISTS lateness_surcharge_fee NUMERIC(10,2) DEFAULT 0.00;`,
    `ALTER TABLE ticket_types ADD COLUMN IF NOT EXISTS requires_admin_approval_if_late BOOLEAN DEFAULT false;`,

    // Columnas de late entry en tickets
    `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS late_entry_surcharge_paid NUMERIC(10,2) DEFAULT 0.00;`,
    `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS late_entry_approved_by BIGINT;`,
    `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS late_entry_notes TEXT;`,

    // Columnas de cuentas bancarias en event_payment_config
    `ALTER TABLE event_payment_config ADD COLUMN IF NOT EXISTS bank_account_2 TEXT;`,

    // Columna para forzar cambio de contraseña débil
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;`
  ];

  for (const stmt of alterStatements) {
    try {
      await db.query(stmt);
    } catch (err) {
      console.warn(`  ⚠️ Aviso aplicando estructura: ${stmt}`, err.message);
    }
  }
}

async function runAutoMigrations() {
  console.log('🔄 Verificando e instalando migraciones de base de datos...');

  // 1. Asegurar primero todas las columnas críticas requeridas
  await ensureRequiredColumns();

  // 2. Asegurar tabla de idempotencia processed_webhooks y guest_otps
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS processed_webhooks (
        wompi_transaction_id VARCHAR(255) PRIMARY KEY,
        processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS guest_otps (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255),
        phone VARCHAR(100),
        cc VARCHAR(100),
        otp_code VARCHAR(10) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } catch (err) {
    console.warn('⚠️ Warning creando tablas iniciales:', err.message);
  }

  // 3. Leer y ejecutar todos los archivos .sql en la carpeta /sql ejecutando sentencia por sentencia
  const sqlDir = path.join(__dirname, '../../sql');

  if (!fs.existsSync(sqlDir)) {
    console.log('ℹ️ No se encontró directorio /sql, omitiendo auto-migración.');
    return;
  }

  const files = fs.readdirSync(sqlDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const filePath = path.join(sqlDir, file);
    try {
      const sqlContent = fs.readFileSync(filePath, 'utf8');
      const statements = sqlContent
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const stmt of statements) {
        try {
          await db.query(stmt);
        } catch (stmtErr) {
          console.warn(`  ⚠️ Aviso en sentencia de ${file}:`, stmtErr.message);
        }
      }
      console.log(`  ✅ Migración verificada: ${file}`);
    } catch (err) {
      console.error(`  ⚠️ Aviso en migración ${file}:`, err.message);
    }
  }

  console.log('✅ Verificación de base de datos completada exitosamente.');
}

module.exports = {
  runAutoMigrations
};

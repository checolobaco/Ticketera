/**
 * autoMigrate.js
 * Ejecutor automático de migraciones SQL al iniciar el servidor en Railway / Producción
 */

const fs = require('fs');
const path = require('path');
const db = require('../db');

async function runAutoMigrations() {
  console.log('🔄 Verificando e instalando migraciones de base de datos...');

  // 1. Asegurar tabla de idempotencia processed_webhooks
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS processed_webhooks (
        wompi_transaction_id VARCHAR(255) PRIMARY KEY,
        processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  } catch (err) {
    console.warn('⚠️ Warning creando processed_webhooks:', err.message);
  }

  // 2. Leer y ejecutar todos los archivos .sql en la carpeta /sql
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
      const sql = fs.readFileSync(filePath, 'utf8');
      if (sql.trim()) {
        await db.query(sql);
        console.log(`  ✅ Migración ejecutada: ${file}`);
      }
    } catch (err) {
      console.error(`  ⚠️ Aviso en migración ${file}:`, err.message);
    }
  }

  console.log('✅ Verificación de base de datos completada exitosamente.');
}

module.exports = {
  runAutoMigrations
};

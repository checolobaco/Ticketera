const { Client } = require('pg');

const connectionString = 'postgresql://postgres:lcTvfPUCHxoZuXqYaywzcLVzqnUklmkE@shinkansen.proxy.rlwy.net:42402/railway';

async function main() {
  console.log('🔌 Conectando a Railway PostgreSQL...');
  const client = new Client({ connectionString, ssl: false });

  try {
    await client.connect();
    console.log('✅ Conexión exitosa.');

    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;`);
    console.log('✔ Columna must_change_password verificada/creada en tabla users en Railway!');
  } catch (err) {
    console.warn('⚠️ Aviso:', err.message);
  } finally {
    await client.end();
  }
}

main();

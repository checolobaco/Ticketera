const { Pool } = require('pg');
const { db } = require('./config');

const pool = new Pool({
  connectionString: db.connectionString
});

async function query(text, params) {
  return pool.query(text, params);
}

async function getClient() {
  return pool.connect();
}

/**
 * Ejecuta `fn(client)` dentro de una transacción BEGIN/COMMIT.
 * Hace ROLLBACK automático si `fn` lanza. Siempre libera el cliente.
 *
 * @template T
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query,
  getClient,
  withTransaction,
};


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

module.exports = {
  pool,
  query,
  getClient
};

const db = require('../db');

async function deviceAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'NO_API_KEY' });
  }

  try {
    const { rows } = await db.query(
      'SELECT id, name, active FROM devices WHERE api_key = $1',
      [apiKey]
    );

    if (rows.length === 0 || !rows[0].active) {
      return res.status(401).json({ error: 'INVALID_DEVICE' });
    }

    req.device = { id: rows[0].id, name: rows[0].name };
    next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
}

module.exports = deviceAuth;

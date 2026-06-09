const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config');

const ACTION_AUDIENCE = 'admin-order-action';
const ACTION_ISSUER = 'cloudtickets';
const DEFAULT_EXPIRATION = '72h';

function createAdminOrderActionToken({ orderId, action, expiresIn = DEFAULT_EXPIRATION }) {
  return jwt.sign(
    {
      orderId: Number(orderId),
      action: String(action || '').trim().toUpperCase()
    },
    jwtSecret,
    {
      expiresIn,
      audience: ACTION_AUDIENCE,
      issuer: ACTION_ISSUER
    }
  );
}

function verifyAdminOrderActionToken(token) {
  return jwt.verify(token, jwtSecret, {
    audience: ACTION_AUDIENCE,
    issuer: ACTION_ISSUER
  });
}

function getFrontendBaseUrl() {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL.replace(/\/$/, '');

  if (process.env.WOMPI_REDIRECT_URL) {
    try {
      const url = new URL(process.env.WOMPI_REDIRECT_URL);
      return `${url.protocol}//${url.host}`;
    } catch (_) {}
  }

  return '';
}

module.exports = {
  createAdminOrderActionToken,
  verifyAdminOrderActionToken,
  getFrontendBaseUrl
};

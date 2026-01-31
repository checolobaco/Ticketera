const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config');


function auth(requiredRoles = []) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'NO_TOKEN' });
    }

    try {
      const payload = jwt.verify(token, jwtSecret);
      req.user = payload;

      if (requiredRoles.length && !requiredRoles.includes(payload.role)) {
        return res.status(403).json({ error: 'FORBIDDEN' });
      }

      next();
    } catch (err) {
      return res.status(401).json({ error: 'INVALID_TOKEN' });
    }
  };
}

module.exports = auth;

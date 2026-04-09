const crypto = require('crypto')
const { ticketSecret } = require('../config')

// 🔐 clave de encriptación (32 bytes)
const ENC_KEY = crypto
  .createHash('sha256')
  .update(ticketSecret)
  .digest()

const IV_LENGTH = 16 // AES requiere 16 bytes

/* =========================
   ENCRYPT / DECRYPT
========================= */

function encrypt(text) {
  if (!text) return null

  const iv = crypto.randomBytes(IV_LENGTH)

  const cipher = crypto.createCipheriv('aes-256-cbc', ENC_KEY, iv)

  let encrypted = cipher.update(text, 'utf8', 'base64')
  encrypted += cipher.final('base64')

  return {
    data: encrypted,
    iv: iv.toString('base64')
  }
}

function decrypt(data, iv) {
  if (!data || !iv) return null

  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    ENC_KEY,
    Buffer.from(iv, 'base64')
  )

  let decrypted = decipher.update(data, 'base64', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/* =========================
   TICKET SIGNING (YA TENÍAS)
========================= */

function signTicketPayload({ tid, eid, exp }) {
  const baseString = `${tid}|${eid}|${exp || ''}`

  return crypto
    .createHmac('sha256', ticketSecret)
    .update(baseString)
    .digest('hex')
}

function verifyTicketPayload({ tid, eid, exp, sig }) {
  const expected = signTicketPayload({ tid, eid, exp })

  const buffExpected = Buffer.from(expected, 'hex')
  const buffSig = Buffer.from(sig, 'hex')

  if (buffSig.length !== buffExpected.length) return false

  return crypto.timingSafeEqual(buffExpected, buffSig)
}

module.exports = {
  encrypt,
  decrypt,
  signTicketPayload,
  verifyTicketPayload
}
/*
const crypto = require('crypto');
const { ticketSecret } = require('../config');

function signTicketPayload({ tid, eid, exp }) {
  const baseString = `${tid}|${eid}|${exp || ''}`;
  const sig = crypto
    .createHmac('sha256', ticketSecret)
    .update(baseString)
    .digest('hex');

  return sig;
}

function verifyTicketPayload({ tid, eid, exp, sig }) {
  const expected = signTicketPayload({ tid, eid, exp });
  const buffExpected = Buffer.from(expected, 'hex');
  const buffSig = Buffer.from(sig, 'hex');

  if (buffSig.length !== buffExpected.length) return false;

  return crypto.timingSafeEqual(buffExpected, buffSig);
}

module.exports = {
  signTicketPayload,
  verifyTicketPayload
};
*/
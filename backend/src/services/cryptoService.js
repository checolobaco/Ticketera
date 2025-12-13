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

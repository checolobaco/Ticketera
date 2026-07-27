const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { sendSupportContactEmail } = require('../services/emailService');

// Rate limiter para prevenir spam en el chat de contacto (máximo 5 mensajes cada 15 minutos por IP)
const supportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Has enviado varios mensajes recientemente. Por favor aguarda unos minutos.'
  }
});

/**
 * POST /api/support/contact
 * Endpoint público para enviar mensajes desde el widget de chat de soporte al correo del administrador.
 */
router.post('/contact', supportLimiter, async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;

    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'MESSAGE_REQUIRED', message: 'El mensaje es requerido.' });
    }

    if (!email && !phone) {
      return res.status(400).json({ error: 'CONTACT_INFO_REQUIRED', message: 'Por favor proporciona un correo o teléfono para poder responderte.' });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      return res.status(400).json({ error: 'INVALID_EMAIL', message: 'El correo electrónico ingresado no es válido.' });
    }

    await sendSupportContactEmail({
      name: name ? String(name).trim() : 'Usuario',
      email: email ? String(email).trim() : '',
      phone: phone ? String(phone).trim() : '',
      message: String(message).trim()
    });

    return res.json({
      ok: true,
      message: '¡Tu mensaje ha sido enviado exitosamente! Te responderemos muy pronto a tu correo.'
    });
  } catch (error) {
    console.error('POST /api/support/contact error:', error);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'No se pudo enviar el mensaje en este momento. Por favor intenta más tarde.'
    });
  }
});

module.exports = router;

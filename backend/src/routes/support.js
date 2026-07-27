const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { sendSupportContactEmail } = require('../services/emailService');

// Rate limiter para prevenir spam (máximo 10 mensajes cada 15 minutos por IP)
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
 * Endpoint público para enviar mensajes desde el chat de soporte con auditoría forense/técnica.
 */
router.post('/contact', supportLimiter, async (req, res) => {
  try {
    const { category, name, email, phone, message, clientMetadata } = req.body;

    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'MESSAGE_REQUIRED', message: 'El mensaje es requerido.' });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      return res.status(400).json({ error: 'INVALID_EMAIL', message: 'El correo electrónico ingresado no es válido.' });
    }

    // Extraer metadatos técnicos de la petición (Auditoría / Hacking Ético)
    const rawIp = req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress || '';
    const ipAddress = String(rawIp).split(',')[0].trim();
    const userAgent = req.headers['user-agent'] || '';
    const acceptLanguage = req.headers['accept-language'] || '';
    const referer = req.headers['referer'] || req.headers['origin'] || '';

    const cleanCategory = category ? String(category).trim().toUpperCase() : 'VENTAS';
    const cleanName = name ? String(name).trim() : 'Usuario Anónimo';
    const cleanEmail = email ? String(email).trim() : '';
    const cleanPhone = phone ? String(phone).trim() : '';
    const cleanMessage = String(message).trim();

    // 1. Guardar en base de datos PostgreSQL para auditoría e historial técnico
    try {
      await db.query(`
        INSERT INTO support_messages (
          sender_name, sender_email, sender_phone, message,
          ip_address, user_agent, accept_language, referer, client_metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        cleanName,
        cleanEmail,
        cleanPhone,
        `[${cleanCategory}] ${cleanMessage}`,
        ipAddress,
        userAgent,
        acceptLanguage,
        referer,
        JSON.stringify({ category: cleanCategory, ...(clientMetadata || {}) })
      ]);
    } catch (dbErr) {
      console.warn('⚠️ Aviso guardando mensaje de soporte en BD:', dbErr.message);
    }

    // 2. Notificar por correo electrónico al administrador incluyendo metadatos técnicos de auditoría
    await sendSupportContactEmail({
      category: cleanCategory,
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      message: cleanMessage,
      ipAddress,
      userAgent,
      acceptLanguage,
      referer,
      clientMetadata
    });

    return res.json({
      ok: true,
      message: '¡Tu mensaje ha sido enviado exitosamente! Te responderemos muy pronto.'
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

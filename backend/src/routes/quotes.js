const express = require('express');
const router = express.Router();
const db = require('../db');
const { sendSupportContactEmail } = require('../services/emailService');

// POST /api/quotes - Solicitar Cotización de Evento
router.post('/', async (req, res) => {
  try {
    const {
      organizerName,
      organizerEmail,
      organizerPhone,
      eventType,
      estimatedCapacity,
      estimatedTicketPrice,
      targetDate,
      city,
      services,
      comments
    } = req.body;

    if (!organizerName || !organizerEmail) {
      return res.status(400).json({
        ok: false,
        message: 'El nombre y correo del organizador son obligatorios.'
      });
    }

    const servicesList = Array.isArray(services) ? services.join(', ') : (services || '');
    const formattedMessage = `
🎪 COTIZACIÓN DE EVENTO REQUERIDA:
• Organizador: ${organizerName}
• Tipo de Evento: ${eventType || 'No especificado'}
• Aforo Estimado: ${estimatedCapacity || 0} personas
• Precio Ticket Promedio: $${Number(estimatedTicketPrice || 0).toLocaleString('es-CO')} COP
• Recaudo Proyectado: $${(Number(estimatedCapacity || 0) * Number(estimatedTicketPrice || 0)).toLocaleString('es-CO')} COP
• Ciudad: ${city || 'No especificada'}
• Fecha Estimada: ${targetDate || 'No especificada'}
• Servicios Solicitados: ${servicesList || 'Venta online + QR'}
• Comentarios Adicionales: ${comments || 'Sin comentarios'}
    `.trim();

    // 1. Guardar en base de datos si existe la tabla
    try {
      await db.query(`
        INSERT INTO event_quotes (
          organizer_name, organizer_email, organizer_phone, event_type,
          estimated_capacity, estimated_ticket_price, target_date, city, services, comments
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        organizerName,
        organizerEmail,
        organizerPhone || '',
        eventType || 'CONCIERTO',
        Number(estimatedCapacity) || 0,
        Number(estimatedTicketPrice) || 0,
        targetDate || null,
        city || '',
        JSON.stringify(services || []),
        comments || ''
      ]);
    } catch (dbErr) {
      console.warn('⚠️ Aviso guardando event_quote en BD:', dbErr.message);
    }

    // 2. Enviar notificación por correo al administrador usando la misma lógica de soporte
    try {
      await sendSupportContactEmail({
        category: 'VENTAS',
        name: organizerName,
        email: organizerEmail,
        phone: organizerPhone,
        message: formattedMessage,
        clientMetadata: { type: 'EVENT_QUOTE', city, eventType }
      });
    } catch (emailErr) {
      console.error('⚠️ Aviso enviando email de cotización:', emailErr.message);
    }

    return res.json({
      ok: true,
      message: '¡Cotización enviada con éxito! Un asesor comercial se pondrá en contacto contigo muy pronto.'
    });
  } catch (error) {
    console.error('POST /api/quotes error:', error);
    return res.status(500).json({
      ok: false,
      message: 'No se pudo enviar la cotización en este momento. Por favor intenta más tarde.'
    });
  }
});

// POST /api/quotes/ads - Solicitar Anuncio o Patrocinio
router.post('/ads', async (req, res) => {
  try {
    const {
      advertiserName,
      advertiserEmail,
      advertiserPhone,
      adType,
      budgetRange,
      message
    } = req.body;

    if (!advertiserName || !advertiserEmail) {
      return res.status(400).json({
        ok: false,
        message: 'El nombre de la marca y el correo son obligatorios.'
      });
    }

    const formattedMessage = `
📢 SOLICITUD DE ESPACIO PUBLICITARIO / ANUNCIO:
• Marca / Empresa: ${advertiserName}
• Tipo de Espacio: ${adType || 'BANNER_HOME'}
• Presupuesto Estimado: ${budgetRange || 'No especificado'}
• Teléfono: ${advertiserPhone || 'No proporcionado'}
• Detalles de la propuesta: ${message || 'Sin detalles'}
    `.trim();

    // 1. Guardar en BD
    try {
      await db.query(`
        INSERT INTO ad_requests (
          advertiser_name, advertiser_email, advertiser_phone, ad_type, budget_range, message
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        advertiserName,
        advertiserEmail,
        advertiserPhone || '',
        adType || 'BANNER_HOME',
        budgetRange || '',
        message || ''
      ]);
    } catch (dbErr) {
      console.warn('⚠️ Aviso guardando ad_request en BD:', dbErr.message);
    }

    // 2. Notificar por correo
    try {
      await sendSupportContactEmail({
        category: 'VENTAS',
        name: advertiserName,
        email: advertiserEmail,
        phone: advertiserPhone,
        message: formattedMessage,
        clientMetadata: { type: 'AD_REQUEST', adType, budgetRange }
      });
    } catch (emailErr) {
      console.error('⚠️ Aviso enviando email de anuncio:', emailErr.message);
    }

    return res.json({
      ok: true,
      message: '¡Solicitud de anuncio enviada con éxito! Nos comunicaremos contigo a la brevedad.'
    });
  } catch (error) {
    console.error('POST /api/quotes/ads error:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al enviar la solicitud de anuncio.'
    });
  }
});

module.exports = router;

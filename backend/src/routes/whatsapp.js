const express = require('express');
const router = express.Router();
const { sendPDFWhatsApp, sendTicketsWhatsAppForOrder } = require('../services/whatsappService');

// GET: Validación del webhook por parte de Meta
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN || process.env.VERIFY_TOKEN;
  if (mode === 'subscribe' && token === expectedVerifyToken) {
    console.log('[WhatsApp Webhook] Validado correctamente por Meta.');
    return res.status(200).send(challenge);
  }
  console.warn('[WhatsApp Webhook] Intento de verificación fallido. Token no coincide.');
  res.sendStatus(403);
});

// POST: Recepción de eventos (entrega, lectura, respuestas)
router.post('/webhook', (req, res) => {
  console.log('[WhatsApp Webhook] Notificación recibida:', JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

// POST: Endpoint para enviar PDFs directos
router.post('/send-pdf', async (req, res) => {
  try {
    const result = await sendPDFWhatsApp(req.body);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.response ? error.response.data : error.message
    });
  }
});

// POST: Endpoint para procesar orden, generar PDF de tickets, subir a R2 y enviar por WhatsApp
router.post('/send-order-tickets', async (req, res) => {
  const { orderId, to, templateName, templateLanguage, bodyParameters } = req.body;

  if (!orderId) {
    return res.status(400).json({ error: 'Falta parámetro obligatorio "orderId"' });
  }

  try {
    const templateOptions = templateName ? { templateName, templateLanguage, bodyParameters } : null;
    const result = await sendTicketsWhatsAppForOrder(orderId, to, templateOptions);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

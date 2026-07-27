const express = require('express');
const router = express.Router();
const axios = require('axios');
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

// GET: Endpoint de diagnóstico para validar el Token y el Phone Number ID con Meta
router.get('/debug-token', async (req, res) => {
  const token = process.env.WHATSAPP_ACCESS_TOKEN || process.env.ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID;

  let tokenInfo = null;
  let phoneInfo = null;
  let phoneError = null;
  let wabaPhoneNumbers = null;
  let wabaError = null;

  try {
    const debugTokenUrl = `https://graph.facebook.com/v20.0/debug_token?input_token=${token}&access_token=${token}`;
    const debugTokenRes = await axios.get(debugTokenUrl);
    tokenInfo = debugTokenRes.data;
  } catch (err) {
    tokenInfo = err.response ? err.response.data : err.message;
  }

  try {
    const phoneUrl = `https://graph.facebook.com/v20.0/${phoneId}?access_token=${token}`;
    const phoneRes = await axios.get(phoneUrl);
    phoneInfo = phoneRes.data;
  } catch (err) {
    phoneError = err.response ? err.response.data : err.message;
  }

  try {
    const wabaId = '1342751060862041';
    const wabaUrl = `https://graph.facebook.com/v20.0/${wabaId}/phone_numbers?access_token=${token}`;
    const wabaRes = await axios.get(wabaUrl);
    wabaPhoneNumbers = wabaRes.data;
  } catch (err) {
    wabaError = err.response ? err.response.data : err.message;
  }

  res.json({
    phoneIdUsed: phoneId,
    tokenInfo,
    phoneInfo,
    phoneError,
    wabaPhoneNumbers,
    wabaError
  });
});

// GET: Endpoint para listar las plantillas aprobadas y sus códigos de idioma exactos
router.get('/list-templates', async (req, res) => {
  const token = process.env.WHATSAPP_ACCESS_TOKEN || process.env.ACCESS_TOKEN;
  const wabaIdProd = '1342751060862041';

  let specificTemplate = null;
  let allProdTemplates = null;

  try {
    const url1 = `https://graph.facebook.com/v20.0/${wabaIdProd}/message_templates?name=envio_ticket_pdf&access_token=${token}`;
    const res1 = await axios.get(url1);
    specificTemplate = res1.data;
  } catch (err) {
    specificTemplate = err.response ? err.response.data : err.message;
  }

  try {
    const url2 = `https://graph.facebook.com/v20.0/${wabaIdProd}/message_templates?status=PENDING,APPROVED,REJECTED,IN_APPEAL&limit=100&access_token=${token}`;
    const res2 = await axios.get(url2);
    allProdTemplates = res2.data;
  } catch (err) {
    allProdTemplates = err.response ? err.response.data : err.message;
  }

  res.json({
    specificTemplate,
    allProdTemplates
  });
});

module.exports = router;

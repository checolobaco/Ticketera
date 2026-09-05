const axios = require('axios');
const db = require('../db');
const puppeteer = require('puppeteer');
const QRCode = require('qrcode');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { buildTicketPdfHtml, PUPPETEER_LAUNCH_OPTIONS, QR_CENTER_LOGO_URL } = require('./emailService');

// Inicializar cliente R2/S3
const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

/**
 * Normaliza y limpia un número telefónico colombiano para WhatsApp API
 */
function sanitizePhoneNumber(phone) {
  if (!phone) return null;
  // Quitar cualquier carácter que no sea número
  let cleaned = String(phone).replace(/\D/g, '');
  // Si tiene 10 dígitos (ej. 3001234567), le anteponemos el código de país de Colombia (57)
  if (cleaned.length === 10) {
    cleaned = '57' + cleaned;
  }
  // Validar formato celular colombiano (debe tener 12 dígitos iniciando por 57)
  if (cleaned.length !== 12 || !cleaned.startsWith('57')) {
    throw new Error(`El número telefónico "${phone}" es inválido. Debe tener 10 dígitos (ejemplo: 3001234567).`);
  }
  return cleaned;
}

/**
 * Envía un mensaje de WhatsApp con un archivo PDF adjunto
 */
async function sendPDFWhatsApp({ to, pdfUrl, filename, caption, templateName, templateLanguage = 'es', bodyParameters = [] }) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || process.env.ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    throw new Error('Variables de entorno de WhatsApp (WHATSAPP_ACCESS_TOKEN o WHATSAPP_PHONE_NUMBER_ID) no configuradas.');
  }

  const cleanedTo = sanitizePhoneNumber(to);
  if (!cleanedTo) {
    throw new Error(`El número telefónico "${to}" no es válido.`);
  }

  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
  let payload = {};

  if (templateName) {
    // Escenario A: Mensaje de Plantilla con cabecera de tipo Documento
    payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanedTo,
      type: 'template',
      template: {
        name: templateName,
        language: { code: templateLanguage },
        components: [
          {
            type: 'header',
            parameters: [
              {
                type: 'document',
                document: { link: pdfUrl, filename }
              }
            ]
          }
        ]
      }
    };

    if (bodyParameters && bodyParameters.length > 0) {
      payload.template.components.push({
        type: 'body',
        parameters: bodyParameters.map(param => ({ type: 'text', text: String(param) }))
      });
    }
  } else {
    // Escenario B: Mensaje de sesión libre (ventana de 24h activa)
    payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanedTo,
      type: 'document',
      document: {
        link: pdfUrl,
        filename,
        caption: caption || ''
      }
    };
  }

  try {
    let response;
    let retries = 3;
    const httpsAgent = new (require('https').Agent)({ keepAlive: false, family: 4 });
    
    while (retries > 0) {
      try {
        response = await axios.post(url, payload, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Connection': 'close'
          },
          httpsAgent
        });
        break; // Éxito
      } catch (err) {
        retries--;
        // Si el error es de red (como ECONNRESET) o un error temporal 5xx, reintentamos
        if (retries > 0 && (!err.response || err.response.status >= 500 || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT')) {
          console.warn(`⚠️ Error de red enviando WhatsApp a ${cleanedTo} (${err.message}). Reintentando en 2s...`);
          await new Promise(res => setTimeout(res, 2000));
        } else {
          throw err;
        }
      }
    }

    return response.data;
  } catch (error) {
    const metaError = error?.response?.data?.error;
    if (metaError) {
      console.error('❌ Error devuelto por Meta WhatsApp Cloud API:', JSON.stringify(metaError, null, 2));
      if (metaError.code === 100 || metaError.error_subcode === 33) {
        console.error(`💡 PISTA DE CONFIGURACIÓN: El ID "${phoneNumberId}" configurado en WHATSAPP_PHONE_NUMBER_ID corresponde al WABA ID (WhatsApp Business Account ID), no al "Phone Number ID". Debes copiar el "ID del número de teléfono" desde el panel de Meta Developer.`);
      }
      if (metaError.code === 131047) {
        console.error(`💡 POLÍTICA DE 24h DE META (Error 131047): Han pasado más de 24 horas desde que el cliente escribió por última vez a este número de WhatsApp. Para enviar boletas e iniciar conversaciones fuera de las 24h, debes crear una Plantilla (Template) en Meta Developer Console y configurar WHATSAPP_TEMPLATE_NAME en Railway.`);
      }
    }
    throw error;
  }
}

/**
 * Flujo completo para un orderId: genera PDFs de tickets, los sube a Cloudflare R2 y los envía por WhatsApp
 */
async function sendTicketsWhatsAppForOrder(orderId, toPhoneNumberOverride = null, templateOptions = null) {
  let browser = null;
  try {
    // 1. Obtener la orden de la base de datos
    const { rows: orders } = await db.query(
      `SELECT id, buyer_name, buyer_email, buyer_phone, whatsapp_status FROM orders WHERE id = $1`, [orderId]
    );

    if (!orders.length) throw new Error('ORDEN_NO_ENCONTRADA');
    const order = orders[0];

    if (order.whatsapp_status === 'SENT' && !toPhoneNumberOverride) {
      console.log(`ℹ️ [WhatsApp] Las entradas de la orden #${orderId} ya fueron enviadas por WhatsApp anteriormente. Omitiendo duplicado.`);
      return { success: true, skipped: true, reason: 'ALREADY_SENT' };
    }

    // Determinar destinatario
    const recipient = sanitizePhoneNumber(toPhoneNumberOverride || order.buyer_phone);
    if (!recipient) {
      throw new Error(`La orden no contiene un número telefónico de comprador válido: "${order.buyer_phone}"`);
    }

    // 2. Obtener tickets asociados a la orden
    const { rows: tickets } = await db.query(
      `SELECT
          t.*,
          tt.name AS type_name,
          tt.entries_per_ticket,
          e.name AS event_name,
          e.start_datetime,
          e.ticket_image_url,
          COALESCE((
            SELECT json_agg(
              json_build_object(
                'id', bc.id,
                'benefit_name', bc.benefit_name,
                'benefit_description', bc.benefit_description,
                'total_quantity', bc.total_quantity,
                'redeemed_quantity', bc.redeemed_quantity,
                'status', bc.status
              )
              ORDER BY bc.id ASC
            )
            FROM ticket_benefit_claims bc
            WHERE bc.ticket_id = t.id
          ), '[]'::json) AS benefit_claims
      FROM tickets t
      JOIN ticket_types tt ON tt.id = t.ticket_type_id
      JOIN events e ON e.id = tt.event_id
      WHERE t.order_id = $1
      ORDER BY t.id ASC`,
      [orderId]
    );

    if (!tickets.length) throw new Error('LA_ORDEN_NO_TIENE_TICKETS');

    const bucket = process.env.R2_BUCKET;
    const publicBase = process.env.R2_PUBLIC_BASE_URL;

    if (!bucket || !publicBase) {
      throw new Error('Variables de entorno de Cloudflare R2 (R2_BUCKET o R2_PUBLIC_BASE_URL) no configuradas.');
    }

    // 3. Iniciar Puppeteer
    browser = await puppeteer.launch(PUPPETEER_LAUNCH_OPTIONS);
    const sentResults = [];

    // 4. Generar y subir cada ticket secuencialmente (Imágenes y QR nítidos en alta calidad)
    for (const t of tickets) {
      const page = await browser.newPage();
      const finalHolderName = order.buyer_name || 'Cliente';
      
      // QR nítido con nivel de corrección de error alto (Q) para soportar el logo central perfectamente sin borrosidad
      const qrDataUri = await QRCode.toDataURL(t.qr_payload || t.unique_code, { 
        margin: 1, 
        width: 500,
        errorCorrectionLevel: 'Q'
      });

      // Generar HTML
      const pdfHtml = buildTicketPdfHtml({
        order: { buyer_name: finalHolderName, buyer_email: order.buyer_email },
        ticket: t,
        qrDataUri,
        qrLogoUrl: QR_CENTER_LOGO_URL
      });

      // Esperar a que TODAS las imágenes externas (evento y logo del QR) carguen completamente
      await page.setContent(pdfHtml, { waitUntil: 'load', timeout: 60000 });

      // Optimización automática de peso: comprimir y reescalar imágenes pesadas en el DOM antes de generar el PDF
      await page.evaluate(async () => {
        const images = Array.from(document.querySelectorAll('img'));
        for (const img of images) {
          // No tocar el QR si ya es un data URI pequeño
          if (!img.src) continue;
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const maxDim = 700; // Máximo 700px para el banner o logos
            let w = img.naturalWidth || img.width || 700;
            let h = img.naturalHeight || img.height || 500;
            if (w > maxDim || h > maxDim) {
              if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
              canvas.width = w;
              canvas.height = h;
              ctx.drawImage(img, 0, 0, w, h);
              img.src = canvas.toDataURL('image/jpeg', 0.82);
            }
          } catch (e) {
            // Continuar si hay algún detalle de carga
          }
        }
      });
      
      // Renderizar el PDF con máxima nitidez y peso ultra reducido
      const pdfBytes = await page.pdf({
        width: '215.9mm',
        height: '170.7mm',
        printBackground: true,
        margin: { top: '4mm', bottom: '4mm', left: '4mm', right: '4mm' },
        preferCSSPageSize: true
      });
      await page.close();

      const pdfBuffer = Buffer.from(pdfBytes);
      const filename = `ticket-${t.id}-${t.unique_code}.pdf`;
      const key = `tickets/${orderId}/${filename}`;

      // 5. Subir a Cloudflare R2 con reintentos
      let r2Retries = 3;
      while (r2Retries > 0) {
        try {
          await r2Client.send(new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: pdfBuffer,
            ContentType: 'application/pdf'
          }));
          break; // Exito
        } catch (err) {
          r2Retries--;
          if (r2Retries === 0) throw err;
          console.warn(`⚠️ Error subiendo a R2 (intento fallido, reintentando en 1s): ${err.message}`);
          await new Promise(res => setTimeout(res, 1000));
        }
      }

      const pdfPublicUrl = `${publicBase}/${key}`;
      console.log(`[R2] Subido PDF del ticket ${t.id} a R2 exitosamente: ${pdfPublicUrl}`);

      // 6. Enviar por WhatsApp
      console.log(`[WhatsApp] Enviando ticket ${t.id} al número ${recipient}...`);
      
      const payloadOptions = {
        to: recipient,
        pdfUrl: pdfPublicUrl,
        filename: `Ticket_${t.id}_${t.type_name.replace(/\s+/g, '_')}.pdf`,
        caption: `¡Hola, ${finalHolderName}! Aquí tienes tu ticket digital para ${t.event_name}.`
      };

      const envTemplateName = process.env.WHATSAPP_TEMPLATE_NAME || 'envio_ticket_wallet';
      const envTemplateLang = process.env.WHATSAPP_TEMPLATE_LANG || 'es';
      
      const backendBaseUrl = process.env.BACKEND_URL || 'https://api.cloud-tickets.com';
      const walletUrl = `${backendBaseUrl}/api/tickets/${t.id}/wallet`;

      if (templateOptions && templateOptions.templateName) {
        payloadOptions.templateName = templateOptions.templateName;
        payloadOptions.templateLanguage = templateOptions.templateLanguage || envTemplateLang;
        payloadOptions.bodyParameters = templateOptions.bodyParameters || [finalHolderName, t.event_name, String(orderId), walletUrl];
      } else if (envTemplateName) {
        payloadOptions.templateName = envTemplateName;
        payloadOptions.templateLanguage = envTemplateLang;
        payloadOptions.bodyParameters = [finalHolderName, t.event_name, String(orderId), walletUrl];
      }

      const waResult = await sendPDFWhatsApp(payloadOptions);

      sentResults.push({
        ticketId: t.id,
        pdfUrl: pdfPublicUrl,
        whatsappMessageId: waResult?.messages?.[0]?.id
      });
    }

    // Marca la orden como enviada por WhatsApp en la BD para garantizar idempotencia
    await db.query(
      `UPDATE orders SET whatsapp_status = 'SENT', whatsapp_sent_at = NOW() WHERE id = $1`,
      [orderId]
    );

    return { success: true, results: sentResults };

  } catch (error) {
    const errorDetails = error.response?.data ? JSON.stringify(error.response.data, null, 2) : error.message;
    console.error(`❌ Error en sendTicketsWhatsAppForOrder para orden ${orderId}:`, errorDetails);
    throw new Error(errorDetails);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Envía un mensaje de texto de WhatsApp con el código OTP
 */
async function sendOTPWhatsApp({ toPhone, otpCode }) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || process.env.ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    console.warn('⚠️ Variables de entorno de WhatsApp no configuradas para envío de OTP.');
    return { success: false, reason: 'WHATSAPP_NOT_CONFIGURED' };
  }

  try {
    const cleanedTo = sanitizePhoneNumber(toPhone);
    if (!cleanedTo) return { success: false, reason: 'INVALID_PHONE' };

    const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanedTo,
      type: 'text',
      text: {
        preview_url: false,
        body: `🔑 *CloudTickets - Código de Verificación*\n\nTu código de acceso es: *${otpCode}*\n\nEste código vence en 10 minutos.`
      }
    };

    let response;
    let retries = 3;
    const httpsAgent = new (require('https').Agent)({ keepAlive: false, family: 4 });

    while (retries > 0) {
      try {
        response = await axios.post(url, payload, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Connection': 'close'
          },
          httpsAgent
        });
        break; // Éxito
      } catch (err) {
        retries--;
        if (retries > 0 && (!err.response || err.response.status >= 500 || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT')) {
          console.warn(`⚠️ Error de red enviando OTP por WhatsApp a ${cleanedTo} (${err.message}). Reintentando...`);
          await new Promise(res => setTimeout(res, 2000));
        } else {
          throw err;
        }
      }
    }

    console.log(`✅ Código OTP ${otpCode} enviado por WhatsApp a ${cleanedTo}`);
    return { success: true, data: response.data };
  } catch (err) {
    console.error(`❌ Error enviando OTP por WhatsApp a ${toPhone}:`, err?.response?.data || err.message);
    return { success: false, error: err?.response?.data || err.message };
  }
}

module.exports = {
  sendPDFWhatsApp,
  sendTicketsWhatsAppForOrder,
  sendOTPWhatsApp
};

// Backend/emailService.js
const { Resend } = require('resend');
const QRCode = require('qrcode');
const puppeteer = require('puppeteer');
const db = require('../db');

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Genera un PDF (Buffer) a partir de HTML usando Chromium (Puppeteer)
 * - NO requiere registerFont como node-canvas
 */
async function htmlToPdfBuffer(browser, html, opts = {}) {
  const page = await browser.newPage();

  // Tip: setViewport ayuda a que el render sea consistente
  await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 2 });

  await page.setContent(html, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: {
      top: '14mm',
      bottom: '14mm',
      left: '12mm',
      right: '12mm',
    },
    ...opts,
  });

  await page.close();
  return pdfBuffer;
}

function formatDateES(dateStr) {
  try {
    return new Date(dateStr).toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

/**
 * HTML para el PDF (1 ticket por PDF)
 * - Usa el mismo estilo “tarjeta bonita”
 * - Incluye QR embebido (data URI) para que el PDF sea autocontenido
 */
function buildTicketPdfHtml({ order, ticket, qrDataUri }) {
  const when = formatDateES(ticket.start_datetime);

  return `
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />

  <!-- Fuente web (opcional, pero mejora estética). Chromium la renderiza sin registerFont -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">

  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      background: #0B1220;
      padding: 24px;
    }
    .wrap { width: 100%; }
    .ticket {
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
      border-radius: 22px;
      overflow: hidden;
      background: #fff;
      border: 1px solid #E5E7EB;
      box-shadow: 0 18px 40px rgba(0,0,0,.25);
    }
    .stripe {
      height: 16px;
      background: linear-gradient(90deg, #2E6BFF 0%, #00D4FF 100%);
    }
    .content {
      padding: 22px 22px 18px 22px;
      display: grid;
      grid-template-columns: 1fr 220px;
      gap: 18px;
      align-items: start;
    }
    .title {
      margin: 0;
      font-size: 26px;
      line-height: 1.1;
      color: #0B1220;
      font-weight: 700;
    }
    .sub {
      margin: 8px 0 0 0;
      color: #4B5563;
      font-size: 13.5px;
    }
    .meta {
      margin-top: 18px;
      display: grid;
      gap: 6px;
      font-size: 14px;
      color: #111827;
    }
    .meta b { font-weight: 700; }
    .muted { color: #6B7280; font-size: 12px; margin-top: 12px; }
    .qrbox {
      background: #F3F4F6;
      border-radius: 16px;
      padding: 12px;
      width: 220px;
      display: grid;
      place-items: center;
      border: 1px solid #E5E7EB;
    }
    .qrbox img { width: 180px; height: 180px; border-radius: 10px; display: block; }
    .foot {
      padding: 12px 22px;
      border-top: 1px solid #E5E7EB;
      background: #F9FAFB;
      color: #6B7280;
      font-size: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .pill {
      display: inline-flex;
      gap: 8px;
      align-items: center;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(46,107,255,.10);
      color: #1D4ED8;
      font-size: 12px;
      font-weight: 600;
      margin-top: 12px;
      width: fit-content;
    }
  </style>
</head>

<body>
  <div class="wrap">
    <div class="ticket">
      <div class="stripe"></div>

      <div class="content">
        <div>
          <h1 class="title">${ticket.event_name || 'Evento'}</h1>
          <p class="sub">Tu acceso está listo. Presenta este QR en la entrada.</p>

          <div class="pill">🎟️ Ticket verificado</div>

          <div class="meta">
            <div><b>Titular:</b> ${order.buyer_name || '—'}</div>
            <div><b>Email:</b> ${order.buyer_email || '—'}</div>
            <div><b>Tipo:</b> ${ticket.type_name || '—'}</div>
            ${when ? `<div><b>Fecha:</b> ${when}</div>` : ''}
          </div>

          <div class="muted">Ticket #${ticket.id} • Código: <b>${ticket.unique_code || '—'}</b></div>
        </div>

        <div class="qrbox">
          <img src="${qrDataUri}" alt="QR Ticket" />
          <div class="muted" style="margin-top:10px; text-align:center;">
            Escanea en la entrada
          </div>
        </div>
      </div>

      <div class="foot">
        <span>CloudTickets • FunPass</span>
        <span>Orden #${order.id}</span>
      </div>
    </div>
  </div>
</body>
</html>
`;
}

/**
 * HTML del correo: header bonito + tarjetas HTML (con QR embebido)
 */
function buildEmailHtml({ order, eventName, ticketCardsHtml }) {
  return `
<!DOCTYPE html>
<html>
<body style="background:#F3F4F6;padding:20px;margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:640px;margin:0 auto;">
    <div style="background:#0B1220;padding:22px;border-radius:18px;text-align:left;box-shadow:0 10px 22px rgba(0,0,0,.12);">
      <div style="color:#fff;font-size:20px;font-weight:800;letter-spacing:.2px;">CloudTickets</div>
      <div style="color:#9CA3AF;margin-top:6px;font-size:13px;">Tus tickets están listos 🎟️</div>
    </div>

    <div style="padding:18px 4px 0 4px;">
      <p style="font-size:16px;color:#111827;margin:0 0 8px 0;">Hola <b>${order.buyer_name}</b>,</p>
      <p style="font-size:14px;color:#374151;margin:0 0 18px 0;">
        Aquí tienes tus pases para <b>${eventName}</b>. Te adjuntamos un PDF por cada ticket.
      </p>

      ${ticketCardsHtml}

      <div style="margin-top:16px;text-align:center;">
        <p style="color:#9CA3AF;font-size:12px;margin:0;">© 2026 CloudTickets. Todos los derechos reservados.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;
}

function buildTicketCardHtml({ order, ticket, qrDataUri }) {
  const when = formatDateES(ticket.start_datetime);

  return `
  <div style="background:#FFFFFF;border-radius:22px;overflow:hidden;margin:16px 0;border:1px solid #E5E7EB;box-shadow:0 6px 14px rgba(0,0,0,.08);">
    <div style="background:linear-gradient(90deg,#2E6BFF 0%,#00D4FF 100%);height:14px;"></div>
    <div style="padding:18px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align:top;">
            <div style="font-family:inherit;">
              <div style="font-size:20px;font-weight:800;color:#0B1220;margin:0 0 6px 0;">${ticket.event_name}</div>
              <div style="color:#4B5563;font-size:13px;margin:0 0 14px 0;">Presenta este QR en la entrada.</div>

              <div style="color:#111827;font-weight:700;font-size:14px;margin:0;">Titular: ${order.buyer_name}</div>
              <div style="color:#374151;font-size:13px;margin-top:4px;">Tipo: ${ticket.type_name}</div>
              ${when ? `<div style="color:#374151;font-size:13px;margin-top:4px;">Fecha: ${when}</div>` : ''}

              <div style="color:#6B7280;font-size:12px;margin-top:10px;">
                Ticket #${ticket.id} • Código: <b>${ticket.unique_code}</b>
              </div>
            </div>
          </td>

          <td style="width:160px;text-align:right;vertical-align:top;">
            <div style="background:#F3F4F6;padding:10px;border-radius:14px;display:inline-block;border:1px solid #E5E7EB;">
              <img src="${qrDataUri}" width="130" height="130" style="display:block;border-radius:10px;" alt="QR" />
            </div>
          </td>
        </tr>
      </table>
    </div>

    <div style="background:#F9FAFB;padding:10px 18px;border-top:1px solid #E5E7EB;">
      <span style="color:#6B7280;font-size:12px;font-weight:600;">CloudTickets • FunPass</span>
    </div>
  </div>
  `;
}

async function sendTicketsEmailForOrder(orderId) {
  // 1) Orden
  const { rows: orders } = await db.query(
    `SELECT id, buyer_name, buyer_email FROM orders WHERE id = $1`,
    [orderId]
  );

  if (!orders.length) return { error: 'Order not found' };
  const order = orders[0];

  // 2) Tickets de la orden
  const { rows: tickets } = await db.query(
    `SELECT t.id, t.unique_code, t.qr_payload, tt.name AS type_name,
            e.name AS event_name, e.start_datetime
     FROM tickets t
     JOIN ticket_types tt ON tt.id = t.ticket_type_id
     JOIN events e ON e.id = tt.event_id
     WHERE t.order_id = $1
     ORDER BY t.id ASC`,
    [orderId]
  );

  if (!tickets.length) return { error: 'No tickets for this order' };

  // 3) Lanzar Chromium una sola vez (más eficiente)
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const attachments = [];
    const cardBlocks = [];

    for (const t of tickets) {
      // QR embebido
      const qrDataUri = await QRCode.toDataURL(t.qr_payload, {
        margin: 1,
        width: 260,
        color: { dark: '#0B1220', light: '#FFFFFF' },
      });

      // Card bonita en el cuerpo del correo
      cardBlocks.push(buildTicketCardHtml({ order, ticket: t, qrDataUri }));

      // PDF individual por ticket
      const pdfHtml = buildTicketPdfHtml({ order, ticket: t, qrDataUri });
      const pdfBuffer = await htmlToPdfBuffer(browser, pdfHtml);

      attachments.push({
        filename: `ticket-${t.id}.pdf`,
        content: pdfBuffer.toString('base64'),
        contentType: 'application/pdf',
      });
    }

    const emailHtml = buildEmailHtml({
      order,
      eventName: tickets[0].event_name,
      ticketCardsHtml: cardBlocks.join(''),
    });

    // 4) Enviar correo con PDFs adjuntos
    await resend.emails.send({
      from: 'CloudTickets <no-reply@cloud-tickets.info>',
      to: [order.buyer_email],
      subject: `Tus tickets para ${tickets[0].event_name}`,
      html: emailHtml,
      attachments,
    });

    return { success: true, tickets: tickets.length };
  } finally {
    await browser.close();
  }
}

module.exports = { sendTicketsEmailForOrder };

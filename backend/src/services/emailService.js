const { Resend } = require('resend');
const QRCode = require('qrcode');
const puppeteer = require('puppeteer');
const db = require('../db');

const resend = new Resend(process.env.RESEND_API_KEY);

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

// ---------- HTML del correo (bonito) ----------
function buildEmailHtml({ buyerName, eventName, ticketCardsHtml }) {
  return `
<!doctype html>
<html>
<body style="margin:0;background:#F3F4F6;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:640px;margin:0 auto;">
    <div style="background:#0B1220;padding:22px;border-radius:18px;box-shadow:0 10px 22px rgba(0,0,0,.12);">
      <div style="color:#fff;font-size:20px;font-weight:800;">CloudTickets</div>
      <div style="color:#9CA3AF;margin-top:6px;font-size:13px;">Tus tickets están listos 🎟️</div>
    </div>

    <div style="padding:18px 4px 0 4px;">
      <p style="font-size:16px;color:#111827;margin:0 0 8px 0;">Hola <b>${buyerName}</b>,</p>
      <p style="font-size:14px;color:#374151;margin:0 0 18px 0;">
        Aquí tienes tus pases para <b>${eventName}</b>. Adjuntamos un PDF por cada ticket.
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

// Tarjeta del correo: OJO -> usa CID en el src del img (no base64)
function buildTicketCardHtml({ order, ticket, qrCid }) {
  const when = formatDateES(ticket.start_datetime);

  return `
  <div style="background:#FFFFFF;border-radius:22px;overflow:hidden;margin:16px 0;border:1px solid #E5E7EB;box-shadow:0 6px 14px rgba(0,0,0,.08);">
    <div style="background:linear-gradient(90deg,#2E6BFF 0%,#00D4FF 100%);height:14px;"></div>
    <div style="padding:18px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align:top;">
            <div>
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


        </tr>
      </table>
    </div>

    <div style="background:#F9FAFB;padding:10px 18px;border-top:1px solid #E5E7EB;">
      <span style="color:#6B7280;font-size:12px;font-weight:600;">CloudTickets • FunPass</span>
    </div>
  </div>
  `;
}

// ---------- PDF por ticket (HTML->PDF con Puppeteer) ----------
function buildTicketPdfHtml({ order, ticket, qrDataUri }) {
  const when = formatDateES(ticket.start_datetime);

  return `
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <style>
    *{box-sizing:border-box}
    body{
      margin:0;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      background:#F3F4F6;
      padding:18px;
    }
    .ticket{
      max-width:800px;
      margin:0 auto;
      background:#fff;
      border:1px solid #E5E7EB;
      border-radius:22px;
      overflow:hidden;
      box-shadow:0 12px 30px rgba(0,0,0,.12);
    }
    .stripe{height:16px;background:linear-gradient(90deg,#2E6BFF 0%,#00D4FF 100%);}
    .content{padding:18px;display:grid;grid-template-columns:1fr 220px;gap:16px;align-items:start;}
    h1{margin:0;color:#0B1220;font-size:26px;line-height:1.1;}
    .sub{margin:8px 0 0;color:#4B5563;font-size:13.5px;}
    .meta{margin-top:16px;display:grid;gap:6px;font-size:14px;color:#111827}
    .muted{color:#6B7280;font-size:12px;margin-top:10px}
    .qrbox{background:#F3F4F6;border:1px solid #E5E7EB;border-radius:16px;padding:12px;display:grid;place-items:center}
    .qrbox img{width:180px;height:180px;border-radius:12px}
    .foot{padding:12px 18px;border-top:1px solid #E5E7EB;background:#F9FAFB;color:#6B7280;font-size:12px;display:flex;justify-content:space-between}
  </style>
</head>
<body>
  <div class="ticket">
    <div class="stripe"></div>
    <div class="content">
      <div>
        <h1>${ticket.event_name}</h1>
        <div class="sub">Tu acceso está listo. Presenta el QR adjunto en la entrada.</div>

        <div class="meta">
          <div><b>Titular:</b> ${order.buyer_name}</div>
          <div><b>Email:</b> ${order.buyer_email}</div>
          <div><b>Tipo:</b> ${ticket.type_name}</div>
          ${when ? `<div><b>Fecha:</b> ${when}</div>` : ''}
        </div>

        <div class="muted">Ticket #${ticket.id} • Código: <b>${ticket.unique_code}</b></div>
      </div>

      <div class="qrbox">
        <img src="${qrDataUri}" alt="QR Ticket" />
        <div class="muted" style="margin-top:10px;text-align:center;">Escanea en la entrada</div>
      </div>
    </div>

    <div class="foot">
      <span>CloudTickets • FunPass</span>
      <span>Orden #${order.id}</span>
    </div>
  </div>
</body>
</html>
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

  // 2) Tickets
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

  // 3) Chromium (Railway-friendly)
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--no-zygote',
      '--disable-gpu',
    ],
  });

  try {
    const attachments = [];
    const cardBlocks = [];

    for (const t of tickets) {
      // A) QR para el PDF (data URI sí sirve dentro de PDF)
      const qrDataUri = await QRCode.toDataURL(t.qr_payload, { margin: 1, width: 320 });

      // B) QR para el correo (CID inline) -> Gmail SÍ lo muestra
      const qrPngBuffer = await QRCode.toBuffer(t.qr_payload, {
        margin: 1,
        width: 260,
        type: 'png',
      });

      const qrCid = `qr-ticket-${t.id}`; // content-id único por ticket

      // Tarjeta del correo usando CID
      cardBlocks.push(buildTicketCardHtml({ order, ticket: t, qrCid }));
/*
      // Adjuntar QR como inline image (CID)
      attachments.push({
        filename: `qr-${t.id}.png`,
        content: Buffer.from(qrPngBuffer).toString('base64'),
        contentType: 'image/png',
        content_id: qrCid, // ✅ Resend inline images via CID
      });
*/
      // C) PDF por ticket
      const page = await browser.newPage();
      await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 2 });
      const pdfHtml = buildTicketPdfHtml({ order, ticket: t, qrDataUri });
      await page.setContent(pdfHtml, { waitUntil: 'networkidle0' });

      const pdfBytes = await page.pdf({
        width: '215.9mm',   // 8.5 in
        height: '139.7mm',
        printBackground: true,
        margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' },
      });

      await page.close();

      // ✅ FIX CRÍTICO: convertir bien a base64 (evita PDF corrupto)
      const pdfBuffer = Buffer.from(pdfBytes);

      attachments.push({
        filename: `ticket-${t.id}.pdf`,
        content: pdfBuffer.toString('base64'),
        contentType: 'application/pdf',
      });
    }

    const emailHtml = buildEmailHtml({
      buyerName: order.buyer_name,
      eventName: tickets[0].event_name,
      ticketCardsHtml: cardBlocks.join(''),
    });

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

async function sendSingleTicketEmail({ ticketId, toEmail }) {
  // 1) Traer ticket + orden (ajusta joins a tu esquema real)
  const { rows } = await db.query(
    `SELECT 
        t.id, t.unique_code, t.qr_payload,
        tt.name AS type_name,
        e.name AS event_name, e.start_datetime,
        o.id AS order_id, o.buyer_name, o.buyer_email
     FROM tickets t
     JOIN orders o ON o.id = t.order_id
     JOIN ticket_types tt ON tt.id = t.ticket_type_id
     JOIN events e ON e.id = tt.event_id
     WHERE t.id = $1`,
    [ticketId]
  );

  if (!rows.length) return { error: 'Ticket not found' };

  const t = rows[0];
  const order = {
    id: t.order_id,
    buyer_name: t.buyer_name,
    buyer_email: t.buyer_email,
  };

  // 2) Generar PDF media carta (usa tu buildTicketPdfHtml actualizado)
  const qrDataUri = await QRCode.toDataURL(t.qr_payload, { margin: 1, width: 700 });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--no-zygote',
      '--disable-gpu',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 2 });

    const pdfHtml = buildTicketPdfHtml({ order, ticket: t, qrDataUri });

    await page.setContent(pdfHtml, { waitUntil: 'networkidle0' });

    const pdfBytes = await page.pdf({
      width: '215.9mm',
      height: '139.7mm',
      printBackground: true,
      margin: { top: '4mm', bottom: '4mm', left: '4mm', right: '4mm' },
      preferCSSPageSize: true,
    });

    await page.close();

    const pdfBuffer = Buffer.from(pdfBytes);

    // 3) HTML bonito del correo (sin QR inline, limpio)
    const emailHtml = `
      <div style="background:#FFFFFF;border-radius:22px;overflow:hidden;margin:16px 0;border:1px solid #E5E7EB;box-shadow:0 6px 14px rgba(0,0,0,.08);">
        <div style="background:linear-gradient(90deg,#2E6BFF 0%,#00D4FF 100%);height:14px;"></div>
        <div style="padding:18px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="vertical-align:top;">
                <div>
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


            </tr>
          </table>
        </div>

        <div style="background:#F9FAFB;padding:10px 18px;border-top:1px solid #E5E7EB;">
          <span style="color:#6B7280;font-size:12px;font-weight:600;">CloudTickets • FunPass</span>
        </div>
      </div>
    `;

    await resend.emails.send({
      from: 'CloudTickets <no-reply@cloud-tickets.info>',
      to: [toEmail],
      subject: `Tu ticket para ${t.event_name}`,
      html: emailHtml,
      attachments: [
        {
          filename: `ticket-${t.id}.pdf`,
          content: pdfBuffer.toString('base64'),
          contentType: 'application/pdf',
        },
      ],
    });

    return { success: true };
  } finally {
    await browser.close();
  }
}

module.exports = { sendTicketsEmailForOrder, sendSingleTicketEmail };

const { Resend } = require('resend');
const QRCode = require('qrcode');
const db = require('../db');

// ✅ para generar imagen estilo frontend
const { createCanvas, loadImage } = require('canvas');

const resend = new Resend(process.env.RESEND_API_KEY);

// -------------------- helpers para PNG --------------------
function roundRect(ctx, x, y, w, h, r) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function generateTicketPngBuffer({ ticket, order }) {
  // QR como dataURL (igual que frontend)
  const qrDataUrl = await QRCode.toDataURL(ticket.qr_payload, {
    margin: 2,
    width: 700,
  });

  const canvas = createCanvas(1200, 630);
  const ctx = canvas.getContext('2d');

  // Fondo
  ctx.fillStyle = '#0B1220';
  ctx.fillRect(0, 0, 1200, 630);

  // Card
  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, 60, 60, 1080, 510, 24);
  ctx.fill();

  // Banda superior (gradiente)
  const grad = ctx.createLinearGradient(60, 60, 1140, 60);
  grad.addColorStop(0, '#2E6BFF');
  grad.addColorStop(1, '#00D4FF');
  ctx.fillStyle = grad;
  roundRect(ctx, 60, 60, 1080, 88, 24);
  ctx.fill();

  // Textos (ojo: en server no siempre existe "system-ui", se usa fallback sans-serif)
  ctx.fillStyle = '#0B1220';
  ctx.font = '700 34px sans-serif';
  ctx.fillText(ticket.event_name || 'Evento', 90, 190);

  ctx.fillStyle = '#4B5563';
  ctx.font = '500 20px sans-serif';
  ctx.fillText('Tu acceso está listo. Presenta este QR en la entrada.', 90, 230);

  ctx.fillStyle = '#111827';
  ctx.font = '700 22px sans-serif';
  ctx.fillText(`Titular: ${order.buyer_name || '—'}`, 90, 280);

  ctx.fillStyle = '#374151';
  ctx.font = '500 20px sans-serif';
  ctx.fillText(`Correo: ${order.buyer_email || '—'}`, 90, 312);

  ctx.fillStyle = '#6B7280';
  ctx.font = '500 18px sans-serif';
  ctx.fillText(`Ticket #${ticket.id} • Código: ${ticket.unique_code}`, 90, 350);

  // QR
  const qrImg = await loadImage(qrDataUrl);

  // Marco QR
  ctx.fillStyle = '#F3F4F6';
  roundRect(ctx, 780, 170, 300, 300, 18);
  ctx.fill();

  ctx.drawImage(qrImg, 800, 190, 260, 260);

  // Footer
  ctx.fillStyle = '#6B7280';
  ctx.font = '500 16px sans-serif';
  ctx.fillText('CloudTickets • FunPass', 90, 520);

  // Buffer PNG
  return canvas.toBuffer('image/png');
}

// -------------------- envío correo + adjuntos --------------------
async function sendTicketsEmailForOrder(orderId) {
  // 1) orden
  const { rows: orders } = await db.query(
    `SELECT id, buyer_name, buyer_email FROM orders WHERE id = $1`,
    [orderId]
  );
  if (!orders.length) return { error: 'Order not found' };
  const order = orders[0];

  // 2) tickets
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

  // 3) HTML (puedes dejar el tuyo tal cual)
  const ticketHtmlBlocks = [];
  for (const t of tickets) {
    const qrDataUri = await QRCode.toDataURL(t.qr_payload, {
      margin: 1,
      width: 200,
      color: { dark: '#0B1220', light: '#F3F4F6' }
    });

    ticketHtmlBlocks.push(`
      <div style="background-color:#FFF;border-radius:24px;overflow:hidden;margin-bottom:30px;border:1px solid #E5E7EB;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
        <div style="background:linear-gradient(90deg,#2E6BFF 0%,#00D4FF 100%);height:16px;"></div>
        <div style="padding:24px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="vertical-align:top;">
                <div style="font-family:sans-serif;">
                  <h3 style="margin:0;color:#0B1220;font-size:24px;">${t.event_name}</h3>
                  <p style="margin:8px 0;color:#4B5563;font-size:14px;">Tu acceso está listo. Presenta este QR en la entrada.</p>
                  <div style="margin-top:20px;">
                    <p style="margin:0;color:#111827;font-weight:bold;font-size:16px;">Titular: ${order.buyer_name}</p>
                    <p style="margin:4px 0;color:#374151;font-size:14px;">Tipo: ${t.type_name}</p>
                    <p style="margin:12px 0 0 0;color:#6B7280;font-size:12px;">Ticket #${t.id} • Código: <b>${t.unique_code}</b></p>
                  </div>
                </div>
              </td>
              <td style="width:140px;text-align:right;vertical-align:top;">
                <div style="background-color:#F3F4F6;padding:10px;border-radius:12px;display:inline-block;">
                  <img src="${qrDataUri}" width="120" height="120" style="display:block;border-radius:4px;" alt="QR Code"/>
                </div>
              </td>
            </tr>
          </table>
        </div>
        <div style="background-color:#F9FAFB;padding:12px 24px;border-top:1px solid #E5E7EB;">
          <span style="color:#6B7280;font-size:12px;font-weight:500;">CloudTickets • FunPass</span>
        </div>
      </div>
    `);
  }

  // 4) Adjuntos: generar PNG por cada ticket
  const attachments = [];
  for (const t of tickets) {
    const pngBuffer = await generateTicketPngBuffer({ ticket: t, order });

    attachments.push({
      filename: `ticket-${t.id}.png`,
      content: pngBuffer.toString('base64'),
      contentType: 'image/png',
    });
  }

  // 5) Enviar correo con adjuntos
  await resend.emails.send({
    from: 'CloudTickets <no-reply@cloud-tickets.info>',
    to: [order.buyer_email],
    subject: `Tus tickets para ${tickets[0].event_name}`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="background-color:#F3F4F6;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <div style="max-width:600px;margin:0 auto;">
          <div style="background-color:#0B1220;padding:20px;border-radius:16px 16px 0 0;text-align:left;">
            <span style="color:#FFF;font-size:20px;font-weight:bold;">CloudTickets</span>
            <p style="color:#9CA3AF;margin:4px 0 0 0;font-size:12px;">Tus tickets están listos 🎟️</p>
          </div>

          <div style="padding:20px 0;">
            <p style="font-size:16px;color:#111827;">Hola <b>${order.buyer_name}</b>,</p>
            <p style="font-size:14px;color:#374151;margin-bottom:25px;">
              Aquí tienes tus pases para el evento <b>${tickets[0].event_name}</b>.
            </p>

            ${ticketHtmlBlocks.join('')}

            <div style="text-align:center;margin-top:20px;">
              <p style="color:#9CA3AF;font-size:12px;">Se adjuntan tus tickets en PNG.</p>
              <p style="color:#9CA3AF;font-size:12px;">© 2026 CloudTickets. Todos los derechos reservados.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    attachments, // ✅ aquí van adjuntos
  });

  return { success: true };
}

module.exports = { sendTicketsEmailForOrder };

const { Resend } = require('resend');
const QRCode = require('qrcode');
const db = require('../db');

// --- CONFIGURACIÓN DE RESEND ---
// Asegúrate de tener la variable RESEND_API_KEY en tu entorno de Railway
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendTicketsEmailForOrder(orderId) {
  // 1) Reclamar envío (IDEMPOTENCIA)
  const claim = await db.query(
    `UPDATE orders
        SET email_status = 'SENDING',
            email_last_error = NULL
      WHERE id = $1
        AND email_status IN ('PENDING')
        AND email_sent_at IS NULL
      RETURNING id, buyer_name, buyer_email`,
    [orderId]
  );

  if (!claim.rows.length) return { ok: true, skipped: true };

  const order = claim.rows[0];
  if (!order.buyer_email) {
    await db.query("UPDATE orders SET email_status='PENDING', email_last_error='NO_BUYER_EMAIL' WHERE id=$1", [orderId]);
    return { ok: false, error: 'NO_BUYER_EMAIL' };
  }

  try {
    // 2) Traer tickets + info de evento
    const { rows: tickets } = await db.query(
      `SELECT t.id, t.unique_code, t.qr_payload, t.status, tt.name AS ticket_type_name,
              e.name AS event_name, e.start_datetime AS event_start_datetime, e.image_url AS event_image_url
       FROM tickets t
       JOIN ticket_types tt ON tt.id = t.ticket_type_id
       JOIN events e ON e.id = tt.event_id
       WHERE t.order_id = $1 ORDER BY t.created_at ASC`,
      [orderId]
    );

    if (!tickets.length) {
      await db.query("UPDATE orders SET email_status='PENDING', email_last_error='NO_TICKETS' WHERE id=$1", [orderId]);
      return { ok: false, error: 'NO_TICKETS' };
    }

    const eventName = tickets[0].event_name;
    const eventStart = new Date(tickets[0].event_start_datetime).toLocaleString();
    const eventImage = tickets[0].event_image_url || '';
    
    const attachments = [];
    const ticketBlocks = [];

    // 3) Generar Bloques de Tickets (Estilo Frontend PurchasePage)
    for (const t of tickets) {
      const cid = `qr-${t.id}@cloudtickets`;
      const pngBuffer = await QRCode.toBuffer(t.qr_payload, { 
        type: 'png', 
        margin: 2, 
        scale: 6,
        color: { dark: '#0B1220', light: '#FFFFFF' } 
      });

      attachments.push({
        filename: `ticket-${t.unique_code}.png`,
        content: pngBuffer.toString('base64'),
      });

      // Diseño basado en tu componente React (Card con banda gradiente simulada)
      ticketBlocks.push(`
        <div style="background-color: #FFFFFF; border-radius: 24px; overflow: hidden; margin-bottom: 30px; border: 1px solid #E5E7EB; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(90deg, #2E6BFF 0%, #00D4FF 100%); background-color: #2E6BFF; height: 16px;"></div>
          
          <div style="padding: 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align: top;">
                  <div style="font-family: sans-serif;">
                    <h3 style="margin: 0; color: #0B1220; font-size: 24px;">${escapeHtml(eventName)}</h3>
                    <p style="margin: 8px 0; color: #4B5563; font-size: 14px;">Tu acceso está listo. Presenta este QR en la entrada.</p>
                    
                    <div style="margin-top: 20px;">
                      <p style="margin: 0; color: #111827; font-weight: bold; font-size: 16px;">Titular: ${escapeHtml(order.buyer_name)}</p>
                      <p style="margin: 4px 0; color: #374151; font-size: 14px;">Tipo: ${escapeHtml(t.ticket_type_name || 'General')}</p>
                      <p style="margin: 12px 0 0 0; color: #6B7280; font-size: 12px;">Ticket #${t.id} • Código: <b>${escapeHtml(t.unique_code)}</b></p>
                    </div>
                  </div>
                </td>
                <td style="width: 140px; text-align: right; vertical-align: top;">
                  <div style="background-color: #F3F4F6; padding: 10px; border-radius: 12px; display: inline-block;">
                    <img src="data:image/png;base64,${pngBuffer.toString('base64')}" width="120" height="120" style="display: block; border-radius: 4px;" />
                  </div>
                </td>
              </tr>
            </table>
          </div>
          
          <div style="background-color: #F9FAFB; padding: 12px 24px; border-top: 1px solid #E5E7EB;">
            <span style="color: #6B7280; font-size: 12px; font-weight: 500;">CloudTickets • FunPass</span>
          </div>
        </div>
      `);
    }

    // 4) Armar el cuerpo del correo
    const html = `
      <!DOCTYPE html>
      <html>
      <body style="background-color: #F3F4F6; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto;">
          
          <div style="background-color: #0B1220; padding: 20px; border-radius: 16px 16px 0 0; text-align: left;">
            <span style="color: #FFFFFF; font-size: 20px; font-weight: bold;">CloudTickets</span>
            <p style="color: #9CA3AF; margin: 4px 0 0 0; font-size: 12px;">Tus tickets están listos 🎟️</p>
          </div>

          ${eventImage ? `
          <div style="width: 100%; overflow: hidden;">
            <img src="${eventImage}" style="width: 100%; display: block;" alt="Banner" />
          </div>` : ''}

          <div style="padding: 20px 0;">
            <p style="font-size: 16px; color: #111827;">Hola <b>${escapeHtml(order.buyer_name)}</b>,</p>
            <p style="font-size: 14px; color: #374151; margin-bottom: 25px;">Aquí tienes tus pases para el evento <b>${escapeHtml(eventName)}</b> el día ${eventStart}.</p>

            ${ticketBlocks.join('')}

            <div style="text-align: center; margin-top: 30px; color: #9CA3AF; font-size: 12px;">
              <p>Si tienes problemas para ver las imágenes, puedes descargar los adjuntos.</p>
              <p>&copy; 2026 CloudTickets. Todos los derechos reservados.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // 5) Enviar con Resend
    const { error } = await resend.emails.send({
      from: 'CloudTickets <no-reply@cloud-tickets.info>',
      to: [order.buyer_email],
      subject: `Tus tickets: ${eventName}`,
      html: html,
      attachments: attachments
    });

    if (error) throw error;

    // 6) Éxito
    await db.query("UPDATE orders SET email_status='SENT', email_sent_at=NOW() WHERE id=$1", [orderId]);
    return { ok: true, sentTo: order.buyer_email };

  } catch (err) {
    console.error("Error envío:", err);
    await db.query("UPDATE orders SET email_status='PENDING', email_last_error=$2 WHERE id=$1", [orderId, String(err.message || err)]);
    throw err;
  }
}

function escapeHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

module.exports = { sendTicketsEmailForOrder };
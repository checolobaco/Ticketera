const { Resend } = require('resend');
const QRCode = require('qrcode');
const db = require('../db');

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendTicketsEmailForOrder(orderId) {
  // 1. Obtener datos de la orden
  const { rows: orders } = await db.query(
    `SELECT id, buyer_name, buyer_email FROM orders WHERE id = $1`, 
    [orderId]
  );
  
  if (!orders.length) return { error: 'Order not found' };
  const order = orders[0];

  // 2. Obtener los tickets
  const { rows: tickets } = await db.query(
    `SELECT t.id, t.unique_code, t.qr_payload, tt.name AS type_name, 
            e.name AS event_name, e.start_datetime 
     FROM tickets t
     JOIN ticket_types tt ON tt.id = t.ticket_type_id
     JOIN events e ON e.id = tt.event_id
     WHERE t.order_id = $1`, [orderId]
  );

  const ticketHtmlBlocks = [];

  // 3. Generar los bloques de tickets para el HTML
  for (const t of tickets) {
    // Generamos el QR en Base64
    const qrDataUri = await QRCode.toDataURL(t.qr_payload, {
      margin: 1,
      width: 200,
      color: {
        dark: '#0B1220',
        light: '#F3F4F6'
      }
    });

    const formattedDate = new Date(t.start_datetime).toLocaleString('es-ES', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });

    ticketHtmlBlocks.push(`
      <div style="background-color: #FFFFFF; border-radius: 24px; overflow: hidden; margin-bottom: 30px; border: 1px solid #E5E7EB; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(90deg, #2E6BFF 0%, #00D4FF 100%); background-color: #2E6BFF; height: 16px;"></div>
        <div style="padding: 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="vertical-align: top;">
                <div style="font-family: sans-serif;">
                  <h3 style="margin: 0; color: #0B1220; font-size: 24px;">${t.event_name}</h3>
                  <p style="margin: 8px 0; color: #4B5563; font-size: 14px;">Tu acceso está listo. Presenta este QR en la entrada.</p>
                  <div style="margin-top: 20px;">
                    <p style="margin: 0; color: #111827; font-weight: bold; font-size: 16px;">Titular: ${order.buyer_name}</p>
                    <p style="margin: 4px 0; color: #374151; font-size: 14px;">Tipo: ${t.type_name}</p>
                    <p style="margin: 12px 0 0 0; color: #6B7280; font-size: 12px;">Ticket #${t.id} • Código: <b>${t.unique_code}</b></p>
                  </div>
                </div>
              </td>
              <td style="width: 140px; text-align: right; vertical-align: top;">
                <div style="background-color: #F3F4F6; padding: 10px; border-radius: 12px; display: inline-block;">
                  <img src="${qrDataUri}" width="120" height="120" style="display: block; border-radius: 4px;" alt="QR Code" />
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

  // 4. Enviar el correo final con el HTML estructurado
  await resend.emails.send({
    from: 'CloudTickets <no-reply@cloud-tickets.info>',
    to: [order.buyer_email],
    subject: `Tus tickets para ${tickets[0].event_name}`,
    html: `
    <!DOCTYPE html>
    <html>
    <body style="background-color: #F3F4F6; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto;">
        <div style="background-color: #0B1220; padding: 20px; border-radius: 16px 16px 0 0; text-align: left;">
          <span style="color: #FFFFFF; font-size: 20px; font-weight: bold;">CloudTickets</span>
          <p style="color: #9CA3AF; margin: 4px 0 0 0; font-size: 12px;">Tus tickets están listos 🎟️</p>
        </div>

        <div style="padding: 20px 0;">
          <p style="font-size: 16px; color: #111827;">Hola <b>${order.buyer_name}</b>,</p>
          <p style="font-size: 14px; color: #374151; margin-bottom: 25px;">
            Aquí tienes tus pases para el evento <b>${tickets[0].event_name}</b>.
          </p>

          ${ticketHtmlBlocks.join('')}

          <div style="text-align: center; margin-top: 20px;">
            <p style="color: #9CA3AF; font-size: 12px;">© 2026 CloudTickets. Todos los derechos reservados.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
    `
  });

  return { success: true };
}

module.exports = { sendTicketsEmailForOrder };
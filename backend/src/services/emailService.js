const { Resend } = require('resend');
const QRCode = require('qrcode');
const { createCanvas, loadImage } = require('canvas');
const db = require('../db');

const resend = new Resend(process.env.RESEND_API_KEY);

function roundRect(ctx, x, y, w, h, r, fill = false) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) ctx.fill();
}

async function sendTicketsEmailForOrder(orderId) {
  const { rows: orders } = await db.query(
    `SELECT id, buyer_name, buyer_email FROM orders WHERE id = $1`, [orderId]
  );
  const order = orders[0];

  const { rows: tickets } = await db.query(
    `SELECT t.id, t.unique_code, t.qr_payload, tt.name AS type_name, 
            e.name AS event_name, e.start_datetime 
     FROM tickets t
     JOIN ticket_types tt ON tt.id = t.ticket_type_id
     JOIN events e ON e.id = tt.event_id
     WHERE t.order_id = $1`, [orderId]
  );

  const attachments = [];
  const ticketHtmlBlocks = [];

  for (const t of tickets) {
    const canvas = createCanvas(1000, 500);
    const ctx = canvas.getContext('2d');

    // Fondo y Tarjeta Blanca (Diseño de tu imagen)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 1000, 500);
    roundRect(ctx, 20, 20, 960, 460, 30, true);

    // Banda Azul Superior (Gradiente de la captura)
    const grad = ctx.createLinearGradient(0, 0, 1000, 0);
    grad.addColorStop(0, '#3B82F6');
    grad.addColorStop(1, '#06B6D4');
    ctx.fillStyle = grad;
    roundRect(ctx, 40, 40, 920, 60, 20, true);

    // Textos del Evento
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 45px sans-serif'; 
    ctx.fillText(t.event_name, 80, 180);

    ctx.fillStyle = '#6B7280';
    ctx.font = '24px sans-serif';
    ctx.fillText('Tu acceso está listo. Presenta este QR en la entrada.', 80, 230);

    ctx.fillStyle = '#111827';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(`Titular: ${order.buyer_name}`, 80, 310);
    
    ctx.fillStyle = '#374151';
    ctx.font = '24px sans-serif';
    ctx.fillText(`Tipo: ${t.type_name}`, 80, 350);

    ctx.fillStyle = '#9CA3AF';
    ctx.font = '18px sans-serif';
    ctx.fillText(`Ticket #${t.id} • Código: ${t.unique_code}`, 80, 400);

    // --- EL CUADRO DEL QR (Llenando el vacío de tu imagen) ---
    ctx.fillStyle = '#F3F4F6';
    roundRect(ctx, 650, 140, 280, 280, 20, true);

    const qrBuffer = await QRCode.toBuffer(t.qr_payload, { margin: 1, width: 250 });
    const qrImg = await loadImage(qrBuffer);
    ctx.drawImage(qrImg, 665, 155, 250, 250);

    ctx.fillStyle = '#9CA3AF';
    ctx.font = '16px sans-serif';
    ctx.fillText('CloudTickets • FunPass', 80, 450);

    const buffer = canvas.toBuffer('image/png');
    const cid = `ticket_${t.id}`;
    
    attachments.push({
      filename: `ticket_${t.id}.png`,
      content: buffer,
      cid: cid 
    });

    // Bloque HTML que usa el CID para mostrar la imagen en el cuerpo
    ticketHtmlBlocks.push(`
      <div style="margin-bottom: 20px; text-align: center;">
        <img src="cid:${cid}" width="100%" style="max-width: 550px; border-radius: 15px; border: 1px solid #e5e7eb;" />
      </div>
    `);
  }

  await resend.emails.send({
    from: 'CloudTickets <no-reply@cloud-tickets.info>',
    to: [order.buyer_email],
    subject: `Tus tickets: ${tickets[0].event_name}`,
    attachments: attachments,
    html: `
      <div style="background-color: #f9fafb; padding: 30px 10px; font-family: -apple-system, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
          
          <div style="background-color: #0B1220; padding: 40px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 26px; letter-spacing: -0.5px;">CloudTickets</h1>
            <p style="margin: 8px 0 0; opacity: 0.7; font-size: 14px;">¡Tu compra ha sido exitosa! 🎟️</p>
          </div>

          <div style="padding: 30px;">
            <p style="font-size: 16px; color: #111827;">Hola <strong>${order.buyer_name}</strong>,</p>
            <p style="font-size: 14px; color: #4B5563; line-height: 1.5;">
                Aquí tienes tus pases para el evento <strong>${tickets[0].event_name}</strong>. 
                Presenta el código QR de cada tarjeta en la entrada:
            </p>
            
            <div style="margin-top: 25px;">
              ${ticketHtmlBlocks.join('')}
            </div>

            <p style="font-size: 12px; color: #9CA3AF; text-align: center; margin-top: 20px;">
                Si no puedes ver las imágenes, revisa los archivos adjuntos de este correo.
            </p>
          </div>

          <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #f1f5f9;">
            <p style="margin: 0; font-size: 12px; color: #9CA3AF;">© 2026 CloudTickets. Todos los derechos reservados.</p>
          </div>
        </div>
      </div>
    `
  });

  return { success: true };
}

module.exports = { sendTicketsEmailForOrder };
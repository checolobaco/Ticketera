const { Resend } = require('resend');
const QRCode = require('qrcode');
const { createCanvas, loadImage } = require('canvas');
const db = require('../db');

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Helper para dibujar rectángulos redondeados en el Canvas
 */
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
  // 1. Obtener datos de la orden y el comprador
  const { rows: orders } = await db.query(
    `SELECT id, buyer_name, buyer_email FROM orders WHERE id = $1`, [orderId]
  );
  
  if (!orders.length) return { error: 'Order not found' };
  const order = orders[0];

  // 2. Obtener tickets con info del evento y tipo
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

  // 3. Generar cada ticket como una imagen profesional
  for (const t of tickets) {
    const canvas = createCanvas(1000, 500);
    const ctx = canvas.getContext('2d');

    // --- DISEÑO DE LA TARJETA ---
    // Fondo de la imagen (oscuro para que resalte la card)
    ctx.fillStyle = '#0B1220';
    ctx.fillRect(0, 0, 1000, 500);

    // Card blanca principal
    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, 40, 40, 920, 420, 30, true);

    // Banda superior gradiente (Azul/Cian)
    const grad = ctx.createLinearGradient(40, 40, 960, 40);
    grad.addColorStop(0, '#3B82F6');
    grad.addColorStop(1, '#06B6D4');
    ctx.fillStyle = grad;
    roundRect(ctx, 40, 40, 920, 70, 20, true);

    // Textos: Evento y Detalles
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 42px sans-serif'; 
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

    // --- EL CUADRO DEL QR ---
    ctx.fillStyle = '#F3F4F6';
    roundRect(ctx, 650, 140, 280, 280, 20, true);

    const qrBuffer = await QRCode.toBuffer(t.qr_payload, { margin: 1, width: 250 });
    const qrImg = await loadImage(qrBuffer);
    ctx.drawImage(qrImg, 665, 155, 250, 250);

    ctx.fillStyle = '#9CA3AF';
    ctx.font = 'italic 16px sans-serif';
    ctx.fillText('CloudTickets • FunPass', 80, 450);

    // Convertir a Buffer y preparar CID para embeberlo en el HTML
    const buffer = canvas.toBuffer('image/png');
    const cid = `ticket_${t.id}`;
    
    attachments.push({
      filename: `ticket_${t.id}.png`,
      content: buffer,
      cid: cid 
    });

    ticketHtmlBlocks.push(`
      <div style="margin-bottom: 25px; text-align: center;">
        <img src="cid:${cid}" width="100%" style="max-width: 550px; border-radius: 18px; border: 1px solid #e5e7eb;" />
      </div>
    `);
  }

  // 4. Enviar mediante Resend
  await resend.emails.send({
    from: 'CloudTickets <no-reply@cloud-tickets.info>',
    to: [order.buyer_email],
    subject: `Tus tickets: ${tickets[0].event_name}`,
    attachments: attachments,
    html: `
      <div style="background-color: #f3f4f6; padding: 40px 10px; font-family: sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08);">
          
          <div style="background-color: #0B1220; padding: 40px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 26px;">CloudTickets</h1>
            <p style="margin: 8px 0 0; opacity: 0.7; font-size: 14px;">¡Tu compra ha sido exitosa!</p>
          </div>

          <div style="padding: 30px;">
            <p style="font-size: 16px; color: #111827;">Hola <strong>${order.buyer_name}</strong>,</p>
            <p style="font-size: 14px; color: #4B5563; line-height: 1.6;">
                Ya puedes descargar tus pases para <strong>${tickets[0].event_name}</strong>. 
                Si no logras ver las tarjetas abajo, las encontrarás adjuntas a este correo.
            </p>
            
            <div style="margin-top: 30px;">
              ${ticketHtmlBlocks.join('')}
            </div>
          </div>

          <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #f1f5f9;">
            <p style="margin: 0; font-size: 12px; color: #9CA3AF;">© 2026 CloudTickets • Eventos Digitales</p>
          </div>
        </div>
      </div>
    `
  });

  return { success: true };
}

module.exports = { sendTicketsEmailForOrder };
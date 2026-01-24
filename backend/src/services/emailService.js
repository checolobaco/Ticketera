const { Resend } = require('resend');
const QRCode = require('qrcode');
const { createCanvas, loadImage } = require('canvas'); // 👈 Asegúrate de que esta línea esté así
const db = require('../db');

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendTicketsEmailForOrder(orderId) {
  const claim = await db.query(
    `UPDATE orders SET email_status = 'SENDING', email_last_error = NULL
     WHERE id = $1 AND email_status IN ('PENDING') AND email_sent_at IS NULL
     RETURNING id, buyer_name, buyer_email`,
    [orderId]
  );

  if (!claim.rows.length) return { ok: true, skipped: true };
  const order = claim.rows[0];

  try {
    const { rows: tickets } = await db.query(
      `SELECT t.id, t.unique_code, t.qr_payload, tt.name AS ticket_type_name,
              e.name AS event_name, e.start_datetime AS event_date
       FROM tickets t
       JOIN ticket_types tt ON tt.id = t.ticket_type_id
       JOIN events e ON e.id = tt.event_id
       WHERE t.order_id = $1`, [orderId]
    );

    const attachments = [];
    const ticketHtmlBlocks = [];

    for (const t of tickets) {
      // --- GENERAR TARJETA ---
      const canvas = createCanvas(1200, 630);
      const ctx = canvas.getContext('2d');

      // Fondo oscuro
      ctx.fillStyle = '#0B1220';
      ctx.fillRect(0, 0, 1200, 630);

      // Card Blanca
      ctx.fillStyle = '#FFFFFF';
      roundRect(ctx, 60, 60, 1080, 510, 24, true);

      // Banda superior gradiente (simulado)
      const grad = ctx.createLinearGradient(60, 60, 1140, 60);
      grad.addColorStop(0, '#2E6BFF');
      grad.addColorStop(1, '#00D4FF');
      ctx.fillStyle = grad;
      roundRect(ctx, 60, 60, 1080, 88, 24, true);

      // Textos
      ctx.fillStyle = '#0B1220';
      ctx.font = 'bold 40px sans-serif';
      ctx.fillText(t.event_name || 'Evento', 90, 200);

      ctx.fillStyle = '#4B5563';
      ctx.font = '24px sans-serif';
      ctx.fillText('Presenta este QR en la entrada.', 90, 245);

      ctx.fillStyle = '#111827';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(`Titular: ${order.buyer_name || '—'}`, 90, 310);

      ctx.fillStyle = '#374151';
      ctx.font = '24px sans-serif';
      ctx.fillText(`Tipo: ${t.ticket_type_name || 'General'}`, 90, 350);

      ctx.fillStyle = '#6B7280';
      ctx.font = '20px sans-serif';
      ctx.fillText(`Código: ${t.unique_code}`, 90, 395);

      // QR
      const qrBuffer = await QRCode.toBuffer(t.qr_payload, { margin: 1, width: 300 });
      const qrImg = await loadImage(qrBuffer);
      ctx.fillStyle = '#F3F4F6';
      roundRect(ctx, 750, 170, 330, 330, 18, true); 
      ctx.drawImage(qrImg, 765, 185, 300, 300);

      ctx.fillStyle = '#6B7280';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('CloudTickets • FunPass', 90, 530);

      const cardBuffer = canvas.toBuffer('image/png');
      const base64Card = cardBuffer.toString('base64');

      attachments.push({
        filename: `ticket-${t.id}.png`,
        content: base64Card,
      });

      ticketHtmlBlocks.push(`
        <div style="margin-bottom: 30px; text-align: center;">
          <img src="data:image/png;base64,${base64Card}" width="100%" style="max-width: 550px; border-radius: 12px; border: 1px solid #eee;" />
        </div>
      `);
    }

    await resend.emails.send({
      from: 'CloudTickets <no-reply@cloud-tickets.info>',
      to: [order.buyer_email],
      subject: `Tus tickets: ${tickets[0]?.event_name}`,
      html: `
        <div style="font-family: sans-serif; background: #f9fafb; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            <div style="background: #0B1220; padding: 25px; color: white; text-align: center;">
              <h1 style="margin:0; font-size: 24px;">CloudTickets</h1>
              <p style="margin:5px 0 0 0; opacity: 0.8; font-size: 14px;">¡Tu compra ha sido exitosa!</p>
            </div>
            <div style="padding: 20px;">
              ${ticketHtmlBlocks.join('')}
            </div>
            <div style="padding: 20px; text-align: center; color: #6B7280; font-size: 12px; border-top: 1px solid #eee;">
              <p>Si no puedes ver las imágenes, los tickets están adjuntos como fotos en este correo.</p>
            </div>
          </div>
        </div>`,
      attachments: attachments
    });

    await db.query("UPDATE orders SET email_status='SENT', email_sent_at=NOW() WHERE id=$1", [orderId]);
    return { ok: true };

  } catch (err) {
    console.error("ERROR EN ENVÍO:", err);
    await db.query("UPDATE orders SET email_status='PENDING', email_last_error=$2 WHERE id=$1", [orderId, err.message]);
    throw err;
  }
}

function roundRect(ctx, x, y, w, h, r, fill) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) ctx.fill();
}

function escapeHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

module.exports = { sendTicketsEmailForOrder };
const { Resend } = require('resend');
const QRCode = require('qrcode');
const { createCanvas, loadImage } = require('canvas');
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
        const canvas = createCanvas(1200, 630);
        const ctx = canvas.getContext('2d');

        // 🎨 Fondo y Tarjeta (Esto no falla)
        ctx.fillStyle = '#0B1220';
        ctx.fillRect(0, 0, 1200, 630);
        ctx.fillStyle = '#FFFFFF';
        roundRect(ctx, 60, 60, 1080, 510, 24, true);

        // 🟦 Banda Azul
        const grad = ctx.createLinearGradient(60, 60, 1140, 60);
        grad.addColorStop(0, '#00C6FF');
        grad.addColorStop(1, '#0072FF');
        ctx.fillStyle = grad;
        roundRect(ctx, 60, 60, 1080, 88, 24, true);

        // 🖋️ TEXTO (Solución a los cuadritos: Usar fuentes genéricas seguras)
        ctx.fillStyle = '#0B1220';
        ctx.font = 'bold 45px Impact, Arial, sans-serif'; // Impact suele estar disponible
        ctx.fillText(t.event_name.toUpperCase(), 100, 200);

        ctx.fillStyle = '#4B5563';
        ctx.font = '25px Arial, sans-serif';
        ctx.fillText('Presenta este código QR en la entrada', 100, 250);

        ctx.fillStyle = '#111827';
        ctx.font = 'bold 30px Arial, sans-serif';
        ctx.fillText(`TITULAR: ${order.buyer_name}`, 100, 320);
        
        ctx.font = '25px Arial, sans-serif';
        ctx.fillText(`TIPO: ${t.ticket_type_name}`, 100, 370);
        
        ctx.fillStyle = '#9CA3AF';
        ctx.fillText(`CÓDIGO: ${t.unique_code}`, 100, 420);

        // 🏁 QR (Aseguramos que se dibuje)
        const qrBuffer = await QRCode.toBuffer(t.qr_payload, { margin: 1, width: 300 });
        const qrImg = await loadImage(qrBuffer);
        ctx.fillStyle = '#F3F4F6';
        roundRect(ctx, 750, 160, 330, 330, 18, true);
        ctx.drawImage(qrImg, 765, 175, 300, 300);

        const cardBuffer = canvas.toBuffer('image/png');
        
        // CID para que la imagen se vea DENTRO del cuerpo del correo (no solo adjunta)
        const cid = `ticket-${t.id}`;
        attachments.push({
            filename: `${cid}.png`,
            content: cardBuffer,
            cid: cid // ESTO ES CLAVE
        });

        ticketHtmlBlocks.push(`
            <div style="margin-bottom: 25px;">
                <img src="cid:${cid}" width="100%" style="max-width: 500px; border-radius: 15px; display: block; margin: 0 auto;" />
            </div>
        `);
    }

    await resend.emails.send({
        from: 'CloudTickets <no-reply@cloud-tickets.info>',
        to: [order.buyer_email],
        subject: `Tus tickets para ${tickets[0].event_name}`,
        html: `
            <div style="background:#f0f2f5; padding:40px 10px; font-family:Arial,sans-serif;">
                <div style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.1);">
                    <div style="background:#0B1220; padding:30px; text-align:center; color:white;">
                        <h1 style="margin:0; font-size:28px;">CloudTickets</h1>
                        <p style="opacity:0.7;">¡Tu compra ha sido exitosa!</p>
                    </div>
                    <div style="padding:30px;">
                        ${ticketHtmlBlocks.join('')}
                    </div>
                    <div style="background:#f9fafb; padding:20px; text-align:center; font-size:12px; color:#9ca3af;">
                        Este es un ticket oficial. Si no ves las imágenes, descárgalas de los adjuntos.
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
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
            // --- 1. GENERAR IMAGEN DE TARJETA COMPLETA ---
            const canvas = createCanvas(1200, 630);
            const ctx = canvas.getContext('2d');

            // Fondo oscuro exterior
            ctx.fillStyle = '#0B1220';
            ctx.fillRect(0, 0, 1200, 630);

            // Card Blanca con bordes redondeados
            ctx.fillStyle = '#FFFFFF';
            roundRect(ctx, 60, 60, 1080, 510, 24, true);

            // Banda superior con gradiente
            const grad = ctx.createLinearGradient(60, 60, 1140, 60);
            grad.addColorStop(0, '#2E6BFF');
            grad.addColorStop(1, '#00D4FF');
            ctx.fillStyle = grad;
            roundRect(ctx, 60, 60, 1080, 88, 24, true);

            // Textos del Evento
            ctx.fillStyle = '#0B1220';
            ctx.font = 'bold 34px sans-serif';
            ctx.fillText(t.event_name || 'Evento', 90, 190);

            ctx.fillStyle = '#4B5563';
            ctx.font = '20px sans-serif';
            ctx.fillText('Tu acceso está listo. Presenta este QR en la entrada.', 90, 230);

            // Datos del Titular
            ctx.fillStyle = '#111827';
            ctx.font = 'bold 22px sans-serif';
            ctx.fillText(`Titular: ${order.buyer_name || '—'}`, 90, 280);

            ctx.fillStyle = '#374151';
            ctx.font = '20px sans-serif';
            ctx.fillText(`Tipo: ${t.ticket_type_name || 'General'}`, 90, 312);

            ctx.fillStyle = '#6B7280';
            ctx.font = '18px sans-serif';
            ctx.fillText(`Ticket #${t.id} • Código: ${t.unique_code}`, 90, 350);

            // Generar QR e insertarlo en la tarjeta
            const qrBuffer = await QRCode.toBuffer(t.qr_payload, { margin: 1, width: 260 });
            const qrImg = await loadImage(qrBuffer);
            
            ctx.fillStyle = '#F3F4F6';
            roundRect(ctx, 780, 170, 300, 300, 18, true); // Marco del QR
            ctx.drawImage(qrImg, 800, 190, 260, 260);

            ctx.fillStyle = '#6B7280';
            ctx.font = '500 16px sans-serif';
            ctx.fillText('CloudTickets • FunPass', 90, 520);

            const cardBuffer = canvas.toBuffer('image/png');
            const base64Card = cardBuffer.toString('base64');

            // --- 2. PREPARAR ADJUNTO Y HTML ---
            attachments.push({
                filename: `ticket-${t.id}.png`,
                content: base64Card,
            });

            ticketHtmlBlocks.push(`
                <div style="margin-bottom: 20px; text-align: center;">
                    <img src="data:image/png;base64,${base64Card}" width="100%" style="max-width: 600px; border-radius: 12px;" />
                </div>
            `);
        }

        // --- 3. ENVIAR CORREO ---
        await resend.emails.send({
            from: 'CloudTickets <no-reply@cloud-tickets.info>',
            to: [order.buyer_email],
            subject: `Tus tickets para ${tickets[0]?.event_name}`,
            html: `
                <div style="font-family: sans-serif; background: #f3f4f6; padding: 20px;">
                    <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden;">
                        <div style="background: #0B1220; padding: 20px; color: white;">
                            <h2 style="margin:0;">CloudTickets</h2>
                            <p style="margin:0; opacity: 0.8;">Aquí tienes tus pases</p>
                        </div>
                        <div style="padding: 20px;">
                            ${ticketHtmlBlocks.join('')}
                        </div>
                    </div>
                </div>`,
            attachments: attachments
        });

        await db.query("UPDATE orders SET email_status='SENT', email_sent_at=NOW() WHERE id=$1", [orderId]);
        return { ok: true };

    } catch (err) {
        console.error(err);
        await db.query("UPDATE orders SET email_status='PENDING', email_last_error=$2 WHERE id=$1", [orderId, err.message]);
        throw err;
    }
}

// Helper para bordes redondeados en Canvas
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

module.exports = { sendTicketsEmailForOrder };
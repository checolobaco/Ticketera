const { Resend } = require('resend');
const QRCode = require('qrcode');
const { createCanvas, loadImage, registerFont } = require('canvas');
const db = require('../db');

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Función para generar la imagen del ticket (estilo tarjeta)
 */
async function generateTicketImage(ticket, buyerName) {
    const width = 800;
    const height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Fondo blanco con bordes redondeados
    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, 0, 0, width, height, 24, true, false);

    // 2. Barra de gradiente superior
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, '#2E6BFF');
    gradient.addColorStop(1, '#00D4FF');
    ctx.fillStyle = gradient;
    roundRect(ctx, 0, 0, width, 20, { tl: 24, tr: 24, bl: 0, br: 0 }, true, false);

    // 3. Dibujar el Código QR
    const qrDataUrl = await QRCode.toDataURL(ticket.qr_payload, { margin: 1 });
    const qrImage = await loadImage(qrDataUrl);
    
    // Contenedor gris del QR
    ctx.fillStyle = '#F3F4F6';
    roundRect(ctx, 550, 60, 200, 200, 16, true, false);
    ctx.drawImage(qrImage, 570, 80, 160, 160);

    // 4. Textos
    ctx.textBaseline = 'top';
    
    // Nombre del Evento
    ctx.fillStyle = '#0B1220';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText(ticket.event_name, 40, 60);

    // Subtítulo
    ctx.fillStyle = '#4B5563';
    ctx.font = '18px sans-serif';
    ctx.fillText('Tu acceso está listo. Presenta este QR en la entrada.', 40, 110);

    // Titular
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`Titular: ${buyerName}`, 40, 180);

    // Tipo de ticket
    ctx.fillStyle = '#374151';
    ctx.font = '18px sans-serif';
    ctx.fillText(`Tipo: ${ticket.type_name}`, 40, 215);

    // Footer de la tarjeta
    ctx.fillStyle = '#F9FAFB';
    roundRect(ctx, 0, 340, width, 60, { tl: 0, tr: 0, bl: 24, br: 24 }, true, false);
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#6B7280';
    ctx.font = '500 16px sans-serif';
    ctx.fillText('CloudTickets • FunPass', 40, 360);

    // Info pequeña del ticket
    ctx.font = '14px sans-serif';
    ctx.fillText(`Ticket #${ticket.id} • Código: ${ticket.unique_code}`, 40, 260);

    return canvas.toBuffer('image/png');
}

// Función auxiliar para bordes redondeados en Canvas
function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    if (typeof radius === 'number') {
        radius = { tl: radius, tr: radius, bl: radius, br: radius };
    }
    ctx.beginPath();
    ctx.moveTo(x + radius.tl, y);
    ctx.lineTo(x + width - radius.tr, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
    ctx.lineTo(x + width, y + height - radius.br);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
    ctx.lineTo(x + radius.bl, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
    ctx.lineTo(x, y + radius.tl);
    ctx.quadraticCurveTo(x, y, x + radius.tl, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
}

async function sendTicketsEmailForOrder(orderId) {
    const { rows: orders } = await db.query(`SELECT id, buyer_name, buyer_email FROM orders WHERE id = $1`, [orderId]);
    if (!orders.length) return { error: 'Order not found' };
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
        // GENERAR IMAGEN ADJUNTA (Diseño de la foto)
        const ticketBuffer = await generateTicketImage(t, order.buyer_name);
        attachments.push({
            filename: `Ticket-${t.unique_code}.png`,
            content: ticketBuffer,
        });

        // QR para el cuerpo del HTML (Base64 rápido)
        const qrDataUri = await QRCode.toDataURL(t.qr_payload);

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
                                    <img src="${qrDataUri}" width="120" height="120" style="display: block; border-radius: 4px;" />
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

    await resend.emails.send({
        from: 'CloudTickets <no-reply@cloud-tickets.info>',
        to: [order.buyer_email],
        subject: `Tus tickets para ${tickets[0].event_name}`,
        attachments: attachments, // <--- Aquí se adjuntan las imágenes generadas
        html: `
        <html>
        <body style="background-color: #F3F4F6; padding: 20px; font-family: sans-serif;">
            <div style="max-width: 600px; margin: 0 auto;">
                <div style="background-color: #0B1220; padding: 20px; border-radius: 16px 16px 0 0;">
                    <span style="color: #FFFFFF; font-size: 20px; font-weight: bold;">CloudTickets</span>
                </div>
                <div style="padding: 20px 0;">
                    <p>Hola <b>${order.buyer_name}</b>, aquí tienes tus pases:</p>
                    ${ticketHtmlBlocks.join('')}
                    <p style="color: #9CA3AF; font-size: 12px; text-align: center;">
                        Si tienes problemas para ver las imágenes, hemos adjuntado los tickets como archivos PNG a este correo.
                    </p>
                </div>
            </div>
        </body>
        </html>
        `
    });

    return { success: true };
}

module.exports = { sendTicketsEmailForOrder };
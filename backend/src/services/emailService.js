const { Resend } = require('resend');
const QRCode = require('qrcode');
const puppeteer = require('puppeteer');
const db = require('../db');
const clean = (val) => {
  if (val === null || val === undefined || String(val).toLowerCase() === 'null') return '';
  return String(val).trim();
};
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
  const nombreTitular = clean(ticket.holder_name) || clean(order.buyer_name) || 'Invitado';
  const emailTitular = clean(ticket.holder_email) || clean(order.buyer_email) || '---';
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
        <div class="sub">Tu acceso está listo. Presenta el QR en la entrada.</div>

        <div class="meta">
          <div><b>Titular:</b> ${nombreTitular}</div>
          <div><b>Email:</b> ${emailTitular}</div>
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
async function sendTicketsEmailForOrder(orderId, overrideEmail) {
  let browser = null;
  try {
    // 1. Obtener la orden de la base de datos
    const { rows: orders } = await db.query(
      `SELECT id, buyer_name, buyer_email FROM orders WHERE id = $1`, [orderId]
    );
    
    if (!orders.length) throw new Error('ORDEN_NO_ENCONTRADA');
    const order = orders[0];

    // 2. INICIO: Marcamos en la BD que el proceso ha comenzado
    await db.query(
      `UPDATE orders SET email_status = 'SENDING', email_last_error = NULL WHERE id = $1`,
      [orderId]
    );

    // 3. Preparar datos de envío y tickets
    const recipient = clean(overrideEmail) || clean(order.buyer_email);
    const buyerName = clean(order.buyer_name) || 'Cliente';

    const { rows: tickets } = await db.query(
      `SELECT t.*, tt.name AS type_name, e.name AS event_name, e.start_datetime
       FROM tickets t
       JOIN ticket_types tt ON tt.id = t.ticket_type_id
       JOIN events e ON e.id = tt.event_id
       WHERE t.order_id = $1
       ORDER BY t.id ASC`, [orderId]
    );

    if (!tickets.length) throw new Error('LA_ORDEN_NO_TIENE_TICKETS');

    // 4. Iniciar Puppeteer con configuración robusta
    browser = await puppeteer.launch({ 
      headless: 'new', 
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
    });
    
    const attachments = [];

    // 5. Generar cada PDF de forma secuencial
    for (const t of tickets) {
      const page = await browser.newPage();
      
      // Nombre del titular del ticket o, en su defecto, el comprador
      const finalHolderName = clean(t.holder_name) || buyerName;
      const qrDataUri = await QRCode.toDataURL(t.qr_payload || t.unique_code, { margin: 1, width: 600 });
      
      const pdfHtml = buildTicketPdfHtml({ 
        order: { buyer_name: finalHolderName, buyer_email: recipient }, 
        ticket: t, 
        qrDataUri 
      });

      // Cargamos el HTML (usamos 'load' y 60s de timeout para evitar el error anterior)
      await page.setContent(pdfHtml, { waitUntil: 'load', timeout: 60000 });
      const pdfBytes = await page.pdf({ format: 'Letter', printBackground: true });
      await page.close();

      attachments.push({
        filename: `Ticket_${t.id}_${t.type_name.replace(/\s+/g, '_')}.pdf`,
        content: Buffer.from(pdfBytes).toString('base64'),
        contentType: 'application/pdf',
      });
    }

    // 6. Construir el cuerpo del correo (HTML Seguro)
    const emailHtmlBody = `
      <div style="font-family: Arial, sans-serif; background-color: #f4f7f6; padding: 30px; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0;">
          <div style="background-color: #0f172a; padding: 25px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">CloudTickets</h1>
          </div>
          <div style="padding: 35px;">
            <h2 style="color: #0f172a; margin-top: 0;">¡Hola, ${buyerName}! 👋</h2>
            <p style="font-size: 16px; line-height: 1.6;">Tu compra ha sido confirmada. Adjunto a este correo encontrarás tus entradas para:</p>
            
            <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 20px; margin: 25px 0;">
              <p style="margin: 0; font-weight: bold; font-size: 18px; color: #1e293b;">${tickets[0].event_name}</p>
              <p style="margin: 5px 0 0; color: #64748b;">Orden #${orderId} • ${tickets.length} ticket(s)</p>
            </div>

            <p style="font-size: 14px; color: #475569;">
              <b>Instrucciones:</b> Descarga los archivos PDF adjuntos. Puedes presentarlos impresos o mostrar el código QR desde tu celular al llegar al evento.
            </p>
          </div>
          <div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8;">
            © 2026 CloudTickets. Este es un envío automático de confirmación.
          </div>
        </div>
      </div>
    `;

    // 7. Enviar por Resend
    const { data, error: resendError } = await resend.emails.send({
      from: 'CloudTickets <no-reply@cloud-tickets.info>',
      to: [recipient],
      subject: `🎟️ Tus entradas para ${tickets[0].event_name}`,
      html: emailHtmlBody,
      attachments,
    });

    // Si Resend reporta un error, lanzamos excepción para que el catch lo capture
    if (resendError) throw new Error(`Error de Resend: ${resendError.message}`);

    // 8. ÉXITO: Actualizar la base de datos
    await db.query(
      `UPDATE orders 
       SET email_status = 'SENT', 
           email_sent_at = NOW(), 
           email_last_error = NULL 
       WHERE id = $1`,
      [orderId]
    );

    console.log(`✅ Orden ${orderId}: Correo enviado correctamente a ${recipient}`);
    return { success: true, data };

  } catch (err) {
    // 9. ERROR: Registrar el fallo detallado en la base de datos
    console.error(`❌ Fallo en Orden ${orderId}:`, err.message);
    
    await db.query(
      `UPDATE orders 
       SET email_status = 'ERROR', 
           email_last_error = $1, 
           email_sent_at = NULL 
       WHERE id = $2`,
      [err.message.substring(0, 255), orderId]
    );

    throw err; // Lanza el error para que el controlador responda 500
  } finally {
    // Cerrar el navegador siempre, pase lo que pase
    if (browser) await browser.close();
  }
}

async function sendSingleTicketEmail({ ticketId, toEmail }) {
  // 1) Traer ticket + orden (ajusta joins a tu esquema real)
  const { rows } = await db.query(
    `SELECT t.*, o.buyer_name, o.buyer_email, tt.name as type_name, e.name as event_name, e.start_datetime
     FROM tickets t
     JOIN orders o ON o.id = t.order_id
     JOIN ticket_types tt ON tt.id = t.ticket_type_id
     JOIN events e ON e.id = tt.event_id
     WHERE t.id = $1`, [ticketId]
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
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#F3F4F6;padding:20px">
        <div style="max-width:640px;margin:0 auto">
          <div style="background:#0B1220;padding:22px;border-radius:18px;color:#fff">
            <div style="font-size:20px;font-weight:800">CloudTickets</div>
            <div style="color:#9CA3AF;margin-top:6px;font-size:13px">Ticket enviado 🎟️</div>
          </div>

          <div style="padding:18px 4px 0 4px;color:#111827">
            <p style="margin:0 0 8px 0;font-size:16px">Hola,</p>
            <p style="margin:0 0 16px 0;font-size:14px;color:#374151">
              Te enviamos el ticket para <b>${t.event_name}</b>. 
              Adjuntamos el PDF con el QR para ingresar.
            </p>

            <div style="background:#fff;border:1px solid #E5E7EB;border-radius:16px;padding:14px;box-shadow:0 6px 14px rgba(0,0,0,.08)">
              <div style="font-weight:800;font-size:16px">${t.event_name}</div>
              <div style="color:#6B7280;font-size:12px;margin-top:8px">
                Ticket #${t.id} • Código: <b>${t.unique_code}</b> • Tipo: ${t.type_name}
              </div>
            </div>

            <p style="margin-top:16px;color:#9CA3AF;font-size:12px;text-align:center">
              © 2026 CloudTickets
            </p>
          </div>
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

const nodemailer = require('nodemailer')
const QRCode = require('qrcode')
const db = require('../db')

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST
  port: parseInt(process.env.SMTP_PORT
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
  connectionTimeout: 20000, 
  greetingTimeout: 20000,
});

// Esto probará la conexión y te dirá en los logs de Railway si es exitosa
transporter.verify(function (error, success) {
  if (error) {
    console.log("❌ Error en la configuración de correo:", error);
  } else {
    console.log("✅ El servidor de correo está listo para enviar mensajes");
  }
});

async function sendTicketsEmailForOrder(orderId) {
  // 1) Reclamar envío (IDEMPOTENCIA)
  // Solo el primero que logre pasar PENDING->SENDING sigue.
  const claim = await db.query(
    `UPDATE orders
       SET email_status = 'SENDING',
           email_last_error = NULL
     WHERE id = $1
       AND email_status IN ('PENDING')
       AND email_sent_at IS NULL
     RETURNING id, buyer_name, buyer_email`,
    [orderId]
  )

  if (!claim.rows.length) {
    // Ya se envió o alguien más lo está enviando
    return { ok: true, skipped: true }
  }

  const order = claim.rows[0]
  if (!order.buyer_email) {
    await db.query(
      `UPDATE orders
          SET email_status='PENDING',
              email_last_error='NO_BUYER_EMAIL'
        WHERE id=$1`,
      [orderId]
    )
    return { ok: false, error: 'NO_BUYER_EMAIL' }
  }

  try {
    // 2) Traer tickets + info de evento + tipo
    const { rows: tickets } = await db.query(
      `SELECT
          t.id,
          t.unique_code,
          t.qr_payload,
          t.status,

          tt.name AS ticket_type_name,

          e.name AS event_name,
          e.start_datetime AS event_start_datetime,
          e.image_url AS event_image_url

      FROM tickets t
      JOIN ticket_types tt ON tt.id = t.ticket_type_id
      JOIN events e ON e.id = tt.event_id
      WHERE t.order_id = $1
      ORDER BY t.created_at ASC`,
      [orderId]
    )


    if (!tickets.length) {
      await db.query(
        `UPDATE orders
            SET email_status='PENDING',
                email_last_error='NO_TICKETS'
          WHERE id=$1`,
        [orderId]
      )
      return { ok: false, error: 'NO_TICKETS' }
    }

    // 3) Armar HTML + QRs inline (CID)
    const eventName = tickets[0].event_name
    const eventStart = new Date(tickets[0].event_start_datetime).toLocaleString()
    const eventImage = tickets[0].event_image_url
      ? new Date(tickets[0].event_starts_at).toLocaleString()
      : ''
    const eventVenue = tickets[0].event_venue || ''

    const attachments = []
    const ticketBlocks = []

    for (const t of tickets) {
      const cid = `qr-${t.id}@cloudtickets`
      const pngBuffer = await QRCode.toBuffer(t.qr_payload, { type: 'png', margin: 1, scale: 6 })

      attachments.push({
        filename: `ticket-${t.unique_code}.png`,
        content: pngBuffer,
        cid, // 👈 esto permite inline
        contentType: 'image/png',
      })

      ticketBlocks.push(`
        <div style="border:1px solid #e5e7eb;border-radius:12px;padding:14px;margin:12px 0;">
          <div style="display:flex;gap:14px;align-items:center;">
            <img src="cid:${cid}" width="140" height="140" style="border-radius:10px;border:1px solid #eee;" />
            <div>
              <div style="font-size:14px;color:#6b7280;">Tipo</div>
              <div style="font-size:16px;font-weight:600;margin-bottom:8px;">${escapeHtml(
                t.ticket_type_name || 'Ticket'
              )}</div>

              <div style="font-size:14px;color:#6b7280;">Código</div>
              <div style="font-size:18px;font-weight:700;letter-spacing:0.5px;">${escapeHtml(
                t.unique_code
              )}</div>

              <div style="margin-top:8px;font-size:12px;color:#6b7280;">Estado: ${escapeHtml(
                t.status || 'ACTIVE'
              )}</div>
            </div>
          </div>
        </div>
      `)
    }

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;padding:18px;color:#111827;">
        <div style="border-radius:16px;padding:18px;background:#111827;color:#fff;">
          <div style="font-size:18px;font-weight:700;">CloudTickets</div>
          <div style="font-size:13px;opacity:.85;margin-top:4px;">Tus tickets están listos 🎟️</div>
        </div>

        <div style="margin-top:18px;">
          <h2 style="margin:0 0 6px 0;">Hola ${escapeHtml(order.buyer_name || '')},</h2>

          <div style="margin-top:10px;border:1px solid #e5e7eb;border-radius:12px;padding:14px;">
            ${
              eventImage
                ? `<img src="${eventImage}" alt="Evento" style="width:100%;border-radius:10px;margin-bottom:12px;" />`
                : ''
            }

            <div style="font-size:12px;color:#6b7280;">Evento</div>
            <div style="font-size:18px;font-weight:700;">${escapeHtml(eventName)}</div>

            <div style="margin-top:6px;font-size:14px;color:#374151;">
              <strong>Fecha:</strong> ${escapeHtml(eventStart)}
            </div>
          </div>

          <div style="margin-top:16px;font-size:14px;color:#374151;">
            Presenta el QR de cada ticket en la entrada:
          </div>

          ${ticketBlocks.join('')}

          <div style="margin-top:16px;font-size:12px;color:#6b7280;">
            Si no ves los QR embebidos, revisa los adjuntos del correo.
          </div>
        </div>
      </div>
    `


    // 4) Enviar correo
    await transporter.sendMail({
      from: `"CloudTickets" <${process.env.GMAIL_USER}>`,
      to: order.buyer_email,
      subject: `Tus tickets - ${eventName || 'CloudTickets'}`,
      html,
      attachments,
    })

    // 5) Marcar como enviado
    await db.query(
      `UPDATE orders
          SET email_status='SENT',
              email_sent_at=NOW(),
              email_last_error=NULL
        WHERE id=$1`,
      [orderId]
    )

    return { ok: true, sentTo: order.buyer_email, ticketCount: tickets.length }
  } catch (err) {
    // Volver a PENDING para reintentar luego
    await db.query(
      `UPDATE orders
          SET email_status='PENDING',
              email_last_error=$2
        WHERE id=$1`,
      [orderId, String(err?.message || err)]
    )
    throw err
  }
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

module.exports = { sendTicketsEmailForOrder }

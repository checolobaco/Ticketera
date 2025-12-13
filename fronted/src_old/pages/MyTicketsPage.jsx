import React, { useState } from 'react'
import api from '../api'
import QRCode from 'react-qr-code'
import QRCodeLib from 'qrcode'
import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'
import { Filesystem, Directory } from '@capacitor/filesystem'

export default function MyTicketsPage() {
  const [ticketId, setTicketId] = useState('')
  const [ticketResult, setTicketResult] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSearch = async e => {
    e.preventDefault()
    setError(null)
    setTicketResult(null)

    if (!ticketId) {
      setError('Ingresa un ID de ticket')
      return
    }

    try {
      setLoading(true)
      const res = await api.get(`/api/tickets/${ticketId}`)
      setTicketResult(res.data)
    } catch (err) {
      console.error(err)
      setError('No se encontró el ticket o hubo un error en el servidor')
    } finally {
      setLoading(false)
    }
  }

  // --------- Generar imagen bonita del ticket (para compartir/descargar) ----------
  const generateTicketImage = async (ticket) => {
    const qrDataUrl = await QRCodeLib.toDataURL(ticket.qr_payload, {
      errorCorrectionLevel: 'M',
      scale: 8,
    })

    const width = 800
    const height = 1000
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')

    // Fondo
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    const eventName = ticket.event_name || 'Entrada al evento'
    const holderName = ticket.holder_name || 'Invitado'
    const ticketCode = ticket.unique_code

    // Título
    ctx.fillStyle = '#1f2933'
    ctx.textAlign = 'center'
    ctx.font = 'bold 38px system-ui'
    ctx.fillText(eventName, width / 2, 90)

    ctx.font = '24px system-ui'
    ctx.fillStyle = '#4b5563'
    ctx.fillText(`¡Gracias por asistir, ${holderName}!`, width / 2, 140)

    ctx.font = '20px system-ui'
    ctx.fillText('Presenta este código en el acceso al evento.', width / 2, 180)

    // QR
    const qrImg = new Image()
    await new Promise((resolve, reject) => {
      qrImg.onload = resolve
      qrImg.onerror = reject
      qrImg.src = qrDataUrl
    })

    const qrSize = 400
    const qrX = (width - qrSize) / 2
    const qrY = 230
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)

    // Código
    ctx.font = 'bold 24px system-ui'
    ctx.fillStyle = '#111827'
    ctx.fillText(`Código: ${ticketCode}`, width / 2, qrY + qrSize + 60)

    ctx.font = '18px system-ui'
    ctx.fillStyle = '#6b7280'
    ctx.fillText(
      'No compartas esta imagen con personas no autorizadas.',
      width / 2,
      qrY + qrSize + 100
    )

    return canvas.toDataURL('image/png')
  }
  // Guarda la imagen en el sistema de archivos nativo y abre el menú de compartir de Android
  const shareNativeTicketImage = async (ticket, message) => {
    // 1) Generar imagen PNG como dataURL
    const dataUrl = await generateTicketImage(ticket)

    // 2) Extraer la parte base64 ("data:image/png;base64,....")
    const base64 = dataUrl.split(',')[1]

    // 3) Guardar en directorio de caché de la app
    const fileName = `ticket-${ticket.id}-${Date.now()}.png`
    const result = await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Cache
    })

    const fileUri = result.uri // tipo: file://...

    // 4) Compartir usando el Share nativo (Android abrirá el menú: WhatsApp, Gmail, etc.)
    await Share.share({
      title: 'Tu ticket',
      text: message,
      url: fileUri,        // <- aquí va la imagen adjunta
      dialogTitle: 'Compartir ticket'
    })
  }

  // --------- Compartir imagen (desde el dispositivo o descargar) ----------
  const sharePrettyTicketImage = async (ticket) => {
  const text = `Ticket para ${ticket.holder_name || 'invitado'} - ${ticket.event_name || 'Evento'}`

    try {
      if (Capacitor.isNativePlatform()) {
        // APK: compartir nativo con imagen adjunta
        await shareNativeTicketImage(ticket, text)
        return
      }

      // Web normal (navegador) -> lo que ya tenías
      const dataUrl = await generateTicketImage(ticket)
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      const file = new File([blob], `ticket-${ticket.id}.png`, { type: 'image/png' })

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file], text })) {
        await navigator.share({
          title: 'Tu ticket',
          text,
          files: [file],
        })
      } else {
        const link = document.createElement('a')
        link.href = dataUrl
        link.download = `ticket-${ticket.id}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        alert('Se descargó la imagen del ticket con el QR y los datos.')
      }
    } catch (err) {
      console.error(err)
      alert('No se pudo generar/compartir la imagen del ticket.')
    }
  }


  // --------- Compartir como enlace a redes/apps concretas ----------
  const getTicketUrl = (ticket) => {
    // si más adelante tienes /ticket/:tid público, cambia aquí
    return `${window.location.origin}/my-tickets?id=${ticket.id}`
  }

  const shareWhatsApp = async (ticket) => {
    const url = getTicketUrl(ticket)
    const msgBase =
      `🎫 Tu ticket para ${ticket.event_name || 'el evento'}\n` +
      `Titular: ${ticket.holder_name || 'invitado'}\n` +
      `Código: ${ticket.unique_code}\n\n` +
      `Ver detalles: ${url}`

    try {
      if (Capacitor.isNativePlatform()) {
        // APK: usamos el mismo share nativo (Android te dejará elegir WhatsApp en la hoja de compartir)
        await shareNativeTicketImage(ticket, msgBase)
        return
      }

      // Web normal: wa.me + descarga (como antes)
      alert(
        'Tu navegador no permite adjuntar la imagen automáticamente en WhatsApp. ' +
        'Se enviará sólo el texto y el enlace, y se descargará la imagen para que puedas adjuntarla manualmente.'
      )

      const waUrl = `https://wa.me/?text=${encodeURIComponent(msgBase)}`
      window.open(waUrl, '_blank')

      const dataUrl = await generateTicketImage(ticket)
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `ticket-${ticket.id}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error(err)
      alert('No se pudo compartir el ticket por WhatsApp.')
    }
  }

  const shareEmail = async (ticket) => {
    const url = getTicketUrl(ticket)
    const subject = `Tu ticket para ${ticket.event_name || 'el evento'}`
    const bodyText =
      `Hola ${ticket.holder_name || ''},\n\n` +
      `Te compartimos tu ticket:\n` +
      `Evento: ${ticket.event_name || ''}\n` +
      `Código: ${ticket.unique_code}\n\n` +
      `Puedes ver el QR en: ${url}\n\n` +
      `¡Gracias por asistir!`

    try {
      if (Capacitor.isNativePlatform()) {
        // APK: hoja de compartir (Gmail / Outlook con imagen adjunta)
        await shareNativeTicketImage(ticket, `${subject}\n\n${bodyText}`)
        return
      }

      // Web normal: mailto + descarga
      alert(
        'Tu navegador no permite adjuntar la imagen automáticamente en el correo. ' +
        'Se abrirá el correo con texto y enlace, y se descargará la imagen para que la adjuntes manualmente.'
      )

      const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`
      window.location.href = mailto

      const dataUrl = await generateTicketImage(ticket)
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `ticket-${ticket.id}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error(err)
      alert('No se pudo preparar el correo con el ticket.')
    }
  }


  return (
    <div>
      <h1 className="app-title">Mis tickets</h1>
      <p className="app-subtitle">
        Busca un ticket por ID y compártelo fácilmente por redes o correo.
      </p>

      <div className="stack-md">
        <form onSubmit={handleSearch} className="stack-sm">
          <div>
            <label>ID de ticket</label>
            <div className="row">
              <input
                type="number"
                value={ticketId}
                onChange={e => setTicketId(e.target.value)}
                placeholder="Ej: 42"
              />
              <button type="submit" className="btn-primary">
                Buscar
              </button>
            </div>
          </div>
        </form>

        {loading && <div>Cargando...</div>}
        {error && <div style={{ color: 'red' }}>{error}</div>}

        {ticketResult && (
          <div className="ticket-card">
            <div className="ticket-card-header">
              <div className="stack-sm">
                <div className="badge">
                  <span>Ticket #{ticketResult.id}</span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>
                  {ticketResult.event_name || 'Evento'}
                </div>
                <div style={{ fontSize: 13, color: '#6b7380' }}>
                  Titular: {ticketResult.holder_name || 'Invitado'}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 11, color: '#9ca3af' }}>
                Código interno<br />
                {ticketResult.unique_code}
              </div>
            </div>

            <div className="ticket-qr-box">
              <QRCode value={ticketResult.qr_payload} size={170} />
            </div>

            <div className="stack-md" style={{ marginTop: 14 }}>
              <div className="row wrap">
                <button
                  className="btn-primary"
                  onClick={() => sharePrettyTicketImage(ticketResult)}
                >
                  Compartir / descargar imagen
                </button>
                <button className="btn-ghost" onClick={() => shareWhatsApp(ticketResult)}>
                  WhatsApp
                </button>
                <button className="btn-ghost" onClick={() => shareEmail(ticketResult)}>
                  Correo
                </button>
              </div>

              <small style={{ color: '#6b7380' }}>
                En un celular, <strong>“Compartir / descargar imagen”</strong> abrirá el menú
                nativo (WhatsApp, correo, Messenger, etc.) si tu navegador lo soporta.
              </small>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

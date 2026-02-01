// MyTicketsPage.jsx
import React, { useState, useEffect } from 'react'
import api from '../api'
import QRCode from 'react-qr-code'
import QRCodeLib from 'qrcode'
import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'
import { Filesystem, Directory } from '@capacitor/filesystem'

export default function MyTicketsPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [eventData, setEventData] = useState(null)

  const user = JSON.parse(localStorage.getItem('user') || 'null')
  const isClient = user?.role === 'CLIENT'

  // Drawer correo (Resend backend)
  const [emailDrawerOpen, setEmailDrawerOpen] = useState(false)
  const [emailTo, setEmailTo] = useState('')
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [sendingEmail, setSendingEmail] = useState(false)

  useEffect(() => {
    if (!isClient) return
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await api.get('/api/tickets/my')
        setResults(res.data)
      } catch (e) {
        console.error(e)
        setError('No se pudieron cargar tus tickets')
      } finally {
        setLoading(false)
      }
    })()
  }, [isClient])

  const handleSearch = async () => {
    setError(null)
    setResults([])
    setLoading(true)

    if (isClient) {
      setError('Los clientes no pueden buscar tickets de otros usuarios.')
      setLoading(false)
      return
    }

    const q = query.trim()

    if (q.length < 2) {
      setLoading(false)
      setError('Escribe al menos 2 caracteres')
      return
    }

    try {
      const res = await api.get('/api/tickets/search', { params: { q } })
      setResults(res.data || [])
    } catch (e) {
      console.error(e)
      setError('Error buscando tickets')
    } finally {
      setLoading(false)
    }
  }

  // --------- Drawer correo (Resend backend) ----------
  const openEmailDrawer = (ticket) => {
    setSelectedTicket(ticket)
    setEmailTo(ticket.holder_email || user?.email || '')
    setEmailDrawerOpen(true)
  }

  const sendTicketByEmail = async () => {
    if (!selectedTicket) return

    const to = (emailTo || '').trim()
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)
    if (!ok) {
      alert('Escribe un correo válido.')
      return
    }

    try {
      setSendingEmail(true)
      await api.post(`/api/tickets/${selectedTicket.id}/resend-email`, { toEmail: to })
      alert('Correo enviado ✅')
      setEmailDrawerOpen(false)
    } catch (e) {
      console.error(e)
      alert('No se pudo enviar el correo.')
    } finally {
      setSendingEmail(false)
    }
  }

  // --------- Generar imagen bonita del ticket (para compartir/descargar) ----------
  const generateTicketImage = async (t) => {
    // QR en base64
    const qrDataUrl = await QRCodeLib.toDataURL(t.qr_payload, {
      margin: 2,
      width: 700,
    })

    // Canvas
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 630
    const ctx = canvas.getContext('2d')

    // Fondo
    ctx.fillStyle = '#0B1220'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Card
    ctx.fillStyle = '#FFFFFF'
    roundRect(ctx, 60, 60, 1080, 510, 24, true, false)

    // Banda superior
    const grad = ctx.createLinearGradient(60, 60, 1140, 60)
    grad.addColorStop(0, '#2E6BFF')
    grad.addColorStop(1, '#00D4FF')
    ctx.fillStyle = grad
    roundRect(ctx, 60, 60, 1080, 88, 24, true, false)

    // Textos (usa el nombre del ticket)
    ctx.fillStyle = '#0B1220'
    ctx.font = '700 34px system-ui, -apple-system, Segoe UI, Roboto'
    ctx.fillText(t.event_name || eventData?.name || 'Evento', 90, 190)

    ctx.fillStyle = '#4B5563'
    ctx.font = '500 20px system-ui, -apple-system, Segoe UI, Roboto'
    ctx.fillText('Tu acceso está listo. Presenta este QR en la entrada.', 90, 230)

    // Titular / email (usa datos del ticket o del user logueado)
    ctx.fillStyle = '#111827'
    ctx.font = '700 22px system-ui, -apple-system, Segoe UI, Roboto'
    ctx.fillText(`Titular: ${t.holder_name || user?.name || '—'}`, 90, 280)

    ctx.fillStyle = '#374151'
    ctx.font = '500 20px system-ui, -apple-system, Segoe UI, Roboto'
    ctx.fillText(`Correo: ${t.holder_email || user?.email || '—'}`, 90, 312)

    // Código interno
    ctx.fillStyle = '#6B7280'
    ctx.font = '500 18px system-ui, -apple-system, Segoe UI, Roboto'
    ctx.fillText(`Ticket #${t.id} • Código: ${t.unique_code}`, 90, 350)

    // QR
    const qrImg = new Image()
    qrImg.src = qrDataUrl
    await new Promise((resolve, reject) => {
      qrImg.onload = resolve
      qrImg.onerror = reject
    })

    // Marco QR
    ctx.fillStyle = '#F3F4F6'
    roundRect(ctx, 780, 170, 300, 300, 18, true, false)
    ctx.drawImage(qrImg, 800, 190, 260, 260)

    // Footer pequeño
    ctx.fillStyle = '#6B7280'
    ctx.font = '500 16px system-ui, -apple-system, Segoe UI, Roboto'
    ctx.fillText('CloudTickets • FunPass', 90, 520)

    return canvas.toDataURL('image/png')
  }

  function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    if (w < 2 * r) r = w / 2
    if (h < 2 * r) r = h / 2
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
    if (fill) ctx.fill()
    if (stroke) ctx.stroke()
  }

  // Guarda la imagen en el sistema de archivos nativo y abre el menú de compartir de Android
  const shareNativeTicketImage = async (ticket, message) => {
    const dataUrl = await generateTicketImage(ticket)
    const base64 = dataUrl.split(',')[1]

    const fileName = `ticket-${ticket.id}-${Date.now()}.png`
    const result = await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Cache,
    })

    const fileUri = result.uri

    await Share.share({
      title: 'Tu ticket',
      text: message,
      url: fileUri,
      dialogTitle: 'Compartir ticket',
    })
  }

  // --------- Compartir imagen (desde el dispositivo o descargar) ----------
  const sharePrettyTicketImage = async (ticket) => {
    const text = `Ticket para ${ticket.holder_name || 'invitado'} - ${ticket.event_name || 'Evento'}`

    try {
      if (Capacitor.isNativePlatform()) {
        await shareNativeTicketImage(ticket, text)
        return
      }

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
        await shareNativeTicketImage(ticket, msgBase)
        return
      }

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

  return (
    <div>
      <h1 className="app-title">Mis tickets</h1>

      <div className="stack-md">
        {!isClient && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSearch()
            }}
            className="stack-sm"
          >
            <div>
              <p className="app-subtitle">Busca un ticket por ID y compártelo fácilmente por redes o correo.</p>
              <label>Buscar ticket</label>
              <div className="row">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Nombre, email, teléfono, cédula, evento, ID o código"
                />
                <button type="submit" className="btn-primary">
                  Buscar
                </button>
              </div>
            </div>
          </form>
        )}

        {loading && <div>Cargando...</div>}
        {error && <div style={{ color: 'red' }}>{error}</div>}

        {!isClient && !loading && !error && results.length === 0 && query.trim().length >= 2 && (
          <div style={{ color: '#6b7380' }}>No se encontraron tickets con ese dato.</div>
        )}

        {results.length > 0 && (
          <div className="stack-md">
            {results.map((t) => (
              <div key={t.id} className="ticket-card">
                <div className="ticket-card-header">
                  <div className="stack-sm">
                    <div className="badge">
                      <span>Ticket #{t.id}</span>
                    </div>

                    <div style={{ fontSize: 15, fontWeight: 600 }}>{t.event_name || 'Evento'}</div>

                    <div style={{ fontSize: 13, color: '#6b7380' }}>
                      Titular: {t.holder_name || 'Invitado'}
                    </div>

                    {t.holder_email && (
                      <div style={{ fontSize: 12, color: '#6b7380' }}>Email: {t.holder_email}</div>
                    )}
                    {t.holder_phone && (
                      <div style={{ fontSize: 12, color: '#6b7380' }}>Tel: {t.holder_phone}</div>
                    )}
                    {t.holder_cc && (
                      <div style={{ fontSize: 12, color: '#6b7380' }}>Cédula: {t.holder_cc}</div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right', fontSize: 11, color: '#9ca3af' }}>
                    Código interno
                    <br />
                    {t.unique_code}
                  </div>
                </div>

                <div className="ticket-qr-box">
                  <QRCode value={t.qr_payload} size={170} />
                </div>

                <div className="stack-md" style={{ marginTop: 14 }}>
                  <div className="row wrap">
                    <div className="actions-row">
                      <button className="btn-primary" onClick={() => sharePrettyTicketImage(t)}>
                        Descargar
                      </button>

                      {/* Si quieres habilitar WhatsApp de nuevo, descomenta */}
                      {/* <button className="btn-primary" onClick={() => shareWhatsApp(t)}>
                        WhatsApp
                      </button> */}

                      <button className="btn-primary" onClick={() => openEmailDrawer(t)}>
                        Correo
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Drawer correo */}
      {emailDrawerOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.35)',
            display: 'flex',
            justifyContent: 'flex-end',
            zIndex: 9999,
          }}
          onClick={() => !sendingEmail && setEmailDrawerOpen(false)}
        >
          <div className="app-card" style={{ width: '90%', maxWidth: '400px', padding: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>Enviar ticket por correo</div>
              <button
                className="btn-primary"
                onClick={() => !sendingEmail && setEmailDrawerOpen(false)}
                style={{ padding: '6px 10px' }}
              >
                X
              </button>
            </div>

            <div style={{ marginTop: 12, fontSize: 13, color: '#6b7380' }}>
              Ticket #{selectedTicket?.id} • {selectedTicket?.event_name || 'Evento'}
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>Enviar a</label>
              <input
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="correo@dominio.com"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid #E5E7EB',
                  outline: 'none',
                }}
              />
              <div style={{ marginTop: 8, fontSize: 12, color: '#9ca3af' }}>
                Se enviará un PDF (media carta) con el QR adjunto.
              </div>
            </div>

            <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
              <button
                className="btn-primary"
                disabled={sendingEmail}
                onClick={sendTicketByEmail}
                style={{ flex: 1, opacity: sendingEmail ? 0.7 : 1 }}
              >
                {sendingEmail ? 'Enviando…' : 'Enviar'}
              </button>

              <button
                className="btn-primary"
                disabled={sendingEmail}
                onClick={() => setEmailDrawerOpen(false)}
                style={{ background: '#111827', flex: 1, opacity: sendingEmail ? 0.7 : 1 }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

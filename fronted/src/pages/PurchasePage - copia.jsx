import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../api'
import QRCode from 'react-qr-code'
import QRCodeLib from 'qrcode'

// ✅ Nativo (APK)
import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'
import { Filesystem, Directory } from '@capacitor/filesystem'

export default function PurchasePage() {
  const { id } = useParams()
  const [eventData, setEventData] = useState(null)
  const [ticketTypes, setTicketTypes] = useState([])
  const [quantities, setQuantities] = useState({})
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [orderResult, setOrderResult] = useState(null)
  const [loadingEmail, setLoadingEmail] = useState(false)

  // 👤 datos básicos del cliente
  const [customer, setCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    cc: ''
  })

  useEffect(() => {
    const load = async () => {
      try {
        const evRes = await api.get('/api/events')
        const event = evRes.data.find(e => String(e.id) === String(id))
        setEventData(event || null)

        const ttRes = await api.get('/api/ticket-types', {
          params: { eventId: id }
        })
        setTicketTypes(ttRes.data)
      } catch (err) {
        console.error(err)
        setError('Error cargando datos de evento o tipos de ticket')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  // Drawer correo (Resend backend)
  const [emailDrawerOpen, setEmailDrawerOpen] = useState(false)
  const [emailTo, setEmailTo] = useState('')
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [sendingEmail, setSendingEmail] = useState(false)

  // Abrir el modal y pre-cargar el correo del cliente
  const openEmailDrawer = (ticket) => {
    setSelectedTicket(ticket)
    setEmailTo(customer.email || '') // Pre-llena con el email usado en la compra
    setEmailDrawerOpen(true)
  }

  // Estados exclusivos para el envío de órdenes
  const [orderDrawerOpen, setOrderDrawerOpen] = useState(false);
  const [orderEmailTo, setOrderEmailTo] = useState('');
  const [isSendingBulk, setIsSendingBulk] = useState(false);

  const openOrderEmailDrawer = () => {
    // Sacamos el email del cliente y el ID de la orden del objeto orderResult
    const emailDeCompra = customer?.email || orderResult?.order?.buyer_email || '';
    
    setOrderEmailTo(emailDeCompra);
    setOrderDrawerOpen(true);
  };

  // Llamada a tu API de Resend
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
      // Usamos la misma ruta que en MyTicketsPage
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

  const validateForm = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!customer.name.trim()) newErrors.name = "El nombre es obligatorio";
    
    if (!customer.email.trim()) {
      newErrors.email = "El correo es obligatorio";
    } else if (!emailRegex.test(customer.email.trim())) {
      newErrors.email = "Formato de correo inválido";
    }

    if (!customer.phone.trim()) newErrors.phone = "El teléfono es obligatorio";
    
    if (!customer.cc.trim()) newErrors.cc = "La cédula es obligatoria";

    // Validar si hay tickets seleccionados
    const hasTickets = Object.values(quantities).some(qty => qty > 0);
    if (!hasTickets) newErrors.tickets = "Debes seleccionar al menos un ticket";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0; // Retorna true si no hay errores
  };

  const handleQuantityChange = (typeId, value) => {
    const qty = parseInt(value || '0', 10)
    setQuantities(prev => ({ ...prev, [typeId]: isNaN(qty) ? 0 : qty }))
  }

  const handleBuy = async () => {
    setError(null)
    setErrors({})
    setOrderResult(null)

    const items = Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([ticketTypeId, quantity]) => ({
        ticketTypeId: Number(ticketTypeId),
        quantity
      }))

    if (!validateForm()) return;

    try {
      const res = await api.post('/api/orders', { customer, items })
      setOrderResult(res.data)
    } catch (err) {
      console.error(err)
      setError('Error creando la orden')
    }
  }

  const handlePayWithWompi = async () => {
    setError(null)
    setErrors({})
    setOrderResult(null)

    const items = Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([ticketTypeId, quantity]) => ({
        ticketTypeId: Number(ticketTypeId),
        quantity
      }))

    if (!validateForm()) return;

    try {
      // 🔥 Inicia checkout en backend
      const res = await api.post('/api/checkout/start', { customer, items })
      const c = res.data.checkout

      const redirectUrlWithRef =
        `${c.redirectUrl}?reference=${encodeURIComponent(c.reference)}`

      const wompiUrl =
        `https://checkout.wompi.co/p/` +
        `?public-key=${encodeURIComponent(c.publicKey)}` +
        `&currency=${encodeURIComponent(c.currency)}` +
        `&amount-in-cents=${encodeURIComponent(c.amountInCents)}` +
        `&reference=${encodeURIComponent(c.reference)}` +
        `&signature:integrity=${encodeURIComponent(c.signature)}` +
        `&redirect-url=${encodeURIComponent(redirectUrlWithRef)}`

      window.location.href = wompiUrl
    } catch (err) {
      console.error(err)
      setError('Error iniciando pago con Wompi')
    }
  }



  // ---------------------------
  // ✅ Helpers para compartir
  // ---------------------------

  const getTicketUrl = (t) => {
    // si ya tienes una ruta pública de ticket, úsala aquí.
    // por ahora, solo referencia
    return `${window.location.origin}/my-tickets`
  }

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

    // Textos
    ctx.fillStyle = '#0B1220'
    ctx.font = '700 34px system-ui, -apple-system, Segoe UI, Roboto'
    ctx.fillText(eventData?.name || 'Evento', 90, 190)

    ctx.fillStyle = '#4B5563'
    ctx.font = '500 20px system-ui, -apple-system, Segoe UI, Roboto'
    ctx.fillText('Tu acceso está listo. Presenta este QR en la entrada.', 90, 230)

    // Titular / email
    ctx.fillStyle = '#111827'
    ctx.font = '700 22px system-ui, -apple-system, Segoe UI, Roboto'
    ctx.fillText(`Titular: ${t.holder_name || customer.name || '—'}`, 90, 280)

    ctx.fillStyle = '#374151'
    ctx.font = '500 20px system-ui, -apple-system, Segoe UI, Roboto'
    //ctx.fillText(`Correo: ${t.holder_email || customer.email || '—'}`, 90, 312)
    ctx.fillText(`Correooo: ${t.holder_email || customer.email || '—'}`, 90, 312)

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

  const shareNativeTicketImage = async (t, message) => {
    const dataUrl = await generateTicketImage(t)
    const base64 = dataUrl.split(',')[1]
    const fileName = `ticket-${t.id}-${Date.now()}.png`

    const result = await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Cache
    })

    await Share.share({
      title: 'Tu ticket',
      text: message,
      url: result.uri,
      dialogTitle: 'Compartir ticket'
    })
  }

  const sharePrettyTicketImage = async (t) => {
    const url = getTicketUrl(t)
    const text =
      `🎫 Ticket para ${eventData?.name || 'el evento'}\n` +
      `Titular: ${t.holder_name || customer.name || '—'}\n` +
      `Correo: ${t.holder_email || customer.email || '—'}\n` +
      `Ticket #${t.id} • Código: ${t.unique_code}\n` +
      `Ver: ${url}`

    try {
      if (Capacitor.isNativePlatform()) {
        await shareNativeTicketImage(t, text)
        return
      }

      // Web: compartir si soporta files, si no: descargar
      const dataUrl = await generateTicketImage(t)
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      const file = new File([blob], `ticket-${t.id}.png`, { type: 'image/png' })

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file], text })) {
        await navigator.share({ title: 'Tu ticket', text, files: [file] })
      } else {
        const link = document.createElement('a')
        link.href = dataUrl
        link.download = `ticket-${t.id}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    } catch (e) {
      console.error(e)
      alert('No se pudo generar/compartir la imagen.')
    }
  }

  const shareWhatsApp = async (t) => {
    const url = getTicketUrl(t)
    const msg =
      `🎫 Tu ticket para ${eventData?.name || 'el evento'}\n` 
      + `Titular: ${t.holder_name || customer.name || '—'}\n` 
      + `Ticket #${t.id} • Código: ${t.unique_code}\n\n` 
      /*+ `Ver: ${url}`*/

    try {
      if (Capacitor.isNativePlatform()) {
        await shareNativeTicketImage(t, msg) // menú nativo, eliges WhatsApp
        return
      }

      // Web: wa.me + descarga
      const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`
      window.open(waUrl, '_blank')

      const dataUrl = await generateTicketImage(t)
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `ticket-${t.id}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (e) {
      console.error(e)
      alert('No se pudo compartir por WhatsApp.')
    }
  }

  const shareEmail = async (t) => {
    const url = getTicketUrl(t)
    const subject = `Tu ticket para ${eventData?.name || 'el evento'}`
    const body =
      `Hola ${t.holder_name || customer.name || ''},\n\n` +
      `Aquí está tu ticket:\n` +
      `Evento: ${eventData?.name || ''}\n` +
      `Ticket #${t.id}\n` +
      `Código: ${t.unique_code}\n\n` +
      /*`Enlace: ${url}\n\n` +*/
      `¡Nos vemos pronto!`

    try {
      if (Capacitor.isNativePlatform()) {
        await shareNativeTicketImage(t, `${subject}\n\n${body}`) // eliges Gmail/Correo
        return
      }

      // ✅ correo “Para” precargado
      const to = t.holder_email || customer.email || ''
      const mailto =
        `mailto:${encodeURIComponent(to)}` +
        `?subject=${encodeURIComponent(subject)}` +
        `&body=${encodeURIComponent(body)}`
      window.location.href = mailto

      // descargar imagen para adjuntar manualmente si quieres
      const dataUrl = await generateTicketImage(t)
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `ticket-${t.id}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (e) {
      console.error(e)
      alert('No se pudo preparar el correo.')
    }
  }

  const handleResendEmail = async () => {
    const idDeOrden = orderResult?.order?.id || orderResult?.id;
    if (!idDeOrden) return alert('No se encontró el ID de la orden')
    setLoadingEmail(true)
    try {
      await api.post(`/api/orders/${idDeOrden}/resend-email`)
      alert('✅ Correo de tickets reenviado con éxito.')
    } catch (err) {
      console.error(err)
      alert('❌ Error al reenviar el correo.')
    } finally {
      setLoadingEmail(false)
    }
  }

  const sendAllTicketsByEmail = async () => {
    const idDeOrden = orderResult?.order?.id || orderResult?.id;
                      
    if (!idDeOrden) return alert('No se encontró el ID de la orden');
  
  // Opcional: Confirmación para evitar clics accidentales que saturen Puppeteer
  const confirmar = window.confirm("¿Deseas recibir un único correo con todos los tickets de esta orden?");
  if (!confirmar) return;

  setLoadingEmail(true);
  try {
    // Usamos el endpoint que configuramos para procesar la ORDEN completa
    await api.post(`/api/orders/${idDeOrden}/resend-email`)
    alert('✅ ¡Éxito! Se ha enviado un correo con todos tus tickets adjuntos.');
  } catch (err) {
    console.error(err);
    // Si el error es 500, damos un mensaje más útil
    const msg = err.response?.status === 500 
      ? 'El servidor está ocupado generando los PDF. Por favor, intenta de nuevo en un momento.' 
      : 'No pudimos procesar el envío masivo.';
    alert(`❌ ${msg}`);
  } finally {
    setLoadingEmail(false);
  }
};

  // ---------------------------

  if (loading) return <div>Cargando...</div>
  if (error) return <div style={{ color: 'red' }}>{error}</div>
  if (!eventData) return <div>Evento no encontrado</div>



  return (
    // Este log se disparará cada vez que orderResult cambie



    <div>
      <h2>Comprar tickets para: {eventData.name}</h2>
      <p>{eventData.description}</p>

      <h3>Datos del titular del ticket</h3>
      <div style={{ maxWidth: '400px', marginBottom: '15px' }}>
        <div style={{ marginBottom: '8px' }}>
          <label>Nombre</label>
          <input
            type="text"
            value={customer.name}
            onChange={e => {
              setCustomer({ ...customer, name: e.target.value });
              if (errors.name) setErrors({ ...errors, name: null });
            }}
            style={{ width: '100%', padding: '8px', border: errors.name ? '2px solid red' : '1px solid #ccc' }}
          />
          {errors.name && <span style={{ color: 'red', fontSize: '12px' }}>{errors.name}</span>}
        </div>
        <div style={{ marginBottom: '8px' }}>
          <label>Email</label>
          <input
            type="email"
            inputMode="email"
            value={customer.email}
            onChange={e => {
              setCustomer({ ...customer, email: e.target.value });
              if (errors.email) setErrors({ ...errors, email: null }); // Limpia el error al escribir
            }}
            style={{ 
              width: '100%', 
              padding: '8px',
              border: errors.email ? '2px solid #ef4444' : '1px solid #ccc', // Borde rojo si hay error
              borderRadius: '6px'
            }}
          />
          {errors.email && (
            <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>
              {errors.email}
            </span>
          )}
        </div>
        <div style={{ marginBottom: '8px' }}>
          <label>Teléfono</label>
          <input
            type="text"
            value={customer.phone}
            onChange={e => {
              setCustomer({ ...customer, phone: e.target.value }); // <-- CORREGIDO
              if (errors.phone) setErrors({ ...errors, phone: null });
            }}
            style={{ width: '100%', padding: '8px', border: errors.phone ? '2px solid red' : '1px solid #ccc' }}
          />
          {errors.phone && <span style={{ color: 'red', fontSize: '12px' }}>{errors.phone}</span>}
        </div>
        <div style={{ marginBottom: '8px' }}>
          <label>Cédula</label>
          <input
            type="text"
            value={customer.cc}
            onChange={e => {
              setCustomer({ ...customer, cc: e.target.value }); // <-- CORREGIDO
              if (errors.cc) setErrors({ ...errors, cc: null });
            }}
            style={{ width: '100%', padding: '8px', border: errors.cc ? '2px solid red' : '1px solid #ccc' }}
          />
          {errors.cc && <span style={{ color: 'red', fontSize: '12px' }}>{errors.cc}</span>}
        </div>
      </div>

      <h3>Tipos de ticket</h3>
      {ticketTypes.length === 0 ? (
        <div>No hay tipos de ticket configurados para este evento.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Precio</th>
              <th>Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {ticketTypes.map(tt => (
              <tr key={tt.id}>
                <td>{tt.name}</td>
                <td>{new Intl.NumberFormat('es-ES').format(tt.price_pesos)}</td>
                <td>
                  <input
                    type="number"
                    min=""
                    value={quantities[tt.id] }
                    onChange={e => handleQuantityChange(tt.id, e.target.value)}
                    style={{ width: '60px' }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      
{!orderResult && (      
      <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
        {/* ✅ Flujo actual (no lo tocamos) */}
        
        <button onClick={handleBuy}
          style={{
            background: 'transparent',
            border: '1px solid #9CA3AF',
            padding: '8px 12px',
            borderRadius: 10,
            cursor: 'pointer'
          }}
        >
          Confirmar compra 
        </button>
        

        {/* ✅ Botón secundario temporal Wompi */}
        <button onClick={handlePayWithWompi}
          style={{
            background: 'transparent',
            border: '1px solid #9CA3AF',
            padding: '8px 12px',
            borderRadius: 10,
            cursor: 'pointer'
          }}
        >
          Pagar (sandbox)
        </button>
      </div>
    )}


      {orderResult && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
    <div>
      <h3 style={{ margin: 0 }}>Tickets generados</h3>
      <p style={{ margin: 0, color: '#666' }}>
        Orden #{orderResult.order.id} – {orderResult.tickets.length} tickets – Total:{' '}
            {new Intl.NumberFormat('es-ES').format(orderResult.order.total_pesos )}
      </p>
    </div>
         <button className="btn-primary" 
          onClick={openOrderEmailDrawer}
          style={{fontSize: '12px'}}>
            Enviar Ahora
          </button>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
           {orderResult?.tickets?.map((t) => (
  <div key={t.id} className="app-card" style={{ marginBottom: '15px', border: '1px solid #ddd', padding: '15px' }}>
    
    <div style={{ marginBottom: '10px' }}>
      <strong>Tipo: </strong> 
      <span style={{ fontWeight: 'bold', color: '#2563eb' }}>
        {ticketTypes?.find(tipo => tipo.id === t.ticket_type_id)?.name || `Tipo #${t.ticket_type_id}`}
      </span>
    </div>

    <div><strong>Ticket ID:</strong> {t.id}</div>
    <div><strong>Código único (tid):</strong> {t.unique_code}</div>
    <div><strong>Titular:</strong> {t.holder_name}</div>
    <div><strong>Email:</strong> {t.holder_email}</div>
    
    <div style={{ marginTop: '10px' }}>
      <strong>QR:</strong>
      <div style={{ marginTop: '10px' }}>
         {/* Aquí asegúrate de tener tu lógica de QR, por ejemplo: */}
         <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${t.unique_code}`} alt="QR" style={{ width: '120px' }} />
      </div>
    </div>

    <div style={{ display: 'flex', gap: '8px', marginTop: '15px' }}>
       {/* ✅ BOTONES JUSTO DESPUÉS DE COMPRAR */}
                <div style={{ marginTop: '10px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  <button className="btn-primary" onClick={() => sharePrettyTicketImage(t)} style={{fontSize: '12px'}}>
                    Descargar
                  </button>
                  <button className="btn-primary" onClick={() => openEmailDrawer(t)} style={{fontSize: '12px'}}>
                    Enviar por Correo
                  </button>
                </div>
                
    </div>
  </div>
))}
           
            
          </div>
        </div>
      )}
  {/* Drawer correo (Copiado de MyTicketsPage) */}
  {emailDrawerOpen && (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.35)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
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
            onClick={() => !sendingEmail && setEmailDrawerOpen(false)}
            style={{ padding: '6px 10px', cursor: 'pointer' }}
          >
            X
          </button>
        </div>

        <div style={{ marginTop: 12, fontSize: 13, color: '#6b7380' }}>
          Ticket #{selectedTicket?.id} • {eventData?.name}
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
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
          <button
            className="btn-primary"
            disabled={sendingEmail}
            onClick={sendTicketByEmail}
            style={{ flex: 1, opacity: sendingEmail ? 0.7 : 1 }}
          >
            {sendingEmail ? 'Enviando…' : 'Enviar ahora'}
          </button>
        </div>
      </div>
    </div>
  )}

{orderDrawerOpen && (
  <div style={{
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', 
    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 
  }}>
    <div className="app-card" style={{ width: '90%', maxWidth: '400px', padding: '24px' }}>
      <h3>Enviar todos los tickets</h3>
      <p style={{ fontSize: '14px', color: '#666' }}>
        Se enviará un solo correo con todos los PDFs de la orden.
      </p>

      <div style={{ margin: '20px 0' }}>
        <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Correo de destino:</label>
        <input 
          type="email"
          value={orderEmailTo}
          onChange={(e) => setOrderEmailTo(e.target.value)}
          style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '8px', border: '1px solid #ddd' }}
        />
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button 
          className="btn-primary" 
          onClick={() => setOrderDrawerOpen(false)}
          style={{ flex: 1 }}
        >
          Cancelar
        </button>
        <button 
          className="btn-primary" 
          disabled={isSendingBulk}
          onClick={async () => {
            setIsSendingBulk(true);
            try {
              const idReal = orderResult?.order?.id || orderResult?.id;
              await api.post(`/api/orders/${idReal}/resend-email`, { toEmail: orderEmailTo });
              alert("✅ Todos los tickets han sido enviados.");
              setOrderDrawerOpen(false);
            } catch (err) {
              alert("❌ Error al enviar el paquete de tickets.");
            } finally {
              setIsSendingBulk(false);
            }
          }}
          style={{ flex: 2 }}
        >
          {isSendingBulk ? 'Enviando...' : 'Confirmar y Enviar'}
        </button>
      </div>
    </div>
  </div>
)}

    </div>
  )
}

import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../api'
import QRCode from 'react-qr-code'
import QRCodeLib from 'qrcode'

// ✅ Nativo (APK)
import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'
import { Filesystem, Directory } from '@capacitor/filesystem'

function safeReadUser() {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

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
  const currentUser = useMemo(() => safeReadUser(), [])
  const [paymentConfig, setPaymentConfig] = useState({
    enable_wompi: true,
    enable_manual: false,
    enable_receipt: false,
    is_active: true,
    note: '',
    bank_account: ''
  })
  const [manualAccess, setManualAccess] = useState({
    can_confirm_manual_purchase: false,
    is_admin: false,
    is_owner: false,
    is_event_staff: false
  })
  // 👤 datos básicos del cliente
  const [customer, setCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    cc: ''
  })
  const [paymentMode, setPaymentMode] = useState(null) // null | 'receipt' | 'manual'  
  const [receiptFile, setReceiptFile] = useState(null)
  const [receiptOrderId, setReceiptOrderId] = useState(null)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [creatingReceiptOrder, setCreatingReceiptOrder] = useState(false)
  const cancelReceiptFlow = () => {
    setPaymentMode(null)
    setReceiptFile(null)
    setReceiptOrderId(null)
    setErrors({})
    setError(null)
  }
  const validateReceiptFlow = () => {
    const okCustomer = validateForm()

    const newErrors = {}
    if (!receiptFile) {
      newErrors.receipt_file = 'Debes seleccionar un comprobante'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(prev => ({ ...prev, ...newErrors }))
    }

    return okCustomer && Object.keys(newErrors).length === 0
  }

  const validateReceiptForm = () => {
    const newErrors = {}
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!receiptCustomer.name.trim()) newErrors.receipt_name = 'El nombre es obligatorio'

    if (!receiptCustomer.email.trim()) {
      newErrors.receipt_email = 'El correo es obligatorio'
    } else if (!emailRegex.test(receiptCustomer.email.trim())) {
      newErrors.receipt_email = 'Formato de correo inválido'
    }

    if (!receiptCustomer.phone.trim()) newErrors.receipt_phone = 'El teléfono es obligatorio'
    if (!receiptCustomer.cc.trim()) newErrors.receipt_cc = 'La cédula es obligatoria'

    const hasTickets = Object.values(quantities).some(qty => qty > 0)
    if (!hasTickets) newErrors.tickets = 'Debes seleccionar al menos un ticket'

    if (!receiptFile) newErrors.receipt_file = 'Debes seleccionar un comprobante'

    setErrors(prev => ({ ...prev, ...newErrors }))
    return Object.keys(newErrors).length === 0
  }

const handleCreateReceiptOrder = async () => {
  setError(null)
  setOrderResult(null)

  const items = Object.entries(quantities)
    .filter(([_, qty]) => Number(qty) > 0)
    .map(([ticketTypeId, quantity]) => ({
      ticket_type_id: Number(ticketTypeId),
      quantity: Number(quantity)
    }))

  if (!validateReceiptFlow()) return

  try {
    setCreatingReceiptOrder(true)

    const reserveRes = await api.post('/api/orders/manual-reserve', {
      buyer_name: customer.name,
      buyer_email: customer.email,
      buyer_phone: customer.phone,
      buyer_cc: customer.cc,
      items
    })

    const orderId =
      reserveRes?.data?.order?.id ||
      reserveRes?.data?.id ||
      reserveRes?.data?.orderId

    if (!orderId) {
      throw new Error('ORDER_ID_NOT_FOUND')
    }

    setReceiptOrderId(orderId)

    const formData = new FormData()
    formData.append('receipt', receiptFile)

    setUploadingReceipt(true)

    await api.patch(`/api/orders/upload-receipt/${orderId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })

    alert('✅ Comprobante subido correctamente. Tu orden quedó pendiente de aprobación.')

    setReceiptFile(null)
    setPaymentMode(null)
    setErrors({})
    setQuantities({})
  } catch (err) {
    console.error(err)
    setError(err?.response?.data?.error || err?.message || 'Error creando la reserva con comprobante')
  } finally {
    setCreatingReceiptOrder(false)
    setUploadingReceipt(false)
  }
}
  function computeTicketState(ticket) {
    const now = new Date()

    if (ticket.status === 'HIDDEN') return 'OCULTO'
    if (ticket.status === 'SOLD_OUT') return 'AGOTADO'

    const stockRestante =
      ticket.stock_restante != null
        ? Number(ticket.stock_restante)
        : Number(ticket.stock_total || 0) - Number(ticket.stock_sold || 0)

    if (stockRestante <= 0) return 'AGOTADO'

    if (ticket.sales_start_at && now < new Date(ticket.sales_start_at)) {
      return 'PROGRAMADO'
    }

    if (ticket.sales_end_at && now > new Date(ticket.sales_end_at)) {
      return 'EXPIRADO'
    }

    return 'VIGENTE'
  }

  useEffect(() => {
    const load = async () => {
      try {
        const [evRes, ttRes] = await Promise.all([
          api.get('/api/events'),
          api.get('/api/ticket-types', { params: { eventId: id } })
        ])

        const event = evRes.data.find(e => String(e.id) === String(id))
        setEventData(event || null)

        const ticketsVigentes = (ttRes.data || []).filter(
          ticket => computeTicketState(ticket) === 'VIGENTE'
        )

        setTicketTypes(ticketsVigentes)

        try {
          const payRes = await api.get(`/api/events/${id}/payment-config`)
          if (payRes?.data) {
            setPaymentConfig({
              enable_wompi: !!payRes.data.enable_wompi,
              enable_manual: !!payRes.data.enable_manual,
              enable_receipt: !!payRes.data.enable_receipt,
              is_active: payRes.data.is_active ?? true,
              note: payRes.data.note || '',
              bank_account: payRes.data.bank_account || ''
            })
          }
        } catch (e) {
          console.error('payment-config load error', e)
        }

        try {
          const accessRes = await api.get(`/api/eventstaff/${id}/manual-purchase-access`)
          if (accessRes?.data) {
            setManualAccess(accessRes.data)
          }
        } catch (e) {
          console.error('manual-purchase-access load error', e)

          const isAdmin = currentUser?.role === 'ADMIN'
          const isStaff = currentUser?.role === 'STAFF'

          setManualAccess({
            can_confirm_manual_purchase: isAdmin || isStaff,
            is_admin: isAdmin,
            is_owner: false,
            is_event_staff: isStaff
          })
        }
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

  const openEmailDrawer = (ticket) => {
    setSelectedTicket(ticket)
    setEmailTo(customer.email || '')
    setEmailDrawerOpen(true)
  }

  const [orderDrawerOpen, setOrderDrawerOpen] = useState(false)
  const [orderEmailTo, setOrderEmailTo] = useState('')
  const [isSendingBulk, setIsSendingBulk] = useState(false)

  const openOrderEmailDrawer = () => {
    const emailDeCompra = customer?.email || orderResult?.order?.buyer_email || ''
    setOrderEmailTo(emailDeCompra)
    setOrderDrawerOpen(true)
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

  const validateForm = () => {
    const newErrors = {}
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!customer.name.trim()) newErrors.name = "El nombre es obligatorio"

    if (!customer.email.trim()) {
      newErrors.email = "El correo es obligatorio"
    } else if (!emailRegex.test(customer.email.trim())) {
      newErrors.email = "Formato de correo inválido"
    }

    if (!customer.phone.trim()) newErrors.phone = "El teléfono es obligatorio"
    if (!customer.cc.trim()) newErrors.cc = "La cédula es obligatoria"

    const hasTickets = Object.values(quantities).some(qty => qty > 0)
    if (!hasTickets) newErrors.tickets = "Debes seleccionar al menos un ticket"

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

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

    try {
      setPaymentMode('manual')
      setOrderEmailTo(customer.email)
      const res = await api.post('/api/orders', { customer, items })
      setOrderResult(res.data)
    } catch (err) {
      console.error(err)
      setError('Error creando la orden')
      setPaymentMode(null)
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

    if (!validateForm()) return

    try {
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

  const getTicketUrl = (t) => {
    return `${window.location.origin}/my-tickets`
  }

  const loadImage = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })

  const generateTicketImage = async (t) => {
    const qrDataUrl = await QRCodeLib.toDataURL(t.qr_payload, {
      margin: 2,
      width: 700,
      errorCorrectionLevel: 'H'
    })

    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 630
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = '#0B1220'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = '#FFFFFF'
    roundRect(ctx, 60, 60, 1080, 510, 24, true, false)

    const grad = ctx.createLinearGradient(60, 60, 1140, 60)
    grad.addColorStop(0, '#2E6BFF')
    grad.addColorStop(1, '#00D4FF')
    ctx.fillStyle = grad
    roundRect(ctx, 60, 60, 1080, 88, 24, true, false)

    ctx.fillStyle = '#0B1220'
    ctx.font = '700 34px system-ui, -apple-system, Segoe UI, Roboto'
    ctx.fillText(eventData?.name || 'Evento', 90, 190)

    ctx.fillStyle = '#4B5563'
    ctx.font = '500 20px system-ui, -apple-system, Segoe UI, Roboto'
    ctx.fillText('Tu acceso está listo. Presenta este QR en la entrada.', 90, 230)

    ctx.fillStyle = '#111827'
    ctx.font = '700 22px system-ui, -apple-system, Segoe UI, Roboto'
    ctx.fillText(`Titular: ${t.holder_name || customer.name || '—'}`, 90, 280)

    ctx.fillStyle = '#374151'
    ctx.font = '500 20px system-ui, -apple-system, Segoe UI, Roboto'
    ctx.fillText(`Correooo: ${t.holder_email || customer.email || '—'}`, 90, 312)

    ctx.fillStyle = '#6B7280'
    ctx.font = '500 18px system-ui, -apple-system, Segoe UI, Roboto'
    ctx.fillText(`Ticket #${t.id} • Código: ${t.unique_code}`, 90, 350)

    const qrImg = await loadImage(qrDataUrl)

    ctx.fillStyle = '#F3F4F6'
    roundRect(ctx, 780, 170, 300, 300, 18, true, false)
    ctx.drawImage(qrImg, 800, 190, 260, 260)

    // logo en el centro del QR
    try {
      const logoImg = await loadImage('/CT_simbolo_G.jpg') // o /logo-ct.jpg
      const logoSize = 42
      const logoX = 800 + (260 / 2) - (logoSize / 2)
      const logoY = 190 + (260 / 2) - (logoSize / 2)

      ctx.fillStyle = '#FFFFFF'
      roundRect(ctx, logoX - 6, logoY - 6, logoSize + 12, logoSize + 12, 10, true, false)
      ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize)
    } catch (e) {
      console.warn('No se pudo cargar el logo del centro del QR', e)
    }

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

    try {
      if (Capacitor.isNativePlatform()) {
        await shareNativeTicketImage(t, msg)
        return
      }

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
      `¡Nos vemos pronto!`

    try {
      if (Capacitor.isNativePlatform()) {
        await shareNativeTicketImage(t, `${subject}\n\n${body}`)
        return
      }

      const to = t.holder_email || customer.email || ''
      const mailto =
        `mailto:${encodeURIComponent(to)}` +
        `?subject=${encodeURIComponent(subject)}` +
        `&body=${encodeURIComponent(body)}`
      window.location.href = mailto

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
    const idDeOrden = orderResult?.order?.id || orderResult?.id
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
    const idDeOrden = orderResult?.order?.id || orderResult?.id

    if (!idDeOrden) return alert('No se encontró el ID de la orden')

    const confirmar = window.confirm("¿Deseas recibir un único correo con todos los tickets de esta orden?")
    if (!confirmar) return

    setLoadingEmail(true)
    try {
      await api.post(`/api/orders/${idDeOrden}/resend-email`)
      alert('✅ ¡Éxito! Se ha enviado un correo con todos tus tickets adjuntos.')
    } catch (err) {
      console.error(err)
      const msg = err.response?.status === 500
        ? 'El servidor está ocupado generando los PDF. Por favor, intenta de nuevo en un momento.'
        : 'No pudimos procesar el envío masivo.'
      alert(`❌ ${msg}`)
    } finally {
      setLoadingEmail(false)
    }
  }

  const canUseManualConfirm =
    !!paymentConfig.enable_manual &&
    !!manualAccess.can_confirm_manual_purchase

  const canUseWompi =
    !!paymentConfig.enable_wompi &&
    (paymentConfig.is_active ?? true)

  if (loading) return <div>Cargando...</div>
  if (error) return <div style={{ color: 'red' }}>{error}</div>
  if (!eventData) return <div>Evento no encontrado</div>

  return (
    <div>
      <h2>Comprar tickets para: {eventData.name}</h2>
      <p>{eventData.description}</p>
      {paymentMode !== 'manual' && paymentMode !== 'receipt' && (
        <>
          <h3>Datos del titular del ticket</h3>
          <div style={{ maxWidth: '400px', marginBottom: '15px' }}>
            <div style={{ maxWidth: '400px', marginBottom: '15px' }}>
              <div style={{ marginBottom: '8px' }}>
                <label>Nombre</label>
                <input
                  type="text"
                  value={customer.name}
                  onChange={e => {
                    setCustomer({ ...customer, name: e.target.value })
                    if (errors.name) setErrors({ ...errors, name: null })
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
                    setCustomer({ ...customer, email: e.target.value })
                    if (errors.email) setErrors({ ...errors, email: null })
                  }}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: errors.email ? '2px solid #ef4444' : '1px solid #ccc',
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
                    setCustomer({ ...customer, phone: e.target.value })
                    if (errors.phone) setErrors({ ...errors, phone: null })
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
                    setCustomer({ ...customer, cc: e.target.value })
                    if (errors.cc) setErrors({ ...errors, cc: null })
                  }}
                  style={{ width: '100%', padding: '8px', border: errors.cc ? '2px solid red' : '1px solid #ccc' }}
                />
                {errors.cc && <span style={{ color: 'red', fontSize: '12px' }}>{errors.cc}</span>}
              </div>

              {errors.tickets && (
                <div style={{ color: 'red', fontSize: '12px', marginTop: '8px' }}>
                  {errors.tickets}
                </div>
              )}
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
                          value={quantities[tt.id] ?? ''}
                          onChange={e => handleQuantityChange(tt.id, e.target.value)}
                          style={{ width: '60px' }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {!orderResult && paymentMode !== 'receipt' && (
              <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                {canUseManualConfirm && (
                  <button
                    onClick={() => {
                      const customerOk = validateForm()
                      if (!customerOk) return
                      
                      handleBuy()
                      setPaymentMode('manual')
                    }}

                    
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
                )}

                {canUseWompi && (
                  <button
                    onClick={handlePayWithWompi}
                    style={{
                      background: 'transparent',
                      border: '1px solid #9CA3AF',
                      padding: '8px 12px',
                      borderRadius: 10,
                      cursor: 'pointer'
                    }}
                  >
                    Pagar con Wompi
                  </button>
                )}

                {!!paymentConfig.enable_receipt && (
                <button
                  onClick={() => {
                    setError(null)
                    setErrors({})

                    const customerOk = validateForm()
                    if (!customerOk) return

                    setPaymentMode('receipt')
                  }}
                  style={{
                    background: 'transparent',
                    border: '1px solid #9CA3AF',
                    padding: '8px 12px',
                    borderRadius: 10,
                    cursor: 'pointer'
                  }}
                >
                  Pago con comprobante
                </button>
              )}
              {/*
                {!canUseManualConfirm && paymentConfig.enable_manual && (
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    El pago manual está habilitado, pero tu usuario no tiene permiso para confirmar compras manuales.
                  </div>
                )}
              */}    
              </div>
            )}
      </div>
        </>
      )}

      {paymentMode === 'receipt' && (
        <div
          className="app-card"
          style={{
            marginTop: 20,
            padding: 20,
            border: '1px solid #E5E7EB',
            borderRadius: 16
          }}
        >
          <h3 style={{ marginTop: 0 }}>Pago con comprobante</h3>

          <div style={{ marginBottom: 14, color: '#374151' }}>
            <strong>Instrucciones:</strong>
            <div style={{ marginTop: 6 }}>
              {paymentConfig.note || 'Sigue las instrucciones del organizador y sube tu comprobante.'}
            </div>
          </div>

          <div style={{ marginBottom: 20, color: '#374151' }}>
            <strong>Número de cuenta:</strong>
            <div style={{ marginTop: 6 }}>
              {paymentConfig.bank_account || 'No configurada'}
            </div>
          </div>
          <div style={{ marginBottom: 20, color: '#374151' }}>
            <strong>Datos del comprador:</strong>
            <div style={{ marginTop: 6 }}>Nombre: {customer.name || '—'}</div>
            <div style={{ marginTop: 4 }}>Email: {customer.email || '—'}</div>
            <div style={{ marginTop: 4 }}>Teléfono: {customer.phone || '—'}</div>
            <div style={{ marginTop: 4 }}>Cédula: {customer.cc || '—'}</div>
          </div>
          <div style={{ maxWidth: '420px', marginBottom: '15px' }}>
            
            <div style={{ marginBottom: '8px' }}>
              <label>Comprobante</label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={e => {
                  setReceiptFile(e.target.files?.[0] || null)
                  if (errors.receipt_file) setErrors({ ...errors, receipt_file: null })
                }}
                style={{ width: '100%', padding: '8px' }}
              />
              {errors.receipt_file && <span style={{ color: 'red', fontSize: '12px' }}>{errors.receipt_file}</span>}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={handleCreateReceiptOrder}
              disabled={creatingReceiptOrder || uploadingReceipt}
              style={{
                background: 'transparent',
                border: '1px solid #9CA3AF',
                padding: '8px 12px',
                borderRadius: 10,
                cursor: 'pointer'
              }}
            >
              {creatingReceiptOrder || uploadingReceipt
                ? 'Procesando...'
                : 'Confirmar reserva'}
            </button>

            <button
              onClick={cancelReceiptFlow}
              type="button"
              style={{
                background: 'transparent',
                border: '1px solid #9CA3AF',
                padding: '8px 12px',
                borderRadius: 10,
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {paymentMode === 'manual' && !orderResult && (
        <div
          className="app-card"
          style={{
            marginTop: 20,
            padding: 20,
            border: '1px solid #E5E7EB',
            borderRadius: 16
          }}
        >
          <h3 style={{ marginTop: 0 }}>Confirmando compra</h3>

          <div style={{ marginBottom: 20, color: '#374151' }}>
            <strong>Datos del comprador:</strong>
            <div style={{ marginTop: 6 }}>Nombre: {customer.name || '—'}</div>
            <div style={{ marginTop: 4 }}>Email: {customer.email || '—'}</div>
            <div style={{ marginTop: 4 }}>Teléfono: {customer.phone || '—'}</div>
            <div style={{ marginTop: 4 }}>Cédula: {customer.cc || '—'}</div>
          </div>

          <div style={{ color: '#6B7280', fontSize: 14 }}>
            Procesando la orden...
          </div>
        </div>
      )}

      {orderResult && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0 }}>Tickets generados</h3>
            <p style={{ margin: 0, color: '#666' }}>
              Orden #{orderResult.order.id} – {orderResult.tickets.length} tickets – Total:{' '}
              {new Intl.NumberFormat('es-ES').format(orderResult.order.total_pesos)}
            </p>
          </div>

          <button
            className="btn-primary"
            onClick={openOrderEmailDrawer}
            style={{ fontSize: '12px' }}
          >
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
                <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 6 }}>
                  Este ticket permite {Number(t.allowed_entries || 1)} ingreso(s)
                </div>

                <div style={{ marginTop: '10px' }}>
                  <strong>QR:</strong>
                  <div
                    style={{
                      marginTop: '10px',
                      width: '140px',
                      height: '140px',
                      background: '#fff',
                      borderRadius: '16px',
                      padding: '10px',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 8px 18px rgba(0,0,0,0.10)'
                    }}
                  >
                    <QRCode
                      value={t.qr_payload || t.unique_code}
                      size={120}
                      bgColor="#FFFFFF"
                      fgColor="#111111"
                      level="H"
                    />

                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '26px',
                        height: '26px',
                        background: '#fff',
                        borderRadius: '8px',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 1px 6px rgba(0,0,0,0.15)'
                      }}
                    >
                      <img
                        src="/logo-ct.png"
                        alt="Logo QR"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain'
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '15px' }}>
                  <div style={{ marginTop: '10px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    <button className="btn-primary" onClick={() => sharePrettyTicketImage(t)} style={{ fontSize: '12px' }}>
                      Descargar
                    </button>
                    <button className="btn-primary" onClick={() => openEmailDrawer(t)} style={{ fontSize: '12px' }}>
                      Enviar por Correo
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                  setIsSendingBulk(true)
                  try {
                    const idReal = orderResult?.order?.id || orderResult?.id
                    console.log('ID real de la orden:', idReal)
                    await api.post(`/api/orders/${idReal}/resend-email`, { toEmail: orderEmailTo })
                    alert("✅ Todos los tickets han sido enviados.")
                    setOrderDrawerOpen(false)
                  } catch (err) {
                    alert("❌ Error al enviar el paquete de tickets.")
                  } finally {
                    setIsSendingBulk(false)
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
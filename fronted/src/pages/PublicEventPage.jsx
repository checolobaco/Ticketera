import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../api'

function getTicketVisualStatus(ticket) {
  const now = new Date()
  const start = ticket.sales_start_at ? new Date(ticket.sales_start_at) : null
  const end = ticket.sales_end_at ? new Date(ticket.sales_end_at) : null
  const sold = Number(ticket.stock_sold || 0)
  const total = Number(ticket.stock_total || 0)

  if (ticket.status === 'HIDDEN') return 'OCULTO'
  if (ticket.status === 'SOLD_OUT') return 'AGOTADO'
  if (total > 0 && sold >= total) return 'AGOTADO'
  if (start && now < start) return 'PROGRAMADO'
  if (end && now > end) return 'EXPIRADO'
  return 'VIGENTE'
}
 
function formatPrice(value) {
  return Number(value || 0).toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  })
}

function formatDate(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString()
}

export default function PublicEventPage() {
  const { slug } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [eventData, setEventData] = useState(null)

  useEffect(() => {
    let ignore = false

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

    const load = async () => {
      setLoading(true)
      setError('')

      const maxAttempts = 4

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const res = await api.get(`/api/events/share/${slug}`, {
            timeout: 15000
          })

          const payload = res.data

          const normalized = payload?.event
            ? {
                event: payload.event,
                ticketTypes: payload.ticketTypes || [],
                paymentConfig: payload.paymentConfig || null
              }
            : {
                event: payload,
                ticketTypes: payload?.ticketTypes || [],
                paymentConfig: payload?.paymentConfig || null
              }

          if (ignore) return

          setEventData(normalized)

          const token = localStorage.getItem('token')
          if (token && normalized?.event?.id) {
            try {
              await api.patch(
                '/api/auth/me/link-event',
                { eventId: Number(normalized.event.id) },
                {
                  headers: {
                    Authorization: `Bearer ${token}`
                  }
                }
              )
            } catch (linkErr) {
              console.error('No se pudo asociar el evento al usuario', linkErr)
            }
          }

          setLoading(false)
          return
        } catch (err) {
          console.error(`Intento ${attempt} fallido`, err)

          if (attempt === maxAttempts) {
            if (!ignore) {
              setError(
                err?.response?.data?.message ||
                  'No se pudo cargar el evento. Intenta de nuevo en unos segundos.'
              )
              setLoading(false)
            }
            return
          }

          await wait(2500)
        }
      }
    }

    load()

    return () => {
      ignore = true
    }
  }, [slug])

  const event = eventData?.event || null
  const paymentConfig = eventData?.paymentConfig || null

  const visibleTickets = useMemo(() => {
    const list = eventData?.ticketTypes || []
    return list.filter((t) => getTicketVisualStatus(t) !== 'OCULTO')
  }, [eventData])

  const saveSharedContext = () => {
    if (!event?.id) return

    sessionStorage.setItem('sharedEventId', String(event.id))
    sessionStorage.setItem('sharedEventSlug', String(event.share_slug || slug))
    sessionStorage.setItem('postLoginEventId', String(event.id))
    sessionStorage.setItem('postLoginShareSlug', String(event.share_slug || slug))
    sessionStorage.setItem('postLoginRedirect', `/events/${event.id}`)
  }

  const handleBuy = () => {
    if (!event?.id) return

    saveSharedContext()

    const token = localStorage.getItem('token')
    if (token) {
      navigate(`/events/${event.id}`)
      return
    }

    navigate('/login')
  }

  const handleRegister = () => {
    if (!event?.id) return

    saveSharedContext()
    sessionStorage.setItem('registerEventId', String(event.id))
    navigate('/register')
  }

  const handleLogin = () => {
    if (!event?.id) return

    saveSharedContext()
    navigate('/login')
  }

  if (loading) {
    return <div style={{ maxWidth: 1100, margin: '0 auto', padding: 16 }}>Cargando evento...</div>
  }

  if (error || !event) {
    return <div style={{ maxWidth: 1100, margin: '0 auto', padding: 16 }}>{error || 'Evento no encontrado'}</div>
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 16 }}>
      {event.cover_image_url ? (
        <img
          src={event.cover_image_url}
          alt={event.name}
          style={{
            width: '100%',
            height: 320,
            objectFit: 'cover',
            borderRadius: 16,
            marginBottom: 20
          }}
        />
      ) : event.image_url ? (
        <img
          src={event.image_url}
          alt={event.name}
          style={{
            width: '100%',
            height: 320,
            objectFit: 'cover',
            borderRadius: 16,
            marginBottom: 20
          }}
        />
      ) : null}

      <div style={{ display: 'grid', gap: 20 }}>
        <div>
          <h1 style={{ margin: 0 }}>{event.name}</h1>

          <div style={{ marginTop: 8, color: '#666' }}>
            <div><strong>Inicio:</strong> {formatDate(event.start_datetime)}</div>
            <div><strong>Fin:</strong> {formatDate(event.end_datetime)}</div>
          </div>
        </div>

        {event.description ? (
          <div>
            <h3 style={{ marginBottom: 8 }}>Descripción</h3>
            <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
              {event.description}
            </p>
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={handleBuy}>
            Comprar
          </button>

          <button className="btn-primary" onClick={handleRegister}>
            Registrarme
          </button>

          <button className="btn-primary" onClick={handleLogin}>
            Entrar
          </button>
        </div>

        <div>
          <h3 style={{ marginBottom: 12 }}>Tickets disponibles</h3>

          {!visibleTickets.length ? (
            <div>No hay tickets visibles para este evento.</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {visibleTickets.map((ticket) => {
                const visualStatus = getTicketVisualStatus(ticket)
                const remaining = Math.max(
                  0,
                  Number(ticket.stock_total || 0) - Number(ticket.stock_sold || 0)
                )

                return (
                  <div
                    key={ticket.id}
                    style={{
                      border: '1px solid #ddd',
                      borderRadius: 12,
                      padding: 16,
                      background: '#fff'
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>
                      {ticket.name}
                    </div>

                    <div><strong>Precio:</strong> {formatPrice(ticket.price_pesos)}</div>
                    <div><strong>Estado:</strong> {visualStatus}</div>
                    <div><strong>Disponibles:</strong> {remaining}</div>

                    {ticket.sales_start_at ? (
                      <div><strong>Venta desde:</strong> {formatDate(ticket.sales_start_at)}</div>
                    ) : null}

                    {ticket.sales_end_at ? (
                      <div><strong>Venta hasta:</strong> {formatDate(ticket.sales_end_at)}</div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div>
          <h3 style={{ marginBottom: 12 }}>Métodos de pago</h3>

          <div>Wompi: {paymentConfig?.enable_wompi ? 'Sí' : 'No'}</div>
          <div>Manual: {paymentConfig?.enable_manual ? 'Sí' : 'No'}</div>
          <div>Comprobante: {paymentConfig?.enable_receipt ? 'Sí' : 'No'}</div>

          {paymentConfig?.note ? (
            <div style={{ marginTop: 8 }}>
              <strong>Nota:</strong> {paymentConfig.note}
            </div>
          ) : null}

          {paymentConfig?.bank_account ? (
            <div style={{ marginTop: 8 }}>
              <strong>Cuenta:</strong> {paymentConfig.bank_account}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
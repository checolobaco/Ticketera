import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../api'
import QRCode from 'react-qr-code'
import QRCodeLib from "qrcode"

export default function PurchasePage() {
  const { id } = useParams()
  const [eventData, setEventData] = useState(null)
  const [ticketTypes, setTicketTypes] = useState([])
  const [quantities, setQuantities] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [orderResult, setOrderResult] = useState(null)

  // 👤 datos básicos del cliente
  const [customer, setCustomer] = useState({
    name: '',
    email: '',
    phone: ''
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

  const handleQuantityChange = (typeId, value) => {
    const qty = parseInt(value || '0', 10)
    setQuantities(prev => ({ ...prev, [typeId]: isNaN(qty) ? 0 : qty }))
  }

  const handleBuy = async () => {
    setError(null)
    setOrderResult(null)

    const items = Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([ticketTypeId, quantity]) => ({
        ticketTypeId: Number(ticketTypeId),
        quantity
      }))

    if (items.length === 0) {
      setError('Selecciona al menos 1 ticket')
      return
    }

    if (!customer.name || !customer.email) {
      setError('Ingresa al menos nombre y email del titular')
      return
    }

    try {
      // 🔹 Enviamos también el objeto customer al backend
      const res = await api.post('/api/orders', {
        customer,
        items
      })
      setOrderResult(res.data)
    } catch (err) {
      console.error(err)
      setError('Error creando la orden')
    }
  }

  if (loading) return <div>Cargando...</div>
  if (error) return <div style={{ color: 'red' }}>{error}</div>
  if (!eventData) return <div>Evento no encontrado</div>

  return (
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
            onChange={e => setCustomer({ ...customer, name: e.target.value })}
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ marginBottom: '8px' }}>
          <label>Email</label>
          <input
            type="email"
            value={customer.email}
            onChange={e => setCustomer({ ...customer, email: e.target.value })}
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ marginBottom: '8px' }}>
          <label>Teléfono (opcional)</label>
          <input
            type="text"
            value={customer.phone}
            onChange={e => setCustomer({ ...customer, phone: e.target.value })}
            style={{ width: '100%' }}
          />
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
                <td>{(tt.price_cents / 100).toFixed(2)}</td>
                <td>
                  <input
                    type="number"
                    min="0"
                    value={quantities[tt.id] || 0}
                    onChange={e => handleQuantityChange(tt.id, e.target.value)}
                    style={{ width: '60px' }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button onClick={handleBuy} style={{ marginTop: '10px' }}>Confirmar compra</button>

      {orderResult && (
        <div style={{ marginTop: '30px' }}>
          <h3>Tickets generados</h3>
          <p>Orden #{orderResult.order.id} – Total: {(orderResult.order.total_cents / 100).toFixed(2)}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
            {orderResult.tickets.map(t => (
              <div
                key={t.id}
                style={{ border: '1px solid #ccc', padding: '10px', borderRadius: '4px' }}
              >
                <p><strong>Ticket ID:</strong> {t.id}</p>
                <p><strong>Código único (tid):</strong> {t.unique_code}</p>
                {/* si el backend nos devuelve holder_name/email, también podemos mostrarlo aquí */}
                {t.holder_name && <p><strong>Titular:</strong> {t.holder_name}</p>}
                {t.holder_email && <p><strong>Email:</strong> {t.holder_email}</p>}
                <p><strong>QR:</strong></p>
                <div style={{ background: 'white', padding: '10px' }}>
                  <QRCode value={t.qr_payload} size={128} />
                </div>
                <small>
                  Este QR contiene el payload completo del ticket que usará el lector
                  (NFC/QR) para validarlo.
                </small>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

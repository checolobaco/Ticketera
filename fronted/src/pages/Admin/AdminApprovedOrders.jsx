import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../api'

function fmtDate(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

export default function AdminApprovedOrders() {
  const { id } = useParams()

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processingId, setProcessingId] = useState(null)
  const [success, setSuccess] = useState('')
  const [statusFilter, setStatusFilter] = useState('PENDING_APPROVAL')

  const statusLabels = {
    ALL: 'Todas',
    PAID: 'Pagadas',
    PENDING: 'Pendientes',
    PENDING_APPROVAL: 'Pendientes de aprobación',
    WAITING_PAYMENT: 'Esperando pago',
    CANCELLED: 'Canceladas'
  }

  async function load() {
    try {
      setLoading(true)
      setError('')
      setSuccess('')

      const res = await api.get(`/api/orders/${id}`)
      setOrders(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      console.error(err)
      setError(err?.response?.data?.error || 'No se pudieron cargar las órdenes')
    } finally {
      setLoading(false)
    }
  }

  const pendingOrders = orders.filter(
    o => o.status === 'PENDING_APPROVAL'
  )

  const filteredOrders =
    statusFilter === 'ALL'
      ? orders
      : orders.filter(o => o.status === statusFilter)

  useEffect(() => {
    load()
  }, [id])

  async function handleApprove(orderId) {
    const ok = window.confirm(`¿Aprobar la orden #${orderId}?`)
    if (!ok) return

    try {
      setProcessingId(orderId)
      setError('')
      setSuccess('')

      await api.post(`/api/orders/approve-order/${orderId}`, {})

      setSuccess(`Orden #${orderId} aprobada correctamente`)
      await load()
    } catch (err) {
      console.error(err)
      setError(err?.response?.data?.error || 'No se pudo aprobar la orden')
    } finally {
      setProcessingId(null)
    }
  }

  async function handleCancel(orderId) {
    const ok = window.confirm(`¿Cancelar la orden #${orderId}?`)
    if (!ok) return

    try {
      setProcessingId(orderId)
      setError('')
      setSuccess('')

      await api.post(`/api/orders/cancel-order/${orderId}`, {})

      setSuccess(`Orden #${orderId} cancelada correctamente`)
      await load()
    } catch (err) {
      console.error(err)
      setError(err?.response?.data?.error || 'No se pudo cancelar la orden')
    } finally {
      setProcessingId(null)
    }
  }

  if (loading) return <div>Cargando órdenes...</div>

  return (
    <div className="stack-lg">
      <div>
        <h1 className="app-title">Aprobar órdenes</h1>
        <div className="app-subtitle">Evento #{id}</div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label htmlFor="statusFilter" style={{ fontWeight: 700 }}>
          Filtrar por estado:
        </label>

        <select
          id="statusFilter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid #D1D5DB',
            minWidth: 240
          }}
        >
          <option value="PENDING_APPROVAL">Pendientes de aprobación</option>
          <option value="PAID">Pagadas</option>
          <option value="PENDING">Pendientes</option>
          <option value="WAITING_PAYMENT">Esperando pago</option>
          <option value="CANCELLED">Canceladas</option>
          <option value="ALL">Todas</option>
        </select>
      </div>

      {error ? (
        <div
          className="ticket-card"
          style={{
            border: '1px solid #fecaca',
            background: '#fff5f5',
            color: '#b91c1c'
          }}
        >
          {error}
        </div>
      ) : null}

      {success ? (
        <div
          className="ticket-card"
          style={{
            border: '1px solid #bbf7d0',
            background: '#f0fdf4',
            color: '#166534'
          }}
        >
          {success}
        </div>
      ) : null}

      {pendingOrders.length === 0 ? (
        <div className="ticket-card">
          No hay órdenes pendientes de aprobación.
        </div>
      ) : null}

      {filteredOrders.length === 0 ? (
        <div className="ticket-card">
          No hay órdenes para el filtro seleccionado.
        </div>
      ) : (
        <div className="stack-lg">
          {filteredOrders.map(order => (
            <div
              key={order.id}
              className="ticket-card"
              style={{
                border: '1px solid #E5E7EB',
                borderRadius: 16,
                padding: 16
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 16,
                  flexWrap: 'wrap',
                  alignItems: 'flex-start'
                }}
              >
                <div style={{ flex: 1, minWidth: 280 }}>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>
                    Orden #{order.id}
                  </div>

                  <div style={{ marginTop: 8, fontSize: 14, color: '#6B7280' }}>
                    Estado: <strong>{statusLabels[order.status] || order.status}</strong>
                  </div>

                  <div style={{ marginTop: 8, fontSize: 14 }}>
                    <strong>Comprador:</strong> {order.buyer_name || '—'}
                  </div>

                  <div style={{ marginTop: 4, fontSize: 14 }}>
                    <strong>Email:</strong> {order.buyer_email || '—'}
                  </div>

                  <div style={{ marginTop: 4, fontSize: 14 }}>
                    <strong>Teléfono:</strong> {order.buyer_phone || '—'}
                  </div>

                  <div style={{ marginTop: 4, fontSize: 14 }}>
                    <strong>Creada:</strong> {fmtDate(order.created_at)}
                  </div>

                  <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {order.payment_receipt_url ? (
                      <a
                        href={order.payment_receipt_url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-primary"
                      >
                        Ver comprobante
                      </a>
                    ) : (
                      <span style={{ fontSize: 13, color: '#9CA3AF' }}>
                        Sin comprobante
                      </span>
                    )}

                    {order.status === 'PENDING_APPROVAL' ? (
                      <>
                        <button
                          className="btn-primary"
                          onClick={() => handleApprove(order.id)}
                          disabled={processingId === order.id}
                        >
                          {processingId === order.id ? 'Aprobando...' : 'Aprobar Orden'}
                        </button>

                        <button
                          className="btn-primary"
                          onClick={() => handleCancel(order.id)}
                          disabled={processingId === order.id}
                        >
                          {processingId === order.id ? 'Cancelando...' : 'Cancelar Orden'}
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                {order.payment_receipt_url ? (
                  <div style={{ minWidth: 220 }}>
                    <a
                      href={order.payment_receipt_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: 'block' }}
                    >
                      <img
                        src={order.payment_receipt_url}
                        alt={`Comprobante orden ${order.id}`}
                        style={{
                          width: 220,
                          maxWidth: '100%',
                          borderRadius: 12,
                          border: '1px solid #E5E7EB',
                          objectFit: 'cover'
                        }}
                      />
                    </a>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
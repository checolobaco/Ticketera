import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../api'
import EventAdminMenu from '../../components/EventAdminMenu'
import ConfirmModal from '../../components/ConfirmModal'
import { getErrorMessage } from '../../utils/errorMessages'

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
  const [processingAction, setProcessingAction] = useState(null) // { id: number, type: 'APPROVE'|'CANCEL' }
  const [success, setSuccess] = useState('')
  const [statusFilter, setStatusFilter] = useState('PENDING_APPROVAL')

  // Estado para el modal de confirmación (UX4)
  const [modalState, setModalState] = useState({
    isOpen: false,
    orderId: null,
    type: null // 'APPROVE' | 'CANCEL'
  })

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
      setError(getErrorMessage(err?.response?.data?.error || 'No se pudieron cargar las órdenes'))
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

  const handleConfirmAction = async () => {
    const { orderId, type } = modalState
    if (!orderId || !type) return

    if (type === 'APPROVE') {
      try {
        setProcessingAction({ id: orderId, type: 'APPROVE' })
        setError('')
        setSuccess('')

        await api.post(`/api/orders/approve-order/${orderId}`, {})

        setSuccess(`Orden #${orderId} aprobada correctamente`)
        await load()
      } catch (err) {
        console.error(err)
        setError(getErrorMessage(err?.response?.data?.error || err?.message || 'No se pudo aprobar la orden'))
      } finally {
        setProcessingAction(null)
        setModalState({ isOpen: false, orderId: null, type: null })
      }
    } else if (type === 'CANCEL') {
      try {
        setProcessingAction({ id: orderId, type: 'CANCEL' })
        setError('')
        setSuccess('')

        await api.post(`/api/orders/cancel-order/${orderId}`, {})

        setSuccess(`Orden #${orderId} cancelada correctamente`)
        await load()
      } catch (err) {
        console.error(err)
        setError(getErrorMessage(err?.response?.data?.error || err?.message || 'No se pudo cancelar la orden'))
      } finally {
        setProcessingAction(null)
        setModalState({ isOpen: false, orderId: null, type: null })
      }
    }
  }

  if (loading) return <div>Cargando órdenes...</div>

  return (
    <div className="stack-lg">
      <div>
        <h1 className="app-title">Aprobar órdenes</h1>
        <div className="app-subtitle">Evento #{id}</div>
      </div>

      <EventAdminMenu eventId={id} />

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

                  {order.ticket_details && (
                    <div style={{ marginTop: 4, fontSize: 14 }}>
                      <strong>Tickets:</strong> {order.ticket_details}
                    </div>
                  )}

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
                          onClick={() => setModalState({ isOpen: true, orderId: order.id, type: 'APPROVE' })}
                          disabled={processingAction?.id === order.id}
                        >
                          {processingAction?.id === order.id && processingAction?.type === 'APPROVE'
                            ? 'Aprobando...'
                            : 'Aprobar Orden'}
                        </button>

                        <button
                          className="btn-primary"
                          style={{ backgroundColor: '#DC2626', borderColor: '#DC2626' }}
                          onClick={() => setModalState({ isOpen: true, orderId: order.id, type: 'CANCEL' })}
                          disabled={processingAction?.id === order.id}
                        >
                          {processingAction?.id === order.id && processingAction?.type === 'CANCEL'
                            ? 'Cancelando...'
                            : 'Cancelar Orden'}
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

      {/* Modal de Confirmación para Acciones Administrativas (UX4) */}
      <ConfirmModal
        isOpen={modalState.isOpen}
        title={modalState.type === 'APPROVE' ? `¿Aprobar Orden #${modalState.orderId}?` : `¿Cancelar Orden #${modalState.orderId}?`}
        message={modalState.type === 'APPROVE' 
          ? `Al aprobar esta orden, se generarán automáticamente las entradas con código QR y se le enviarán al comprador por correo electrónico.`
          : `¿Estás seguro de cancelar esta orden? Esta acción cambiará el estado de la orden a CANCELADO.`}
        confirmText={modalState.type === 'APPROVE' ? 'Sí, Aprobar' : 'Sí, Cancelar'}
        cancelText="Volver"
        isDanger={modalState.type === 'CANCEL'}
        isLoading={!!processingAction}
        onConfirm={handleConfirmAction}
        onCancel={() => setModalState({ isOpen: false, orderId: null, type: null })}
      />
    </div>
  )
}
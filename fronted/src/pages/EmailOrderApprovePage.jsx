import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { publicApi } from '../api'

export default function EmailOrderApprovePage() {
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const orderId = useMemo(() => searchParams.get('orderId') || '', [searchParams])
  const token = useMemo(() => searchParams.get('token') || '', [searchParams])
  const action = useMemo(() => String(searchParams.get('action') || 'APPROVE_ORDER').toUpperCase(), [searchParams])

  const actionTitle = action === 'REJECT_ORDER' ? 'Rechazo desde correo' : 'Aprobación desde correo'

  useEffect(() => {
    async function run() {
      if (!orderId || !token) {
        setError('Faltan datos para gestionar la orden.')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError('')
        const res = await publicApi.get(`/api/orders/email-action-preview/${orderId}`, {
          params: { token }
        })
        setPreview(res.data || null)
      } catch (err) {
        console.error(err)
        setError(err?.response?.data?.error || 'No se pudo validar el enlace.')
      } finally {
        setLoading(false)
      }
    }

    run()
  }, [orderId, token])

  async function executeAction() {
    try {
      setProcessing(true)
      setError('')
      const res = await publicApi.post(`/api/orders/email-action/${orderId}`, {
        token
      })
      setResult(res.data || null)
    } catch (err) {
      console.error(err)
      setError(err?.response?.data?.error || 'No se pudo ejecutar la acción.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="app-card" style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="stack-lg">
        <div>
          <h1 className="app-title">{actionTitle}</h1>
          <div className="app-subtitle">Orden #{orderId || '—'}</div>
        </div>

        {loading ? (
          <div className="ticket-card">Validando enlace...</div>
        ) : null}

        {!loading && error ? (
          <div className="ticket-card" style={{ border: '1px solid #fda29b', color: '#b42318' }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>No fue posible procesar la solicitud</div>
            <div>{error}</div>
          </div>
        ) : null}

        {!loading && preview?.ok && !result?.ok ? (
          <div className="ticket-card">
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Confirmar acción</div>
            <div style={{ marginBottom: 6 }}><strong>Comprador:</strong> {preview.order?.buyer_name || '—'}</div>
            <div style={{ marginBottom: 6 }}><strong>Email:</strong> {preview.order?.buyer_email || '—'}</div>
            <div style={{ marginBottom: 6 }}><strong>Estado actual:</strong> {preview.order?.status || '—'}</div>
            <div style={{ marginBottom: 16 }}>
              {action === 'REJECT_ORDER'
                ? 'Esta acción cancelará la orden y liberará la reserva del código promocional si aplica.'
                : 'Esta acción aprobará la orden, generará los tickets y enviará el correo al cliente.'}
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn-primary" onClick={executeAction} disabled={processing}>
                {processing
                  ? 'Procesando...'
                  : action === 'REJECT_ORDER'
                    ? 'Confirmar rechazo'
                    : 'Confirmar aprobación'}
              </button>
            </div>
          </div>
        ) : null}

        {!loading && result?.ok ? (
          <div className="ticket-card" style={{ border: '1px solid #a6f4c5', color: '#027a48' }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>
              {result.action === 'REJECT_ORDER'
                ? 'Orden rechazada correctamente'
                : result.alreadyPaid
                  ? 'La orden ya estaba aprobada'
                  : 'Orden aprobada correctamente'}
            </div>
            <div>
              {result.action === 'REJECT_ORDER'
                ? 'La orden fue cancelada y se notificó al cliente.'
                : result.alreadyPaid
                  ? 'No fue necesario generar nuevamente los tickets.'
                  : 'Se generaron los tickets y se activó el envío del correo al cliente.'}
            </div>
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="btn-primary" to="/login">
            Ir al panel
          </Link>
        </div>
      </div>
    </div>
  )
}

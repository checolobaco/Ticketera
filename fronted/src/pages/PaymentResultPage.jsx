import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import api from '../api'

function useQuery() {
  const { search } = useLocation()
  return useMemo(() => new URLSearchParams(search), [search])
}

export default function PaymentResultPage() {
  const q = useQuery()
  const navigate = useNavigate()

  const reference =
    q.get('reference') || q.get('ref') || q.get('wompi_reference') || ''

  const [status, setStatus] = useState('Procesando...')
  const [error, setError] = useState(null)
  const [tickets, setTickets] = useState([])

  useEffect(() => {
    let timer = null

    const poll = async () => {
      try {
        setError(null)

        // 1) Verificar estado de la orden por reference
        const res = await api.get('/api/orders/by-reference', {
          params: { ref: reference },
        })

        const s = res.data?.payment_status || res.data?.status || 'PENDING'

        if (s === 'APPROVED' || s === 'PAID') {
          setStatus('✅ Pago aprobado. Cargando tickets...')

          // 2) Traer tickets de esta orden
          try {
            const tRes = await api.get('/api/orders/by-reference/tickets', {
              params: { ref: reference },
            })

            if (tRes.status === 202) {
              setStatus('⏳ Pago aprobado, generando tickets...')
              return false
            }

            const list = Array.isArray(tRes.data?.tickets)
              ? tRes.data.tickets
              : []

            setTickets(list)
            setStatus('✅ Tickets listos')
            return true
          } catch (e2) {
            console.error('ERROR_LOADING_TICKETS', e2)
            setError('Pago aprobado, pero no pude cargar los tickets aún. Intenta de nuevo.')
            return false
          }
        }

        if (s === 'DECLINED' || s === 'ERROR' || s === 'VOIDED') {
          setStatus(`❌ Pago no aprobado (${s}).`)
          return true
        }

        setStatus('⏳ Pago en proceso... (esperando confirmación)')
        return false
      } catch (e) {
        console.error('ERROR_CHECKING_STATUS', e)
        setError('No pude verificar el estado aún. Intenta de nuevo.')
        return false
      }
    }

    if (!reference) {
      setStatus('Pago finalizado. Si aprobaste, revisa “Mis tickets”.')
      return
    }

    // Poll inicial + cada 3s hasta 30s
    let tries = 0
    ;(async () => {
      const done = await poll()
      if (done) return

      timer = setInterval(async () => {
        tries += 1
        const done2 = await poll()
        if (done2 || tries >= 10) {
          clearInterval(timer)
        }
      }, 3000)
    })()

    return () => {
      if (timer) clearInterval(timer)
    }
  }, [reference])

  return (
    <div className="app-card">
      <h1 className="app-title">Resultado del pago</h1>

      <div style={{ marginTop: 10, color: '#6b7380' }}>
        {reference ? (
          <div>
            <strong>Referencia:</strong> {reference}
          </div>
        ) : (
          <div>
            <strong>Referencia:</strong> (no recibida)
          </div>
        )}
      </div>

      <div style={{ marginTop: 16, fontSize: 16 }}>{status}</div>

      {error && (
        <div style={{ marginTop: 10, color: 'red' }}>
          {error}
        </div>
      )}

      {/* ✅ AQUÍ sí se renderizan los tickets */}
      {tickets.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ marginBottom: 10 }}>Tus tickets de esta compra</h3>

          <div style={{ display: 'grid', gap: 12 }}>
            {tickets.map((t) => (
              <div
                key={t.id || t.unique_code}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                <div>
                  <strong>Código:</strong> {t.unique_code}
                </div>
                <div>
                  <strong>Estado:</strong> {t.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
        <button
          className="btn-primary"
          onClick={() =>
            reference
              ? navigate(`/my-tickets?ref=${encodeURIComponent(reference)}`)
              : navigate('/my-tickets')
          }
        >
          Ir a Mis tickets
        </button>

        <button className="btn-secondary" onClick={() => navigate('/events')}>
          Volver a Eventos
        </button>
      </div>

      <div style={{ marginTop: 14, color: '#6b7380', fontSize: 12 }}>
        Nota: si el pago fue aprobado, los tickets se generan automáticamente al recibir la confirmación (webhook).
      </div>
    </div>
  )
}

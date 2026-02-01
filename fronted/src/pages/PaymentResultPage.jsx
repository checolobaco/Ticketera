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

  const reference = q.get('reference') || q.get('ref') || q.get('wompi_reference') || ''

  const [status, setStatus] = useState('Procesando...')
  const [error, setError] = useState(null)
  const [tickets, setTickets] = useState([])
  const [orderId, setOrderId] = useState(null) // Guardamos el ID de orden para el reenvío
  const [loadingEmail, setLoadingEmail] = useState(false)

  useEffect(() => {
    let timer = null

    const poll = async () => {
      try {
        setError(null)
        const res = await api.get('/api/orders/by-reference', {
          params: { ref: reference },
        })

        const s = res.data?.payment_status || res.data?.status || 'PENDING'
        setOrderId(res.data?.id) // Guardamos el ID de la orden

        if (s === 'APPROVED' || s === 'PAID') {
          setStatus('✅ Pago aprobado. Cargando tickets...')
          try {
            const tRes = await api.get('/api/orders/by-reference/tickets', {
              params: { ref: reference },
            })
            if (tRes.status === 202) {
              setStatus('⏳ Pago aprobado, generando tickets...')
              return false
            }
            const list = Array.isArray(tRes.data?.tickets) ? tRes.data.tickets : []
            setTickets(list)
            setStatus('✅ Tickets listos')
            return true
          } catch (e2) {
            setError('Pago aprobado, pero no pude cargar los tickets aún.')
            return false
          }
        }
        if (s === 'DECLINED' || s === 'ERROR' || s === 'VOIDED') {
          setStatus(`❌ Pago no aprobado (${s}).`)
          return true
        }
        setStatus('⏳ Pago en proceso...')
        return false
      } catch (e) {
        setError('No pude verificar el estado aún.')
        return false
      }
    }

    if (!reference) {
      setStatus('Pago finalizado. Si aprobaste, revisa “Mis tickets”.')
      return
    }

    let tries = 0
    ;(async () => {
      const done = await poll()
      if (done) return
      timer = setInterval(async () => {
        tries += 1
        const done2 = await poll()
        if (done2 || tries >= 10) clearInterval(timer)
      }, 3000)
    })()

    return () => { if (timer) clearInterval(timer) }
  }, [reference])

  // --- 📧 FUNCIONES DE CORREO ---

  const handleResendEmail = async () => {
    if (!orderId) return alert('No se encontró el ID de la orden')
    setLoadingEmail(true)
    try {
      await api.post(`/api/orders/${orderId}/resend-email`)
      alert('✅ Correo de tickets reenviado con éxito.')
    } catch (err) {
      console.error(err)
      alert('❌ Error al reenviar el correo.')
    } finally {
      setLoadingEmail(false)
    }
  }

  const handlePreviewEmail = async () => {
    if (!orderId) return
    // Abrimos una ventana nueva que cargue el preview desde el backend
    const url = `${api.defaults.baseURL}/api/orders/${orderId}/preview-email`
    window.open(url, '_blank', 'width=800,height=900')
  }

  return (
    <div className="app-card">
      <h1 className="app-title">Resultado del pago</h1>

      <div style={{ marginTop: 10, color: '#6b7380' }}>
        <strong>Referencia:</strong> {reference || '(no recibida)'}
      </div>

      <div style={{ marginTop: 16, fontSize: 16, fontWeight: '500' }}>{status}</div>

      {error && <div style={{ marginTop: 10, color: 'red' }}>{error}</div>}

      {/* ✅ SECCIÓN DE TICKETS Y ACCIONES DE CORREO */}
      {tickets.length > 0 && (
        <div style={{ marginTop: 24, borderTop: '1px solid #eee', paddingTop: 20 }}>
          <h3 style={{ marginBottom: 10 }}>Tus tickets de esta compra</h3>
          
          <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
            {tickets.map((t) => (
              <div key={t.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, background: '#f9fafb' }}>
                <div><strong>Código:</strong> {t.unique_code}</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}><strong>Estado:</strong> {t.status}</div>
              </div>
            ))}
          </div>

          {/* 🔘 BOTONES DE CORREO (Implementación nueva) 
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button 
              className="btn-secondary" 
              style={{ flex: 1, fontSize: 13, padding: '10px' }}
              onClick={handlePreviewEmail}
            >
              👁️ Previsualizar Correo
            </button> 
            */}
        
            <button 
              className="btn-primary" 
              style={{ flex: 1, fontSize: 13, padding: '10px' }}
              onClick={handleResendEmail}
              disabled={loadingEmail}
            >
              {loadingEmail ? 'Enviando...' : '📧 Reenviar Correo'}
            </button>
          </div> 
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
        <button
          className="btn-primary"
          onClick={() => navigate('/login')}
        >
          Iniciar sesión / Mis tickets
        </button>
        ´{/* ✅ Volver a eventos 
        <button className="btn-secondary" onClick={() => navigate('/events')}>
          Volver a Eventos
        </button> */}
      </div>

      <div style={{ marginTop: 14, color: '#6b7380', fontSize: 12 }}>
        Nota: Los tickets se envían automáticamente al correo registrado tras la aprobación del pago.
      </div>
    </div>
  )
}
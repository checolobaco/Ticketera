import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../api'
import EventAdminMenu from '../../components/EventAdminMenu'

function extractQuery(raw) {
  const value = String(raw || '').trim()
  if (!value) return ''

  if (value.startsWith('{')) {
    try {
      const parsed = JSON.parse(value)
      return parsed.tid || parsed.unique_code || value
    } catch {
      return value
    }
  }

  return value
}

export default function AdminCheckin() {
  const { id } = useParams()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [ticket, setTicket] = useState(null)
  const [benefits, setBenefits] = useState([])
  const [redeemingId, setRedeemingId] = useState(null)

  const remainingBenefits = useMemo(
    () => benefits.filter(item => Number(item.redeemed_quantity || 0) < Number(item.total_quantity || 0)),
    [benefits]
  )

  async function searchTicket() {
    const normalized = extractQuery(query)

    if (normalized.length < 2) {
      setError('Ingresa o escanea un QR/codigo valido')
      return
    }

    try {
      setLoading(true)
      setError('')
      setSuccess('')
      setTicket(null)
      setBenefits([])

      const res = await api.get('/api/tickets/search', {
        params: { q: normalized }
      })

      const matches = Array.isArray(res.data) ? res.data : []
      const found = matches.find(row => String(row.event_id || row.eventId || '') === String(id)) || matches[0]

      if (!found) {
        setError('No se encontro un ticket con ese codigo')
        return
      }

      setTicket(found)

      const benefitsRes = await api.get(`/api/tickets/${found.id}/benefits`)
      setBenefits(Array.isArray(benefitsRes.data) ? benefitsRes.data : [])

      if ((benefitsRes.data || []).length) {
        setSuccess('Ticket encontrado. Puedes usar esta vista para entregar beneficios en barra.')
      } else {
        setSuccess('Ticket encontrado. Este ticket no tiene beneficios pendientes.')
      }
    } catch (err) {
      console.error(err)
      setError(err?.response?.data?.error || 'No se pudo consultar el ticket')
    } finally {
      setLoading(false)
    }
  }

  async function redeemBenefit(claimId) {
    if (!ticket) return

    try {
      setRedeemingId(claimId)
      setError('')
      setSuccess('')

      const res = await api.post(`/api/tickets/${ticket.id}/benefits/${claimId}/redeem`, {})
      const updated = res.data

      setBenefits(prev => prev.map(item => item.id === claimId ? updated : item))
      setSuccess(`Beneficio entregado: ${updated.benefit_name}`)
    } catch (err) {
      console.error(err)
      setError(err?.response?.data?.error || 'No se pudo redimir el beneficio')
    } finally {
      setRedeemingId(null)
    }
  }

  return (
    <div className="stack-lg">
      <div>
        <h1 className="app-title">Barra / ingreso</h1>
        <div className="app-subtitle">Evento #{id}</div>
      </div>

      <EventAdminMenu eventId={id} />

      <div className="ticket-card">
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>
          Buscar ticket para entrada o entrega de beneficios
        </div>
        <div style={{ color: '#667085', marginBottom: 14 }}>
          Pega el `qr_payload`, el codigo unico o busca por texto del ticket.
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <textarea
            className="input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder='Ejemplo: {"t":"TICKET","tid":"..."}'
            style={{ minHeight: 90, flex: 1, minWidth: 280 }}
          />
          <button className="btn-primary" onClick={searchTicket} disabled={loading}>
            {loading ? 'Buscando...' : 'Buscar ticket'}
          </button>
        </div>
      </div>

      {error ? <div className="ticket-card" style={{ color: '#b42318', border: '1px solid #fda29b' }}>{error}</div> : null}
      {success ? <div className="ticket-card" style={{ color: '#027a48', border: '1px solid #a6f4c5' }}>{success}</div> : null}

      {ticket ? (
        <div className="ticket-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{ticket.event_name || `Ticket #${ticket.id}`}</div>
              <div style={{ marginTop: 8 }}><strong>Ticket:</strong> #{ticket.id}</div>
              <div style={{ marginTop: 4 }}><strong>Codigo:</strong> {ticket.unique_code}</div>
              <div style={{ marginTop: 4 }}><strong>Titular:</strong> {ticket.holder_name || 'Sin titular'}</div>
              <div style={{ marginTop: 4 }}><strong>Email:</strong> {ticket.holder_email || 'Sin email'}</div>
              <div style={{ marginTop: 4 }}><strong>Estado:</strong> {ticket.status}</div>
            </div>

            <div style={{ minWidth: 240 }}>
              <div style={{ fontSize: 13, color: '#667085' }}>Beneficios pendientes</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{remainingBenefits.length}</div>
            </div>
          </div>
        </div>
      ) : null}

      {ticket && benefits.length === 0 ? (
        <div className="ticket-card">Este ticket no tiene beneficios asociados.</div>
      ) : null}

      {benefits.length > 0 ? (
        <div className="stack-lg">
          {benefits.map(benefit => {
            const total = Number(benefit.total_quantity || 0)
            const redeemed = Number(benefit.redeemed_quantity || 0)
            const remaining = Math.max(0, total - redeemed)

            return (
              <div key={benefit.id} className="ticket-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{benefit.benefit_name}</div>
                    {benefit.benefit_description ? (
                      <div style={{ marginTop: 6, color: '#667085' }}>{benefit.benefit_description}</div>
                    ) : null}
                    <div style={{ marginTop: 10 }}><strong>Total:</strong> {total}</div>
                    <div style={{ marginTop: 4 }}><strong>Entregados:</strong> {redeemed}</div>
                    <div style={{ marginTop: 4 }}><strong>Pendientes:</strong> {remaining}</div>
                    <div style={{ marginTop: 4 }}><strong>Estado:</strong> {benefit.status}</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <button
                      className="btn-primary"
                      disabled={remaining <= 0 || redeemingId === benefit.id}
                      onClick={() => redeemBenefit(benefit.id)}
                    >
                      {redeemingId === benefit.id ? 'Entregando...' : remaining > 0 ? 'Marcar entregado' : 'Ya entregado'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

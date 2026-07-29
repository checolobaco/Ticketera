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
  const [lateRestriction, setLateRestriction] = useState(null)
  const [validatingEntry, setValidatingEntry] = useState(false)

  const remainingBenefits = useMemo(
    () => benefits.filter(item => Number(item.redeemed_quantity || 0) < Number(item.total_quantity || 0)),
    [benefits]
  )

  async function searchTicket() {
    const normalized = extractQuery(query)

    if (normalized.length < 2) {
      setError('Ingresa o escanea un QR / código válido')
      return
    }

    try {
      setLoading(true)
      setError('')
      setSuccess('')
      setTicket(null)
      setBenefits([])
      setLateRestriction(null)

      let parsedPayload = null
      if (query.trim().startsWith('{')) {
        try { parsedPayload = JSON.parse(query.trim()) } catch (_) {}
      }

      const res = await api.get('/api/tickets/search', {
        params: { q: normalized }
      })

      const matches = Array.isArray(res.data) ? res.data : []
      const found = matches.find(row => String(row.event_id || row.eventId || '') === String(id)) || matches[0]

      if (!found) {
        setError('No se encontró un ticket con ese código')
        return
      }

      setTicket(found)

      const benefitsRes = await api.get(`/api/tickets/${found.id}/benefits`)
      setBenefits(Array.isArray(benefitsRes.data) ? benefitsRes.data : [])

      // Intentar validar ingreso directo si es payload de QR completo
      if (parsedPayload && parsedPayload.t === 'TICKET' && parsedPayload.sig) {
        await executeEntryValidation(parsedPayload, false)
      } else {
        if ((benefitsRes.data || []).length) {
          setSuccess('Ticket encontrado. Puedes entregar beneficios en barra.')
        } else {
          setSuccess('Ticket encontrado correctamente.')
        }
      }
    } catch (err) {
      console.error(err)
      setError(err?.response?.data?.error || 'No se pudo consultar el ticket')
    } finally {
      setLoading(false)
    }
  }

  async function executeEntryValidation(payloadObj, allowOverride = false, surchargePaid = 0, lateNotes = '') {
    try {
      setValidatingEntry(true)
      setError('')
      setLateRestriction(null)

      const payload = payloadObj || {
        t: 'TICKET',
        tid: ticket?.unique_code,
        eid: Number(id),
        sig: ticket?.unique_code // fallback si busca por ID
      }

      const res = await api.post('/api/validate-ticket', {
        payload,
        usage_context: 'ENTRY',
        allow_late_override: allowOverride,
        surcharge_paid: surchargePaid,
        late_notes: lateNotes
      })

      const data = res.data

      if (data.valid) {
        setSuccess(
          allowOverride
            ? `✅ Acceso autorizado extemporáneamente. Multa registrada: $${surchargePaid.toLocaleString()} COP`
            : `✅ Ticket válido. Ingreso registrado correctamente (${data.usedEntries}/${data.allowedEntries}).`
        )
        if (ticket) {
          setTicket(prev => ({
            ...prev,
            status: data.completed ? 'USED' : 'ACTIVE',
            used_entries: data.usedEntries
          }))
        }
      } else if (data.reason === 'LATE_ENTRY_RESTRICTED') {
        setLateRestriction(data)
      } else {
        setError(`❌ Ingreso no permitido: ${data.reason || 'Ticket no válido'}`)
      }
    } catch (err) {
      console.error(err)
      setError(err?.response?.data?.reason || 'Error al validar ingreso')
    } finally {
      setValidatingEntry(false)
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
        <h1 className="app-title">Barra & Control de Puerta</h1>
        <div className="app-subtitle">Evento #{id}</div>
      </div>

      <EventAdminMenu eventId={id} />

      <div className="ticket-card">
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>
          Validar Ingreso / Entregar Beneficios
        </div>
        <div style={{ color: '#94a3b8', marginBottom: 14 }}>
          Pega o escanea el `qr_payload` del ticket o busca por código único / cédula.
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <textarea
            className="input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder='Ejemplo: {"t":"TICKET","tid":"TCK-12345","eid":1,"sig":"..."}'
            style={{ minHeight: 90, flex: 1, minWidth: 280 }}
          />
          <button className="btn-primary" onClick={searchTicket} disabled={loading}>
            {loading ? 'Buscando...' : 'Buscar / Validar'}
          </button>
        </div>
      </div>

      {/* ALERTA DE INGRESO EXTEMPORÁNEO Y COBRO DE MULTA */}
      {lateRestriction && (
        <div
          className="ticket-card"
          style={{
            background: 'rgba(245, 158, 11, 0.12)',
            border: '2px solid #f59e0b',
            padding: 20,
            borderRadius: 16
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 900, color: '#f59e0b', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            ⚠️ INGRESO EXTEMPORÁNEO (TICKET VENCIDO)
          </div>
          
          <div style={{ fontSize: 15, color: '#f8fafc', marginBottom: 14, lineHeight: 1.5 }}>
            {lateRestriction.message}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18, background: '#0f172a', padding: 12, borderRadius: 10 }}>
            <div>
              <span style={{ color: '#94a3b8', fontSize: 13 }}>Hora Límite Permitida:</span>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#ef4444' }}>{lateRestriction.entryDeadline}</div>
            </div>
            <div>
              <span style={{ color: '#94a3b8', fontSize: 13 }}>Hora Actual:</span>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b' }}>{lateRestriction.currentTime}</div>
            </div>
            <div>
              <span style={{ color: '#94a3b8', fontSize: 13 }}>Valor Multa Sugerida:</span>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>
                ${Number(lateRestriction.surchargeFee || 0).toLocaleString()} COP
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              className="btn-primary"
              style={{ background: '#10b981', borderColor: '#059669' }}
              disabled={validatingEntry}
              onClick={() => executeEntryValidation(null, true, lateRestriction.surchargeFee, 'Cobro de multa en puerta')}
            >
              💵 Cobrar Multa (${Number(lateRestriction.surchargeFee || 0).toLocaleString()}) y Dar Acceso
            </button>

            <button
              className="btn-secondary"
              style={{ background: '#3b82f6', color: '#fff', borderColor: '#2563eb' }}
              disabled={validatingEntry}
              onClick={() => executeEntryValidation(null, true, 0, 'Autorización excepcional del Admin sin costo')}
            >
              🔑 Autorizar Sin Cobro (Admin)
            </button>
          </div>
        </div>
      )}

      {error ? <div className="ticket-card" style={{ color: '#f87171', border: '1px solid #ef4444', background: 'rgba(239, 68, 68, 0.1)' }}>{error}</div> : null}
      {success ? <div className="ticket-card" style={{ color: '#34d399', border: '1px solid #10b981', background: 'rgba(16, 185, 129, 0.1)' }}>{success}</div> : null}

      {ticket ? (
        <div className="ticket-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{ticket.event_name || `Ticket #${ticket.id}`}</div>
              <div style={{ marginTop: 8 }}><strong>Tipo:</strong> {ticket.ticket_type_name || 'Ticket General'}</div>
              <div style={{ marginTop: 4 }}><strong>Código:</strong> {ticket.unique_code}</div>
              <div style={{ marginTop: 4 }}><strong>Titular:</strong> {ticket.holder_name || 'Sin titular'}</div>
              <div style={{ marginTop: 4 }}><strong>Email:</strong> {ticket.holder_email || 'Sin email'}</div>
              <div style={{ marginTop: 4 }}>
                <strong>Estado:</strong>{' '}
                <span style={{ color: ticket.status === 'USED' ? '#f59e0b' : '#10b981', fontWeight: 800 }}>
                  {ticket.status} ({ticket.used_entries || 0}/{ticket.allowed_entries || 1} accesos)
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center' }}>
              {ticket.status !== 'USED' && !lateRestriction && (
                <button
                  className="btn-primary"
                  disabled={validatingEntry}
                  onClick={() => executeEntryValidation(null, false)}
                >
                  {validatingEntry ? 'Validando...' : '🎟️ Validar Ingreso en Puerta'}
                </button>
              )}

              <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'right' }}>
                Beneficios pendientes: <strong style={{ color: '#fff', fontSize: 16 }}>{remainingBenefits.length}</strong>
              </div>
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
                      <div style={{ marginTop: 6, color: '#94a3b8' }}>{benefit.benefit_description}</div>
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

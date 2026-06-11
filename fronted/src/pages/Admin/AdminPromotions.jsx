import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../api'
import EventAdminMenu from '../../components/EventAdminMenu'

function emptyPromoForm() {
  return {
    code: '',
    discount_type: 'PERCENT',
    discount_value: '',
    discount_cents: '',
    max_discount_cents: '',
    min_order_pesos: '',
    max_uses: '',
    starts_at: '',
    ends_at: '',
    active: true
  }
}

function emptyBenefitForm() {
  return {
    benefit_name: '',
    benefit_description: '',
    quantity_per_ticket: '1',
    active: true
  }
}

function toInputDate(value) {
  if (!value) return ''
  const d = new Date(value)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatMoney(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(Number(value || 0))
}

export default function AdminPromotions() {
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [savingPromo, setSavingPromo] = useState(false)
  const [savingBenefitId, setSavingBenefitId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [promos, setPromos] = useState([])
  const [editingPromoId, setEditingPromoId] = useState(null)
  const [promoForm, setPromoForm] = useState(emptyPromoForm())
  const [benefitDrafts, setBenefitDrafts] = useState({})

  async function load() {
    try {
      setLoading(true)
      setError('')
      const res = await api.get(`/api/events/${id}/promo-codes`)
      const rows = Array.isArray(res.data) ? res.data : []
      setPromos(rows)
      setBenefitDrafts(
        Object.fromEntries(rows.map(row => [row.id, emptyBenefitForm()]))
      )
    } catch (err) {
      console.error(err)
      setError(err?.response?.data?.error || 'No se pudieron cargar las promociones')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id])

  const activePromoCount = useMemo(
    () => promos.filter(row => row.active).length,
    [promos]
  )

  function editPromo(promo) {
    setEditingPromoId(promo.id)
    setPromoForm({
      code: promo.code || '',
      discount_type: promo.discount_type || 'PERCENT',
      discount_value: promo.discount_value ?? '',
      discount_cents: promo.discount_cents ?? '',
      max_discount_cents: promo.max_discount_cents ?? '',
      min_order_pesos: promo.min_order_cents ? Math.round(Number(promo.min_order_cents) / 100) : '',
      max_uses: promo.max_uses ?? '',
      starts_at: toInputDate(promo.starts_at),
      ends_at: toInputDate(promo.ends_at),
      active: promo.active !== false
    })
  }

  function resetPromoForm() {
    setEditingPromoId(null)
    setPromoForm(emptyPromoForm())
  }

  async function submitPromo(e) {
    e.preventDefault()

    try {
      setSavingPromo(true)
      setError('')
      setSuccess('')

      const payload = {
        code: promoForm.code,
        discount_type: promoForm.discount_type,
        discount_value: promoForm.discount_type === 'PERCENT' ? Number(promoForm.discount_value || 0) : null,
        discount_cents: promoForm.discount_type === 'FIXED' ? Math.round(Number(promoForm.discount_cents || 0) * 100) : null,
        max_discount_cents: promoForm.max_discount_cents ? Math.round(Number(promoForm.max_discount_cents) * 100) : null,
        min_order_cents: Math.round(Number(promoForm.min_order_pesos || 0) * 100),
        max_uses: promoForm.max_uses ? Number(promoForm.max_uses) : null,
        starts_at: promoForm.starts_at || null,
        ends_at: promoForm.ends_at || null,
        active: !!promoForm.active
      }

      if (editingPromoId) {
        await api.patch(`/api/events/${id}/promo-codes/${editingPromoId}`, payload)
        setSuccess('Codigo promocional actualizado')
      } else {
        await api.post(`/api/events/${id}/promo-codes`, payload)
        setSuccess('Codigo promocional creado')
      }

      resetPromoForm()
      await load()
    } catch (err) {
      console.error(err)
      setError(err?.response?.data?.error || 'No se pudo guardar el codigo promocional')
    } finally {
      setSavingPromo(false)
    }
  }

  async function removePromo(promoId) {
    if (!window.confirm('Eliminar este codigo promocional?')) return

    try {
      setError('')
      setSuccess('')
      await api.delete(`/api/events/${id}/promo-codes/${promoId}`)
      setSuccess('Codigo promocional eliminado')
      await load()
    } catch (err) {
      console.error(err)
      setError(err?.response?.data?.error || 'No se pudo eliminar el codigo promocional')
    }
  }

  function updateBenefitDraft(promoId, patch) {
    setBenefitDrafts(prev => ({
      ...prev,
      [promoId]: {
        ...(prev[promoId] || emptyBenefitForm()),
        ...patch
      }
    }))
  }

  async function addBenefit(promoId) {
    const draft = benefitDrafts[promoId] || emptyBenefitForm()

    try {
      setSavingBenefitId(`new-${promoId}`)
      setError('')
      setSuccess('')

      await api.post(`/api/events/${id}/promo-codes/${promoId}/benefits`, {
        benefit_name: draft.benefit_name,
        benefit_description: draft.benefit_description,
        quantity_per_ticket: Number(draft.quantity_per_ticket || 1),
        active: !!draft.active
      })

      updateBenefitDraft(promoId, emptyBenefitForm())
      setSuccess('Beneficio agregado')
      await load()
    } catch (err) {
      console.error(err)
      setError(err?.response?.data?.error || 'No se pudo agregar el beneficio')
    } finally {
      setSavingBenefitId(null)
    }
  }

  async function saveBenefit(promoId, benefit) {
    try {
      setSavingBenefitId(benefit.id)
      setError('')
      setSuccess('')
      await api.patch(`/api/events/${id}/promo-codes/${promoId}/benefits/${benefit.id}`, {
        benefit_name: benefit.benefit_name,
        benefit_description: benefit.benefit_description,
        quantity_per_ticket: Number(benefit.quantity_per_ticket || 1),
        active: !!benefit.active
      })
      setSuccess('Beneficio actualizado')
      await load()
    } catch (err) {
      console.error(err)
      setError(err?.response?.data?.error || 'No se pudo actualizar el beneficio')
    } finally {
      setSavingBenefitId(null)
    }
  }

  async function removeBenefit(promoId, benefitId) {
    if (!window.confirm('Eliminar este beneficio?')) return

    try {
      setError('')
      setSuccess('')
      await api.delete(`/api/events/${id}/promo-codes/${promoId}/benefits/${benefitId}`)
      setSuccess('Beneficio eliminado')
      await load()
    } catch (err) {
      console.error(err)
      setError(err?.response?.data?.error || 'No se pudo eliminar el beneficio')
    }
  }

  if (loading) return <div>Cargando promociones...</div>

  return (
    <div className="stack-lg">
      <div>
        <h1 className="app-title">Promociones y beneficios</h1>
        <div className="app-subtitle">Evento #{id}</div>
      </div>

      <EventAdminMenu eventId={id} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div className="ticket-card">
          <div style={{ fontSize: 13, color: '#667085' }}>Codigos activos</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{activePromoCount}</div>
        </div>
        <div className="ticket-card">
          <div style={{ fontSize: 13, color: '#667085' }}>Total codigos</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{promos.length}</div>
        </div>
      </div>

      {error ? <div className="ticket-card" style={{ color: '#b42318', border: '1px solid #fda29b' }}>{error}</div> : null}
      {success ? <div className="ticket-card" style={{ color: '#027a48', border: '1px solid #a6f4c5' }}>{success}</div> : null}

      <div className="ticket-card">
        <h2 style={{ marginTop: 0 }}>{editingPromoId ? 'Editar codigo' : 'Nuevo codigo promocional'}</h2>

        <form onSubmit={submitPromo} style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <input
              className="input"
              placeholder="Codigo. Ej: CORONA10"
              value={promoForm.code}
              onChange={e => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })}
              required
            />

            <select
              className="input"
              value={promoForm.discount_type}
              onChange={e => setPromoForm({ ...promoForm, discount_type: e.target.value })}
            >
              <option value="PERCENT">Porcentaje</option>
              <option value="FIXED">Valor fijo</option>
            </select>

            {promoForm.discount_type === 'PERCENT' ? (
              <input
                className="input"
                type="number"
                min="1"
                max="100"
                placeholder="% descuento"
                value={promoForm.discount_value}
                onChange={e => setPromoForm({ ...promoForm, discount_value: e.target.value })}
                required
              />
            ) : (
              <input
                className="input"
                type="number"
                min="0"
                step="1"
                placeholder="Valor descuento en pesos"
                value={promoForm.discount_cents}
                onChange={e => setPromoForm({ ...promoForm, discount_cents: e.target.value })}
                required
              />
            )}

            <input
              className="input"
              type="number"
              min="0"
              step="1"
              placeholder="Compra minima en pesos"
              value={promoForm.min_order_pesos}
              onChange={e => setPromoForm({ ...promoForm, min_order_pesos: e.target.value })}
            />

            <input
              className="input"
              type="number"
              min="0"
              step="1"
              placeholder="Tope descuento en pesos"
              value={promoForm.max_discount_cents}
              onChange={e => setPromoForm({ ...promoForm, max_discount_cents: e.target.value })}
            />

            <input
              className="input"
              type="number"
              min="1"
              step="1"
              placeholder="Max usos"
              value={promoForm.max_uses}
              onChange={e => setPromoForm({ ...promoForm, max_uses: e.target.value })}
            />

            <input
              className="input"
              type="datetime-local"
              value={promoForm.starts_at}
              onChange={e => setPromoForm({ ...promoForm, starts_at: e.target.value })}
            />

            <input
              className="input"
              type="datetime-local"
              value={promoForm.ends_at}
              onChange={e => setPromoForm({ ...promoForm, ends_at: e.target.value })}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', paddingRight: '16px' }}>
            <label style={{ 
              display: 'flex', 
              gap: '8px', 
              alignItems: 'center', 
              fontWeight: 600,
              fontSize: '14px',
              color: '#333',
              cursor: 'pointer' 
            }}>
              <input
                type="checkbox"
                checked={promoForm.active}
                onChange={e => setPromoForm({ ...promoForm, active: e.target.checked })}
                style={{
                  width: '16px',
                  height: '16px',
                  cursor: 'pointer',
                  accentColor: '#1d4ed8' /* Un azul más sutil y moderno que el nativo */
                }}
              />
              Activo
            </label>
          </div>
{/* 
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={promoForm.active}
              onChange={e => setPromoForm({ ...promoForm, active: e.target.checked })}
            />
            Activo
          </label>
*/}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn-primary" disabled={savingPromo}>
              {savingPromo ? 'Guardando...' : editingPromoId ? 'Actualizar codigo' : 'Crear codigo'}
            </button>

            {editingPromoId ? (
              <button type="button" className="btn-primary" onClick={resetPromoForm}>
                Cancelar edicion
              </button>
            ) : null}
          </div>
        </form>
      </div>

      {promos.length === 0 ? (
        <div className="ticket-card">No hay codigos promocionales creados para este evento.</div>
      ) : (
        promos.map(promo => (
          <div key={promo.id} className="ticket-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{promo.code}</div>
                <div style={{ marginTop: 8, color: '#667085', fontSize: 14 }}>
                  {promo.discount_type === 'PERCENT'
                    ? `${Number(promo.discount_value || 0)}% de descuento`
                    : `${formatMoney(Math.round(Number(promo.discount_cents || 0) / 100))} de descuento`}
                </div>
                <div style={{ marginTop: 4, color: '#667085', fontSize: 14 }}>
                  Compra minima: {formatMoney(Math.round(Number(promo.min_order_cents || 0) / 100))}
                </div>
                <div style={{ marginTop: 4, color: '#667085', fontSize: 14 }}>
                  Usos: {Number(promo.used_count || 0)} / {promo.max_uses == null ? 'sin limite' : promo.max_uses}
                </div>
                <div style={{ marginTop: 4, color: promo.active ? '#027a48' : '#b42318', fontSize: 14, fontWeight: 700 }}>
                  {promo.active ? 'Activo' : 'Inactivo'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <button className="btn-outline" onClick={() => editPromo(promo)}>Editar</button>
                <button className="btn-outline" onClick={() => removePromo(promo.id)}>Eliminar</button>
              </div>
            </div>

            <div style={{ marginTop: 20, borderTop: '1px solid #eaecf0', paddingTop: 18 }}>
              <div style={{ fontWeight: 800, marginBottom: 12 }}>Beneficios canjeables asociados al ticket</div>

              {Array.isArray(promo.benefits) && promo.benefits.length > 0 ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  {promo.benefits.map(benefit => (
                    <div key={benefit.id} style={{ border: '1px solid #eaecf0', borderRadius: 16, padding: 14 }}>
                      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                        <input
                          className="input"
                          value={benefit.benefit_name || ''}
                          onChange={e => {
                            setPromos(prev => prev.map(row => row.id !== promo.id ? row : {
                              ...row,
                              benefits: row.benefits.map(item => item.id !== benefit.id ? item : { ...item, benefit_name: e.target.value })
                            }))
                          }}
                        />
                        <input
                          className="input"
                          value={benefit.benefit_description || ''}
                          onChange={e => {
                            setPromos(prev => prev.map(row => row.id !== promo.id ? row : {
                              ...row,
                              benefits: row.benefits.map(item => item.id !== benefit.id ? item : { ...item, benefit_description: e.target.value })
                            }))
                          }}
                          placeholder="Descripcion. Ej: Reclama una cerveza Corona en la barra"
                        />
                        <input
                          className="input"
                          type="number"
                          min="1"
                          value={benefit.quantity_per_ticket || 1}
                          onChange={e => {
                            setPromos(prev => prev.map(row => row.id !== promo.id ? row : {
                              ...row,
                              benefits: row.benefits.map(item => item.id !== benefit.id ? item : { ...item, quantity_per_ticket: e.target.value })
                            }))
                          }}
                        />
                      </div>
<div style={{ 
  display: 'flex', 
  justifyContent: 'space-between', /* Separa el checkbox a la izquierda y los botones a la derecha */
  alignItems: 'center', /* Alineación vertical perfecta */
  marginTop: '20px', 
  gap: '16px',
  width: '100%'
}}>
  {/* Sección Izquierda: Checkbox Estilizado */}
  <label style={{ 
    display: 'flex', 
    gap: '8px', 
    alignItems: 'center', 
    fontWeight: 600,
    fontSize: '14px',
    color: '#374151', 
    cursor: 'pointer',
    userSelect: 'none'
  }}>
    <input
      type="checkbox"
      checked={benefit.active !== false}
      onChange={e => {
        setPromos(prev => prev.map(row => row.id !== promo.id ? row : {
          ...row,
          benefits: row.benefits.map(item => item.id !== benefit.id ? item : { ...item, active: e.target.checked })
        }))
      }}
      style={{
        width: '16px',
        height: '16px',
        cursor: 'pointer',
        accentColor: '#2563eb'
      }}
    />
    Activo
  </label>

  {/* Sección Derecha: Grupo de Botones de Acción */}
  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
    <button 
      className="btn-outline" 
      onClick={() => removeBenefit(promo.id, benefit.id)}
      style={{ margin: 0 }}
    >
      Eliminar
    </button>

    <button
      className="btn-primary"
      onClick={() => saveBenefit(promo.id, benefit)}
      disabled={savingBenefitId === benefit.id}
      style={{ margin: 0, zIndex: 1 }}
    >
      {savingBenefitId === benefit.id ? 'Guardando...' : 'Actualizar beneficio'}
    </button>
  </div>
</div>                      
{/*
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}>
                          <input
                            type="checkbox"
                            checked={benefit.active !== false}
                            onChange={e => {
                              setPromos(prev => prev.map(row => row.id !== promo.id ? row : {
                                ...row,
                                benefits: row.benefits.map(item => item.id !== benefit.id ? item : { ...item, active: e.target.checked })
                              }))
                            }}
                          />
                          Activo
                        </label>

                        <button
                          className="btn-primary"
                          onClick={() => saveBenefit(promo.id, benefit)}
                          disabled={savingBenefitId === benefit.id}
                        >
                          {savingBenefitId === benefit.id ? 'Guardando...' : 'Guardar beneficio'}
                        </button>

                        <button className="btn-outline" onClick={() => removeBenefit(promo.id, benefit.id)}>
                          Eliminar
                        </button>
                      </div>
*/}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#667085', fontSize: 14, marginBottom: 12 }}>
                  Este codigo no tiene beneficios adicionales todavia.
                </div>
              )}

              <div style={{ marginTop: 16, padding: 14, borderRadius: 16, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>Agregar beneficio</div>
                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                  <input
                    className="input"
                    placeholder="Nombre del beneficio"
                    value={benefitDrafts[promo.id]?.benefit_name || ''}
                    onChange={e => updateBenefitDraft(promo.id, { benefit_name: e.target.value })}
                  />
                  <input
                    className="input"
                    placeholder="Descripcion. Ej: Reclama una cerveza Corona en la barra"
                    value={benefitDrafts[promo.id]?.benefit_description || ''}
                    onChange={e => updateBenefitDraft(promo.id, { benefit_description: e.target.value })}
                  />
                  <input
                    className="input"
                    type="number"
                    min="1"
                    placeholder="Cantidad por ticket"
                    value={benefitDrafts[promo.id]?.quantity_per_ticket || '1'}
                    onChange={e => updateBenefitDraft(promo.id, { quantity_per_ticket: e.target.value })}
                  />
                </div>

                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', /* Separa el checkbox del botón equitativamente */
                  alignItems: 'center', /* Alineación vertical perfecta */
                  marginTop: '20px', 
                  gap: '16px',
                  width: '100%'
                }}>
                  <label style={{ 
                    display: 'flex', 
                    gap: '8px', 
                    alignItems: 'center', 
                    fontWeight: 600,
                    fontSize: '14px',
                    color: '#374151', /* Gris oscuro profesional */
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}>
                    <input
                      type="checkbox"
                      checked={benefitDrafts[promo.id]?.active !== false}
                      onChange={e => updateBenefitDraft(promo.id, { active: e.target.checked })}
                      style={{
                        width: '16px',
                        height: '16px',
                        cursor: 'pointer',
                        accentColor: '#2563eb' /* Azul estilizado que combina con tu interfaz */
                      }}
                    />
                    Activo
                  </label>

                  <button
                    className="btn-primary"
                    onClick={() => addBenefit(promo.id)}
                    disabled={savingBenefitId === `new-${promo.id}`}
                    style={{
                      margin: 0, /* Evita que márgenes externos del botón rompan el flujo */
                      zIndex: 1  /* Asegura que no se superponga de manera extraña */
                    }}
                  >
                    {savingBenefitId === `new-${promo.id}` ? 'Guardando...' : 'Agregar beneficio'}
                  </button>
                </div>
{/*
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={benefitDrafts[promo.id]?.active !== false}
                      onChange={e => updateBenefitDraft(promo.id, { active: e.target.checked })}
                    />
                    Activo
                  </label>

                  <button
                    className="btn-primary"
                    onClick={() => addBenefit(promo.id)}
                    disabled={savingBenefitId === `new-${promo.id}`}
                  >
                    {savingBenefitId === `new-${promo.id}` ? 'Guardando...' : 'Agregar beneficio'}
                  </button>
                </div>
*/}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

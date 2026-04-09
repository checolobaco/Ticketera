import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../api'

const cardStyle = {
  background: '#fff',
  borderRadius: 18,
  border: '1px solid #e8ebf2',
  padding: 20,
  boxShadow: '0 10px 30px rgba(16,24,40,0.06)'
}

const labelStyle = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#344054',
  marginBottom: 6
}

const inputStyle = {
  width: '100%',
  border: '1px solid #d0d5dd',
  borderRadius: 12,
  padding: '12px 14px',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box'
}

const sectionTitleStyle = {
  margin: 0,
  fontSize: 18,
  fontWeight: 700,
  color: '#101828'
}

const mutedStyle = {
  color: '#667085',
  fontSize: 13,
  lineHeight: 1.5
}

function Toggle({ checked, onChange, title, description }) {
  return (
    <label
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 16,
        alignItems: 'center',
        padding: 16,
        border: '1px solid #eaecf0',
        borderRadius: 16,
        cursor: 'pointer',
        background: checked ? '#f8fbff' : '#fff'
      }}
    >
      <div>
        <div style={{ fontWeight: 700, color: '#101828' }}>{title}</div>
        {description ? <div style={{ ...mutedStyle, marginTop: 4 }}>{description}</div> : null}
      </div>

      <div
        style={{
          position: 'relative',
          width: 52,
          height: 30,
          borderRadius: 999,
          background: checked ? '#2563eb' : '#d0d5dd',
          transition: 'all .2s ease'
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0,
            cursor: 'pointer'
          }}
        />
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: checked ? 25 : 3,
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: '#fff',
            transition: 'all .2s ease',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
          }}
        />
      </div>
    </label>
  )
}

export default function AdminPayments() {
  const { id } = useParams()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [staffLoading, setStaffLoading] = useState(false)
  const [addingStaff, setAddingStaff] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [staffError, setStaffError] = useState('')
  const [staffSuccess, setStaffSuccess] = useState('')

  const [manualStaff, setManualStaff] = useState([])
  const [staffEmail, setStaffEmail] = useState('')

  const [form, setForm] = useState({
    environment: 'production',
    wompi_public_key: '',
    wompi_integrity_secret: '',
    wompi_private_key: '',
    wompi_events_secret: '',
    is_active: true,
    enable_wompi: false,
    enable_manual: false,
    enable_receipt: false,
    note: '',
    email_adm: '',
    bank_account: '',
    has_wompi_integrity_secret: false,
    has_wompi_private_key: false,
    has_wompi_events_secret: false
  })

  async function loadStaff() {
    try {
      setStaffLoading(true)
      setStaffError('')

      const res = await api.get(`/api/eventstaff/${id}/staff`)
      setManualStaff(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      console.error(err)
      setStaffError('No se pudo cargar el staff del evento')
    } finally {
      setStaffLoading(false)
    }
  }

  async function load() {
    try {
      setLoading(true)
      setError('')
      setSuccess('')

      const [configRes, staffRes] = await Promise.all([
        api.get(`/api/events/${id}/payment-config`),
        api.get(`/api/eventstaff/${id}/staff`)
      ])

      const data = configRes.data || {}

      setForm(prev => ({
        ...prev,
        environment: data.environment || 'production',
        wompi_public_key: data.wompi_public_key || '',
        wompi_integrity_secret: '',
        wompi_private_key: '',
        wompi_events_secret: '',
        is_active: data.is_active ?? true,
        enable_wompi: data.enable_wompi ?? false,
        enable_manual: data.enable_manual ?? false,
        enable_receipt: data.enable_receipt ?? false,
        note: data.note || '',
        email_adm: data.email_adm || '',
        bank_account: data.bank_account || '',
        has_wompi_integrity_secret: !!data.has_wompi_integrity_secret,
        has_wompi_private_key: !!data.has_wompi_private_key,
        has_wompi_events_secret: !!data.has_wompi_events_secret
      }))

      setManualStaff(Array.isArray(staffRes.data) ? staffRes.data : [])
    } catch (err) {
      console.error(err)
      setError('No se pudo cargar la configuración de pagos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id])

  async function handleSubmit(e) {
    e.preventDefault()

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const payload = {
        environment: form.environment,
        is_active: form.is_active,
        enable_wompi: form.enable_wompi,
        enable_manual: form.enable_manual,
        enable_receipt: form.enable_receipt,
        note: form.note || null,
        email_adm: form.email_adm || null,
        bank_account: form.bank_account || null
      }

      if (String(form.wompi_public_key || '').trim()) {
        payload.wompi_public_key = form.wompi_public_key.trim()
      }

      if (String(form.wompi_integrity_secret || '').trim()) {
        payload.wompi_integrity_secret = form.wompi_integrity_secret.trim()
      }

      if (String(form.wompi_private_key || '').trim()) {
        payload.wompi_private_key = form.wompi_private_key.trim()
      }

      if (String(form.wompi_events_secret || '').trim()) {
        payload.wompi_events_secret = form.wompi_events_secret.trim()
      }

      await api.put(`/api/events/${id}/payment-config`, payload)

      setSuccess('Configuración guardada correctamente')

      setForm(prev => ({
        ...prev,
        wompi_integrity_secret: '',
        wompi_private_key: '',
        wompi_events_secret: '',
        has_wompi_integrity_secret: prev.has_wompi_integrity_secret || !!payload.wompi_integrity_secret,
        has_wompi_private_key: prev.has_wompi_private_key || !!payload.wompi_private_key,
        has_wompi_events_secret: prev.has_wompi_events_secret || !!payload.wompi_events_secret
      }))

      await load()
    } catch (err) {
      console.error(err)
      setError(err?.response?.data?.error || 'No se pudo guardar la configuración')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddStaff(e) {
    e.preventDefault()

    try {
      setAddingStaff(true)
      setStaffError('')
      setStaffSuccess('')

      const email = String(staffEmail || '').trim()
      if (!email) {
        setStaffError('Debes escribir un email')
        return
      }

      await api.post(`/api/eventstaff/${id}/staff`, {
        email,
        can_edit_event: false,
        can_manage_ticket_types: false,
        can_manage_wompi: false
      })

      setStaffEmail('')
      setStaffSuccess('Usuario agregado al staff del evento')
      await loadStaff()
    } catch (err) {
      console.error(err)
      const apiError = err?.response?.data?.error

      if (apiError === 'USER_EMAIL_NOT_FOUND') {
        setStaffError('Ese email no existe en la tabla users')
      } else {
        setStaffError(apiError || 'No se pudo agregar el usuario')
      }
    } finally {
      setAddingStaff(false)
    }
  }

  async function handleRemoveStaff(userId) {
    const ok = window.confirm('¿Quitar este usuario del staff del evento?')
    if (!ok) return

    try {
      setStaffError('')
      setStaffSuccess('')

      await api.delete(`/api/eventstaff/${id}/staff/${userId}`)
      setStaffSuccess('Usuario removido del staff del evento')
      await loadStaff()
    } catch (err) {
      console.error(err)
      setStaffError(err?.response?.data?.error || 'No se pudo eliminar el usuario')
    }
  }

  const wompiEnabled = useMemo(
    () => form.enable_wompi && form.is_active,
    [form.enable_wompi, form.is_active]
  )

  if (loading) {
    return <div>Cargando configuración de pagos...</div>
  }

  return (
    <div className="stack-lg">
      <div>
        <h1 className="app-title">Métodos de pago</h1>
        <div className="app-subtitle">Evento #{id}</div>
      </div>

      {error ? (
        <div style={{ ...cardStyle, border: '1px solid #fda29b', background: '#fff5f4', color: '#b42318' }}>
          {error}
        </div>
      ) : null}

      {success ? (
        <div style={{ ...cardStyle, border: '1px solid #a6f4c5', background: '#ecfdf3', color: '#027a48' }}>
          {success}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="stack-lg">
        <div style={cardStyle}>
          <div style={{ marginBottom: 18 }}>
            <h2 style={sectionTitleStyle}>Canales habilitados</h2>
            <div style={{ ...mutedStyle, marginTop: 6 }}>
              Activa uno o varios métodos de pago por evento.
            </div>
          </div>

          <div style={{ display: 'grid', gap: 14 }}>
            <Toggle
              checked={form.enable_wompi}
              onChange={checked => setForm({ ...form, enable_wompi: checked })}
              title="WOMPI"
              description="Pago online automático con validación y conciliación."
            />

            <Toggle
              checked={form.enable_manual}
              onChange={checked => setForm({ ...form, enable_manual: checked })}
              title="Pago manual"
              description="Útil para taquilla, staff o ventas directas fuera de pasarela."
            />

            <Toggle
              checked={form.enable_receipt}
              onChange={checked => setForm({ ...form, enable_receipt: checked })}
              title="Pago con comprobante"
              description="El comprador sube soporte y el admin aprueba o rechaza la orden."
            />

            <Toggle
              checked={form.is_active}
              onChange={checked => setForm({ ...form, is_active: checked })}
              title="Configuración activa"
              description="Permite desactivar globalmente la configuración de pagos del evento."
            />
          </div>
        </div>

        {form.enable_wompi && (
          <div style={cardStyle}>
            <div style={{ marginBottom: 18 }}>
              <h2 style={sectionTitleStyle}>Configuración WOMPI</h2>
              <div style={{ ...mutedStyle, marginTop: 6 }}>
                Completa las credenciales necesarias para transacciones, validación y webhooks.
              </div>
            </div>

            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              <div>
                <label style={labelStyle}>Ambiente</label>
                <select
                  value={form.environment}
                  onChange={e => setForm({ ...form, environment: e.target.value })}
                  style={inputStyle}
                >
                  <option value="sandbox">sandbox</option>
                  <option value="production">production</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>WOMPI_PUBLIC_KEY</label>
                <input
                  style={inputStyle}
                  value={form.wompi_public_key}
                  onChange={e => setForm({ ...form, wompi_public_key: e.target.value })}
                  placeholder="pk_test_xxx o pub_prod_xxx"
                />
              </div>

              <div>
                <label style={labelStyle}>WOMPI_INTEGRITY_SECRET</label>
                <input
                  style={inputStyle}
                  type="password"
                  value={form.wompi_integrity_secret}
                  onChange={e => setForm({ ...form, wompi_integrity_secret: e.target.value })}
                  placeholder={
                    form.has_wompi_integrity_secret
                      ? 'Ya existe uno guardado. Escribe solo si deseas reemplazarlo.'
                      : 'secret_integrity_xxx'
                  }
                />
              </div>

              <div>
                <label style={labelStyle}>WOMPI_PRIVATE_KEY</label>
                <input
                  style={inputStyle}
                  type="password"
                  value={form.wompi_private_key}
                  onChange={e => setForm({ ...form, wompi_private_key: e.target.value })}
                  placeholder={
                    form.has_wompi_private_key
                      ? 'Ya existe una guardada. Escribe solo si deseas reemplazarla.'
                      : 'prv_test_xxx o prv_prod_xxx'
                  }
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>WOMPI_EVENTS_SECRET</label>
                <input
                  style={inputStyle}
                  type="password"
                  value={form.wompi_events_secret}
                  onChange={e => setForm({ ...form, wompi_events_secret: e.target.value })}
                  placeholder={
                    form.has_wompi_events_secret
                      ? 'Ya existe uno guardado. Escribe solo si deseas reemplazarlo.'
                      : 'Secret para validación de eventos/webhooks'
                  }
                />
              </div>
            </div>

            <div
              style={{
                marginTop: 18,
                padding: 14,
                borderRadius: 14,
                background: wompiEnabled ? '#eff8ff' : '#f8f9fc',
                border: wompiEnabled ? '1px solid #b2ddff' : '1px solid #eaecf0',
                color: '#475467',
                fontSize: 13
              }}
            >
              Estado WOMPI: <strong>{wompiEnabled ? 'ACTIVO' : 'INACTIVO'}</strong>
            </div>
          </div>
        )}

        {form.enable_manual && (
          <div style={cardStyle}>
            <div style={{ marginBottom: 18 }}>
              <h2 style={sectionTitleStyle}>Pago manual</h2>
              <div style={{ ...mutedStyle, marginTop: 6 }}>
                Agrega usuarios del sistema que podrán usar el botón <strong>Confirmar compra</strong> en este evento.
              </div>
            </div>

            {staffError ? (
              <div style={{ marginBottom: 12, color: '#b42318', fontSize: 13 }}>{staffError}</div>
            ) : null}

            {staffSuccess ? (
              <div style={{ marginBottom: 12, color: '#027a48', fontSize: 13 }}>{staffSuccess}</div>
            ) : null}

            <form onSubmit={handleAddStaff} style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={labelStyle}>Agregar usuario por email</label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <input
                    style={{ ...inputStyle, flex: 1, minWidth: 260 }}
                    type="email"
                    value={staffEmail}
                    onChange={e => setStaffEmail(e.target.value)}
                    placeholder="usuario@dominio.com"
                  />
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleAddStaff}
                    disabled={addingStaff}
                    style={{ minWidth: 160 }}
                  >
                    {addingStaff ? 'Agregando...' : 'Agregar staff'}
                  </button>
                </div>
              </div>
            </form>

            <div style={{ marginTop: 18 }}>
              <div style={{ fontWeight: 700, color: '#101828', marginBottom: 10 }}>
                Staff habilitado para pago manual
              </div>

              {staffLoading ? (
                <div style={mutedStyle}>Cargando staff...</div>
              ) : manualStaff.length === 0 ? (
                <div style={mutedStyle}>No hay usuarios agregados aún.</div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {manualStaff.map(row => (
                    <div
                      key={`${row.event_id}-${row.user_id}`}
                      style={{
                        border: '1px solid #eaecf0',
                        borderRadius: 14,
                        padding: 14,
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        alignItems: 'center',
                        flexWrap: 'wrap'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: '#101828' }}>
                          {row.name || 'Sin nombre'}
                        </div>
                        <div style={mutedStyle}>{row.email}</div>
                        <div style={{ ...mutedStyle, marginTop: 4 }}>
                          Role: {row.role}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn-outline"
                        onClick={() => handleRemoveStaff(row.user_id)}
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {form.enable_receipt && (
          <div style={cardStyle}>
            <div style={{ marginBottom: 18 }}>
              <h2 style={sectionTitleStyle}>Pago con comprobante</h2>
              <div style={{ ...mutedStyle, marginTop: 6 }}>
                Configura la información que verá el comprador al subir su comprobante y el correo donde llegarán las notificaciones.
              </div>
            </div>

            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Nota / instrucciones</label>
                <textarea
                  value={form.note}
                  onChange={e => setForm({ ...form, note: e.target.value })}
                  placeholder="Ej: Realiza la transferencia, adjunta el comprobante y espera aprobación del equipo."
                  style={{
                    ...inputStyle,
                    minHeight: 110,
                    resize: 'vertical'
                  }}
                />
              </div>

              <div>
                <label style={labelStyle}>Número de cuenta</label>
                <input
                  style={inputStyle}
                  value={form.bank_account}
                  onChange={e => setForm({ ...form, bank_account: e.target.value })}
                  placeholder="Ej: 0123456789"
                />
              </div>

              <div>
                <label style={labelStyle}>Email de notificaciones</label>
                <input
                  style={inputStyle}
                  type="email"
                  value={form.email_adm}
                  onChange={e => setForm({ ...form, email_adm: e.target.value })}
                  placeholder="pagos@tuempresa.com"
                />
              </div>
            </div>

            <div
              style={{
                marginTop: 18,
                padding: 14,
                borderRadius: 14,
                background: '#f8f9fc',
                border: '1px solid #eaecf0',
                color: '#475467',
                fontSize: 13
              }}
            >
              Cuando un comprador suba un comprobante, podrás revisarlo desde <strong>Aprobar órdenes</strong>.
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="submit"
            className="btn-primary"
            disabled={saving}
            style={{ minWidth: 180, height: 46, borderRadius: 12 }}
          >
            {saving ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </div>
      </form>
    </div>
  )
}
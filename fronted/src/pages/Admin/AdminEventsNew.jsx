import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api'

export default function AdminEventNew() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    description: '',
    start_datetime: '',
    end_datetime: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const onChange = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!form.name || !form.start_datetime) {
      setError('Nombre y fecha de inicio son obligatorios')
      return
    }

    try {
      setLoading(true)
      await api.post('/api/events', {
        name: form.name,
        description: form.description || null,
        start_datetime: new Date(form.start_datetime).toISOString(),
        end_datetime: form.end_datetime ? new Date(form.end_datetime).toISOString() : null
      })
      navigate('/admin', { replace: true })
    } catch (err) {
      console.error(err)
      setError('No se pudo crear el evento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="stack-lg">
      <div>
        <h1 className="app-title">Nuevo evento</h1>
        <div className="app-subtitle">Crea un evento y luego configura tipos de ticket y Wompi.</div>
      </div>

      <form className="ticket-card stack-md" onSubmit={onSubmit}>
        <label className="field">
          <span className="label">Nombre</span>
          <input value={form.name} onChange={(e) => onChange('name', e.target.value)} />
        </label>

        <label className="field">
          <span className="label">Descripción</span>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => onChange('description', e.target.value)}
          />
        </label>

        <label className="field">
          <span className="label">Inicio</span>
          <input
            type="datetime-local"
            value={form.start_datetime}
            onChange={(e) => onChange('start_datetime', e.target.value)}
          />
        </label>

        <label className="field">
          <span className="label">Fin (opcional)</span>
          <input
            type="datetime-local"
            value={form.end_datetime}
            onChange={(e) => onChange('end_datetime', e.target.value)}
          />
        </label>

        {error && <div className="alert error">{error}</div>}

        <div className="row between wrap">
          <button type="button" className="btn-outline" onClick={() => navigate('/admin')}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creando...' : 'Crear evento'}
          </button>
        </div>
      </form>
    </div>
  )
}

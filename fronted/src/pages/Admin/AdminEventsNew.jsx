import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api'

export default function AdminEventNew() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: '',
    description: '',
    start_datetime: '',
    end_datetime: '',
    image_url: '',
    ticket_image_url: '',
    cover_image_url: '',
    organizer_name: '',
    organizer_nit: '',
    pulep_code: ''
  })

  const [files, setFiles] = useState({
    card: null,
    ticket: null,
    cover: null
  })

  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  const onChange = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const onFileChange = (type, file) => {
    setFiles(prev => ({ ...prev, [type]: file || null }))
  }

  const uploadEventImage = async (eventId, file, type) => {
    if (!file) return null

    const fd = new FormData()
    fd.append('file', file)
    fd.append('type', type)

    const res = await api.patch(`/api/events/${eventId}/upload-image`, fd, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })

    return res.data
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!form.name || !form.start_datetime) {
      setError('Nombre y fecha de inicio son obligatorios')
      return
    }

    try {
      setLoading(true)

      const createRes = await api.post('/api/events', {
        name: form.name,
        description: form.description || null,
        start_datetime: new Date(form.start_datetime).toISOString(),
        end_datetime: form.end_datetime ? new Date(form.end_datetime).toISOString() : null,
        image_url: form.image_url || null,
        ticket_image_url: form.ticket_image_url || null,
        cover_image_url: form.cover_image_url || null,
        organizer_name: form.organizer_name || null,
        organizer_nit: form.organizer_nit || null,
        pulep_code: form.pulep_code || null
      })

      const created = createRes.data
      const eventId = created?.id

      if (!eventId) {
        throw new Error('EVENT_ID_NOT_FOUND')
      }

      if (files.card || files.ticket || files.cover) {
        setUploading(true)

        const uploadResults = await Promise.all([
          files.card ? uploadEventImage(eventId, files.card, 'card') : null,
          files.ticket ? uploadEventImage(eventId, files.ticket, 'ticket') : null,
          files.cover ? uploadEventImage(eventId, files.cover, 'cover') : null
        ])

        const merged = uploadResults.filter(Boolean).pop()

        if (merged) {
          created.image_url = merged.image_url ?? created.image_url
          created.ticket_image_url = merged.ticket_image_url ?? created.ticket_image_url
          created.cover_image_url = merged.cover_image_url ?? created.cover_image_url
        }
      }

      navigate('/admin', { replace: true })
    } catch (err) {
      console.error(err)
      setError('No se pudo crear el evento')
    } finally {
      setLoading(false)
      setUploading(false)
    }
  }

  return (
    <div className="stack-lg">
      <div>
        <h1 className="app-title">Nuevo evento</h1>
        <div className="app-subtitle">Crea un evento y luego configura tipos de ticket y pagos.</div>
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

        <div style={{ marginTop: 16, padding: '16px', background: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 15, color: '#1E293B', fontWeight: 700 }}>
            🏛️ Datos del Productor del Evento (Ley 1493 de 2011)
          </h3>
          <p style={{ margin: '0 0 12px 0', fontSize: 12, color: '#64748B' }}>
            Información del responsable o emisor de las boletas. Si se deja en blanco, la boleta mostrará el texto predeterminado del organizador.
          </p>

          <label className="field" style={{ marginBottom: 12 }}>
            <span className="label">Nombre / Razón Social del Productor</span>
            <input
              value={form.organizer_name}
              onChange={(e) => onChange('organizer_name', e.target.value)}
              placeholder="ej. Producciones Tulúa S.A.S."
            />
          </label>

          <label className="field" style={{ marginBottom: 12 }}>
            <span className="label">NIT / Cédula del Productor</span>
            <input
              value={form.organizer_nit}
              onChange={(e) => onChange('organizer_nit', e.target.value)}
              placeholder="ej. 900.123.456-7"
            />
          </label>

          <label className="field">
            <span className="label">Código PULEP (Opcional - Ley 1493)</span>
            <input
              value={form.pulep_code}
              onChange={(e) => onChange('pulep_code', e.target.value)}
              placeholder="ej. EVE-12345 (solo para artes escénicas)"
            />
          </label>
        </div>
       {/*
        <label className="field">
          <span className="label">URL imagen evento (opcional)</span>
          <input
            value={form.image_url}
            onChange={(e) => onChange('image_url', e.target.value)}
            placeholder="URL imagen para EventsPage"
          />
        </label>
        
        <label className="field">
          <span className="label">URL imagen ticket/correo (opcional)</span>
          <input
            value={form.ticket_image_url}
            onChange={(e) => onChange('ticket_image_url', e.target.value)}
            placeholder="URL imagen para ticket/email"
          />
        </label>
      */}
        <label className="field">
          <span className="label">Archivo imagen evento</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onFileChange('card', e.target.files?.[0])}
          />
        </label>

        <label className="field">
          <span className="label">Archivo imagen ticket/correo</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onFileChange('ticket', e.target.files?.[0])}
          />
        </label>

        <label className="field">
          <span className="label">Archivo imagen cover (opcional)</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onFileChange('cover', e.target.files?.[0])}
          />
        </label>

        {error && <div className="alert error">{error}</div>}

        <div className="row between wrap">
          <button type="button" className="btn-primary" onClick={() => navigate('/admin')}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={loading || uploading}>
            {loading || uploading ? 'Guardando...' : 'Crear evento'}
          </button>
        </div>
      </form>
    </div>
  )
}
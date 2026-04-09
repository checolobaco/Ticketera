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
    cover_image_url: ''
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
        cover_image_url: form.cover_image_url || null
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
          <button type="button" className="btn-outline" onClick={() => navigate('/admin')}>
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
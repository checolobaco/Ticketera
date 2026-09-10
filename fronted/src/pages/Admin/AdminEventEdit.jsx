import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../api'
import EventAdminMenu from '../../components/EventAdminMenu'
import ShareQrCard from './ShareQrCard'

export default function AdminEventEdit() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: '',
    description: '',
    start_datetime: '',
    end_datetime: '',
    image_url: '',
    ticket_image_url: '',
    cover_image_url: '',
    share_slug: '',
    organizer_name: '',
    organizer_nit: '',
    pulep_code: ''
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingType, setUploadingType] = useState(null)
  const [files, setFiles] = useState({
    card: null,
    ticket: null,
    cover: null
  })

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/api/events')
        const list = Array.isArray(res.data) ? res.data : []
        const ev = list.find(e => String(e.id) === String(id))

        if (!ev) {
          alert('Evento no encontrado')
          navigate('/admin')
          return
        }

        setForm({
          name: ev.name || '',
          description: ev.description || '',
          start_datetime: ev.start_datetime?.slice(0, 16) || '',
          end_datetime: ev.end_datetime?.slice(0, 16) || '',
          image_url: ev.image_url || '',
          ticket_image_url: ev.ticket_image_url || '',
          cover_image_url: ev.cover_image_url || '',
          share_slug: ev.share_slug || '',
          organizer_name: ev.organizer_name || '',
          organizer_nit: ev.organizer_nit || '',
          pulep_code: ev.pulep_code || ''
        })
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [id, navigate])

  const onChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    })
  }

  const onFileChange = (type, file) => {
    setFiles(prev => ({ ...prev, [type]: file || null }))
  }

  const handleUpload = async (type) => {
    const file = files[type]
    if (!file) {
      alert('Selecciona un archivo primero')
      return
    }

    try {
      setUploadingType(type)

      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', type)

      const res = await api.patch(`/api/events/${id}/upload-image`, fd, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      setForm(prev => ({
        ...prev,
        image_url: res.data.image_url ?? prev.image_url,
        ticket_image_url: res.data.ticket_image_url ?? prev.ticket_image_url,
        cover_image_url: res.data.cover_image_url ?? prev.cover_image_url
      }))

      setFiles(prev => ({ ...prev, [type]: null }))
      alert('Imagen subida correctamente')
    } catch (err) {
      console.error(err)
      alert('Error subiendo imagen')
    } finally {
      setUploadingType(null)
    }
  }

  const onSubmit = async (e) => {
    e.preventDefault()

    try {
      setSaving(true)
      await api.patch(`/api/events/${id}`, {
        name: form.name,
        description: form.description,
        start_datetime: form.start_datetime || null,
        end_datetime: form.end_datetime || null,
        image_url: form.image_url || null,
        ticket_image_url: form.ticket_image_url || null,
        cover_image_url: form.cover_image_url || null,
        organizer_name: form.organizer_name || null,
        organizer_nit: form.organizer_nit || null,
        pulep_code: form.pulep_code || null
      })
      alert('Evento actualizado')
      navigate('/admin')
    } catch (err) {
      console.error(err)
      alert('Error actualizando evento')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div>Cargando...</div>

  return (
    <div className="stack-lg">
      <h1 className="app-title">Editar evento</h1>

      <EventAdminMenu eventId={id} />

      <form className="stack-md" onSubmit={onSubmit}>
        <input
          name="name"
          placeholder="Nombre"
          value={form.name}
          onChange={onChange}
        />

        <textarea
          name="description"
          placeholder="Descripción"
          value={form.description}
          onChange={onChange}
        />

        <input
          type="datetime-local"
          name="start_datetime"
          value={form.start_datetime}
          onChange={onChange}
        />

        <input
          type="datetime-local"
          name="end_datetime"
          value={form.end_datetime}
          onChange={onChange}
        />

        <div style={{ marginTop: 12, padding: '16px', background: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 15, color: '#1E293B', fontWeight: 700 }}>
            🏛️ Datos del Productor del Evento (Ley 1493 de 2011)
          </h3>
          <p style={{ margin: '0 0 12px 0', fontSize: 12, color: '#64748B' }}>
            Información del responsable o emisor de las boletas. Si se deja en blanco, la boleta mostrará el texto predeterminado del organizador.
          </p>

          <label className="field" style={{ marginBottom: 12 }}>
            <span className="label">Nombre / Razón Social del Productor</span>
            <input
              name="organizer_name"
              value={form.organizer_name}
              onChange={onChange}
              placeholder="ej. Producciones Tulúa S.A.S."
            />
          </label>

          <label className="field" style={{ marginBottom: 12 }}>
            <span className="label">NIT / Cédula del Productor</span>
            <input
              name="organizer_nit"
              value={form.organizer_nit}
              onChange={onChange}
              placeholder="ej. 900.123.456-7"
            />
          </label>

          <label className="field">
            <span className="label">Código PULEP (Opcional - Ley 1493)</span>
            <input
              name="pulep_code"
              value={form.pulep_code}
              onChange={onChange}
              placeholder="ej. EVE-12345 (solo para artes escénicas)"
            />
          </label>
        </div>

        <input
          name="image_url"
          placeholder="URL imagen evento"
          value={form.image_url}
          onChange={onChange}
        />

        {form.image_url ? (
          <img
            src={form.image_url}
            alt="Imagen evento"
            style={{ width: '100%', maxWidth: 320, borderRadius: 12 }}
          />
        ) : null}

        <div className="row wrap" style={{ gap: 8 }}>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onFileChange('card', e.target.files?.[0])}
          />
          <button
            type="button"
            className="btn-outline"
            onClick={() => handleUpload('card')}
            disabled={uploadingType === 'card'}
          >
            {uploadingType === 'card' ? 'Subiendo...' : 'Subir imagen evento'}
          </button>
        </div>

        <input
          name="ticket_image_url"
          placeholder="URL imagen ticket/correo"
          value={form.ticket_image_url}
          onChange={onChange}
        />

        {form.ticket_image_url ? (
          <img
            src={form.ticket_image_url}
            alt="Imagen ticket"
            style={{ width: '100%', maxWidth: 320, borderRadius: 12 }}
          />
        ) : null}

        <div className="row wrap" style={{ gap: 8 }}>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onFileChange('ticket', e.target.files?.[0])}
          />
          <button
            type="button"
            className="btn-outline"
            onClick={() => handleUpload('ticket')}
            disabled={uploadingType === 'ticket'}
          >
            {uploadingType === 'ticket' ? 'Subiendo...' : 'Subir imagen ticket'}
          </button>
        </div>

        <input
          name="cover_image_url"
          placeholder="URL imagen cover"
          value={form.cover_image_url}
          onChange={onChange}
        />

        {form.cover_image_url ? (
          <img
            src={form.cover_image_url}
            alt="Imagen cover"
            style={{ width: '100%', maxWidth: 320, borderRadius: 12 }}
          />
        ) : null}

        <div className="row wrap" style={{ gap: 8 }}>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onFileChange('cover', e.target.files?.[0])}
          />
          <button
            type="button"
            className="btn-outline"
            onClick={() => handleUpload('cover')}
            disabled={uploadingType === 'cover'}
          >
            {uploadingType === 'cover' ? 'Subiendo...' : 'Subir imagen cover'}
          </button>
        </div>

        {form.share_slug ? (
		  <div className="ticket-card">
			<strong>Enlace</strong>
			<div style={{ marginTop: 8, marginBottom: 16 }}>
			  {window.location.origin}/e/{form.share_slug}
			</div>

			<ShareQrCard
			  shareSlug={form.share_slug}
			  eventName={form.name}
			  startDate={form.start_datetime}
			  logoUrl= "/CT_simbolo_G.jpg"//"https://cdn.cloud-tickets.com/CT_simbolo_G.jpg"
			/>
		  </div>
		) : null}

        <button className="btn-primary" disabled={saving}>
          {saving ? 'Guardando...' : 'GUARDAR'}
        </button>
      </form>
    </div>
  )
}
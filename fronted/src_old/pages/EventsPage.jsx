import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

export default function EventsPage() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/api/events')
        setEvents(res.data)
      } catch (err) {
        console.error(err)
        setError('Error cargando eventos')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <div>Cargando eventos...</div>
  if (error) return <div style={{ color: 'crimson' }}>{error}</div>

  return (
    <div className="stack-lg">
      <div>
        <h1 className="app-title">Eventos</h1>
        <div className="app-subtitle">Selecciona un evento y compra tickets para generar QR/NFC.</div>
      </div>

      {events.length === 0 ? (
        <div className="ticket-card">No hay eventos creados todavía.</div>
      ) : (
        <div className="stack-md">
          {events.map((ev) => (
            <div key={ev.id} className="ticket-card">
              <div className="ticket-card-header">
                <div>
                  <div style={{ fontWeight: 600 }}>{ev.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                    {new Date(ev.start_datetime).toLocaleString()}
                  </div>
                </div>
                <span className="badge">Evento #{ev.id}</span>
              </div>

              {ev.description ? (
                <div style={{ color: 'var(--text-soft)', fontSize: 13, marginBottom: 12 }}>{ev.description}</div>
              ) : null}

              {/* ✅ Ruta correcta */}
              <Link className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center' }} to={`/events/${ev.id}`}>
                Comprar tickets
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

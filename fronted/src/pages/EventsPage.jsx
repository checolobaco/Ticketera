import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'
import { Link, useNavigate } from 'react-router-dom'

export default function EventsPage() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate() 
  
  // ✅ leer user una sola vez
  const user = useMemo(() => {
    try {
      const raw = localStorage.getItem('user')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }, [])

  const isStaffOrAdmin = user?.role === 'ADMIN' || user?.role === 'STAFF'

  const goAdminNewEvent = () => {
     navigate('/admin/events/new')
  } 

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/api/events')
        const data = res.data

        // ✅ Normalizar respuesta
        const list =
          Array.isArray(data) ? data :
          Array.isArray(data?.events) ? data.events :
          Array.isArray(data?.rows) ? data.rows :
          []

        setEvents(list)

        console.log('EVENTS API RESPONSE:', data)
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
      {/* ✅ Header con botón NUEVO */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 className="app-title">Eventos</h1>
          <div className="app-subtitle">Selecciona un evento y compra tickets para generar QR/NFC.</div>
        </div>

        {isStaffOrAdmin && (
          <button
            type="button"
            className="btn-primary"
            onClick={goAdminNewEvent}
            style={{ whiteSpace: 'nowrap' }}
            title="Crear nuevo evento (Admin)"
          >
            + NUEVO
          </button>
        )}
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

              <Link
                className="btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center' }}
                to={`/events/${ev.id}`}
              >
                Comprar tickets
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

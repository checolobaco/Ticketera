import React, { useEffect, useState } from 'react'
import api from '../../api'
import { Link } from 'react-router-dom'

export default function AdminEvents() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/api/events', { params: { mine: 1 } })
        const data = res.data
        setEvents(Array.isArray(data) ? data : [])
      } catch (e) {
        console.error(e)
        setError('No se pudieron cargar tus eventos')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])


  if (loading) return <div>Cargando admin...</div>
  if (error) return <div style={{ color: 'crimson' }}>{error}</div>

  return (
    <div className="stack-lg">
      <div style={{ display:'flex', justifyContent:'space-between', gap:12 }}>
        <div>
          <h1 className="app-title">Mis eventos</h1>
          <div className="app-subtitle">Solo ADMIN/STAFF.</div>
        </div>
        <Link className="btn-primary" to="/admin/events/new">+ NUEVO</Link>
      </div>

      {events.length === 0 ? (
        <div className="ticket-card">No tienes eventos aún.</div>
      ) : (
        events.map(ev => (
          <div key={ev.id} className="ticket-card">
            <div style={{ fontWeight: 700 }}>{ev.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
              {ev.start_datetime ? new Date(ev.start_datetime).toLocaleString() : '—'}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
/*


import { useEffect, useState } from 'react'
import api from '../../api'

export default function AdminEvents() {
  const [events, setEvents] = useState([])


  useEffect(() => {
    api.get('/api/events', { params: { mine: 1 } })
    setEvents(res.data)

  }, [])

  return (
    <div>
      <h2>Mis eventos</h2>
      <ul>
        {events.map(e => (
          <li key={e.id}>
            {e.name} — {new Date(e.start_datetime).toLocaleString()}
          </li>
        ))}
      </ul>
    </div>
  )
}
*/
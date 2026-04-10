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
        const user = JSON.parse(localStorage.getItem('user') || 'null')
        const isAdmin = user?.role === 'ADMIN'

        const res = await api.get('/api/events', {
          params: isAdmin ? {} : { mine: 1 }
        })

        const data = res.data
        setEvents(Array.isArray(data) ? data : [])
      } catch (e) {
        console.error(e)
        setError('No se pudieron cargar los eventos')
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
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <h1 className="app-title">Mis eventos</h1>
          <div className="app-subtitle">Gestiona tus eventos</div>
        </div>

        <Link className="btn-primary" to="/admin/events/new">
          + NUEVO
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="ticket-card">No tienes eventos aún.</div>
      ) : (
        events.map(ev => (
          <div key={ev.id} className="ticket-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{ev.name}</div>

                <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 4 }}>
                  {ev.start_datetime ? new Date(ev.start_datetime).toLocaleString() : '—'}
                </div>

                {ev.share_slug && (
                  <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 4 }}>
                    slug: {ev.share_slug}
                  </div>
                )}
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                ID: {ev.id}
              </div>
            </div>

            <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link
                className="btn-primary"
                to={`/admin/events/${ev.id}/edit`}
              >
                Evento
              </Link>

              <Link
                className="btn-primary"
                to={`/admin/events/${ev.id}/ticket-types`}
              >
                Tickets
              </Link>

              <Link
                className="btn-primary"
                to={`/admin/events/${ev.id}/payment`}
              >
                Pagos
              </Link>

              <Link
                className="btn-primary"
                to={`/admin/events/${ev.id}/approvedorder`}
              >
                Aprobar Orden
              </Link>
            {/*  --- IGNORE --- 
              <Link
                className="btn-outline"
                to={`/admin/events/${ev.id}/sales`}
              >
                VENTAS
              </Link>

              <Link
                className="btn-outline"
                to={`/admin/events/${ev.id}/checkin`}
              >
                CHECK-IN
              </Link>
            */}
              <Link
                className="btn-primary"
                to={`/events/${ev.id}`}
              >
                Ver Evento
              </Link>

              <Link
              
                className="btn-primary"
                to={`/admin/events/${ev.id}/reports`}
              >
                Reportes
              </Link>

            </div>
          </div>
        ))
      )}
    </div>
  )
}
import React, { useEffect, useState } from 'react'
import api from '../../api'
import { Link } from 'react-router-dom'

export default function AdminEvents() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const user = JSON.parse(localStorage.getItem('user') || 'null')
  const isAdmin = user?.role === 'ADMIN'

  useEffect(() => {
    const load = async () => {
      try {
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
  }, [isAdmin])

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
        events.map(ev => {
          const isBoxofficeDisabledForUser = ev.is_boxoffice_enabled === false && !isAdmin;

          return (
            <div key={ev.id} className="ticket-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{ev.name}</div>

                  <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 4 }}>
                    {ev.start_datetime ? new Date(ev.start_datetime).toLocaleDateString() : '—'}
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

              <div style={{ 
                marginTop: 16, 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', 
                gap: 10 
              }}>
                <Link
                  className="btn-primary"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  to={`/admin/events/${ev.id}/edit`}
                >
                  Evento
                </Link>

                <Link
                  className="btn-primary"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  to={`/admin/events/${ev.id}/ticket-types`}
                >
                  Tickets
                </Link>

                <Link
                  className="btn-primary"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  to={`/admin/events/${ev.id}/payment`}
                >
                  Pagos
                </Link>

                <Link
                  className="btn-primary"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  to={`/admin/events/${ev.id}/approvedorder`}
                >
                  Aprobar Orden
                </Link>

                <Link
                  className="btn-primary"
                  to={isBoxofficeDisabledForUser ? '#' : `/admin/events/${ev.id}/boxoffice`}
                  onClick={(e) => {
                    if (isBoxofficeDisabledForUser) {
                      e.preventDefault()
                      alert('La página de Taquilla se encuentra deshabilitada para este evento.')
                    }
                  }}
                  style={{ 
                    width: '100%', 
                    boxSizing: 'border-box',
                    opacity: ev.is_boxoffice_enabled === false ? (isAdmin ? 0.8 : 0.45) : 1,
                    filter: isBoxofficeDisabledForUser ? 'grayscale(1)' : 'none',
                    cursor: isBoxofficeDisabledForUser ? 'not-allowed' : 'pointer',
                    background: isBoxofficeDisabledForUser ? '#9ca3af' : undefined,
                    borderColor: isBoxofficeDisabledForUser ? '#9ca3af' : undefined
                  }}
                >
                  Taquilla {ev.is_boxoffice_enabled === false ? '(Inactiva)' : ''}
                </Link>

                <Link
                  className="btn-primary"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  to={`/admin/events/${ev.id}/checkin`}
                >
                  Barra / ingreso
                </Link>

                <Link
                  className="btn-primary"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  to={`/admin/events/${ev.id}/promotions`}
                >
                  Promociones
                </Link>

                <Link
                  className="btn-primary"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  to={`/events/${ev.id}`}
                >
                  Ver Evento
                </Link>

                <Link
                  className="btn-primary"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  to={`/admin/events/${ev.id}/reports`}
                >
                  Reportes
                </Link>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

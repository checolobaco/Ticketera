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
  if (error) return <div style={{ color: 'red' }}>{error}</div>

  if (events.length === 0) {
    return <div>No hay eventos creados todavía.</div>
  }

  return (
    <div>
      <h2>Eventos disponibles</h2>
      <ul>
        {events.map(ev => (
          <li key={ev.id} style={{ marginBottom: '10px' }}>
            <strong>{ev.name}</strong> ({new Date(ev.start_datetime).toLocaleString()})<br />
            {ev.description}<br />
            <Link to={`/events/${ev.id}/buy`}>Comprar tickets</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

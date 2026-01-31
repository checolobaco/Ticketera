import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../api'

export default function AdminTicketTypes() {
  const { id } = useParams()
  const [types, setTypes] = useState([])

  useEffect(() => {
    api.get(`/api/admin/events/${id}/ticket-types`)
      .then(r => setTypes(r.data))
  }, [id])

  return (
    <div>
      <h2>Tipos de ticket</h2>
      <ul>
        {types.map(t => (
          <li key={t.id}>
            {t.name} – ${t.price_cents / 100}
          </li>
        ))}
      </ul>
    </div>
  )
}

import React, { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import api from '../api'

const navItems = [
  { key: 'edit', label: 'Evento', to: id => `/admin/events/${id}/edit` },
  { key: 'tickets', label: 'Tickets', to: id => `/admin/events/${id}/ticket-types` },
  { key: 'payments', label: 'Pagos', to: id => `/admin/events/${id}/payment` },
  { key: 'orders', label: 'Aprobar orden', to: id => `/admin/events/${id}/approvedorder` },
  { key: 'boxoffice', label: 'Taquilla', to: id => `/admin/events/${id}/boxoffice` },
  { key: 'promotions', label: 'Promociones', to: id => `/admin/events/${id}/promotions` },
  { key: 'checkin', label: 'Barra / ingreso', to: id => `/admin/events/${id}/checkin` },
  { key: 'view', label: 'Ver evento', to: id => `/events/${id}` },
  { key: 'reports', label: 'Reportes', to: id => `/admin/events/${id}/reports` }
]

export default function EventAdminMenu({ eventId }) {
  const [isBoxofficeEnabled, setIsBoxofficeEnabled] = useState(true)

  useEffect(() => {
    if (!eventId) return
    async function checkEvent() {
      try {
        const res = await api.get(`/api/events/${eventId}`)
        if (res.data && res.data.is_boxoffice_enabled !== undefined) {
          setIsBoxofficeEnabled(res.data.is_boxoffice_enabled)
        }
      } catch (err) {
        console.error('Error fetching event boxoffice status:', err)
      }
    }
    checkEvent()
  }, [eventId])

  if (!eventId) return null

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: 10,
        padding: 14,
        borderRadius: 18,
        border: '1px solid #dfe3ea',
        background: 'linear-gradient(135deg, #f9fbff 0%, #eef4ff 100%)'
      }}
    >
      {navItems.map(item => {
        const isBoxofficeKey = item.key === 'boxoffice'
        const isDisabled = isBoxofficeKey && !isBoxofficeEnabled

        return (
          <NavLink
            key={item.key}
            to={isDisabled ? '#' : item.to(eventId)}
            onClick={(e) => {
              if (isDisabled) {
                e.preventDefault()
                alert('La página de Taquilla se encuentra deshabilitada para este evento.')
              }
            }}
            className={({ isActive }) => (isActive && !isDisabled ? 'btn-primary' : 'btn-outline')}
            style={{ 
              width: '100%', 
              boxSizing: 'border-box',
              opacity: isDisabled ? 0.45 : 1,
              filter: isDisabled ? 'grayscale(1)' : 'none',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              background: isDisabled ? '#f3f4f6' : undefined,
              borderColor: isDisabled ? '#d1d5db' : undefined,
              color: isDisabled ? '#6b7280' : undefined
            }}
            end={item.key === 'view'}
          >
            {item.label} {isDisabled ? '(Inactiva)' : ''}
          </NavLink>
        )
      })}
    </div>
  )
}

import { NavLink } from 'react-router-dom'

const navItems = [
  { key: 'edit', label: 'Evento', to: id => `/admin/events/${id}/edit` },
  { key: 'tickets', label: 'Tickets', to: id => `/admin/events/${id}/ticket-types` },
  { key: 'payments', label: 'Pagos', to: id => `/admin/events/${id}/payment` },
  { key: 'orders', label: 'Aprobar orden', to: id => `/admin/events/${id}/approvedorder` },
  { key: 'promotions', label: 'Promociones', to: id => `/admin/events/${id}/promotions` },
  { key: 'checkin', label: 'Barra / ingreso', to: id => `/admin/events/${id}/checkin` },
  { key: 'view', label: 'Ver evento', to: id => `/events/${id}` },
  { key: 'reports', label: 'Reportes', to: id => `/admin/events/${id}/reports` }
]

export default function EventAdminMenu({ eventId }) {
  if (!eventId) return null

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap',
        padding: 14,
        borderRadius: 18,
        border: '1px solid #dfe3ea',
        background: 'linear-gradient(135deg, #f9fbff 0%, #eef4ff 100%)'
      }}
    >
      {navItems.map(item => (
        <NavLink
          key={item.key}
          to={item.to(eventId)}
          className={({ isActive }) => (isActive ? 'btn-primary' : 'btn-outline')}
          end={item.key === 'view'}
        >
          {item.label}
        </NavLink>
      ))}
    </div>
  )
}

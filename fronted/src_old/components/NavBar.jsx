import React from 'react'
import { Link, useNavigate } from 'react-router-dom'

export default function NavBar({ user, setUser }) {
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    navigate('/login')
  }

  return (
    <nav style={{ padding: '10px', borderBottom: '1px solid #ccc', marginBottom: '20px' }}>
      <Link to="/events" style={{ marginRight: '10px' }}>Eventos</Link>
      <Link to="/my-tickets" style={{ marginRight: '10px' }}>Mis tickets</Link>
      {user && (user.role === 'ADMIN' || user.role === 'STAFF') && (
        <Link to="/admin/nfc" style={{ marginRight: '10px' }}>Asignar NFC</Link>
      )}
      <span style={{ float: 'right' }}>
        {user ? (
          <>
            <span style={{ marginRight: '10px' }}>{user.name} ({user.role})</span>
            <button onClick={handleLogout}>Salir</button>
          </>
        ) : (
          <Link to="/login">Login</Link>
        )}
      </span>
    </nav>
  )
}

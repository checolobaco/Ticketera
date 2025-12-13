import React, { useEffect, useMemo, useState } from 'react'
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom'

import EventsPage from './pages/EventsPage'
import PurchasePage from './pages/PurchasePage'
import MyTicketsPage from './pages/MyTicketsPage'
import LoginPage from './pages/LoginPage'
import AdminNFCPage from './pages/AdminNFCPage'

import ProtectedRoute from './components/ProtectedRoute'

function safeReadUser() {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function AppShell({ user, onLogout, children }) {
  const isAdmin = user && (user.role === 'ADMIN' || user.role === 'STAFF')

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand">
            <div className="brand-logo" />
            <div>
              <div className="brand-title">CloudTickets</div>
              <div className="brand-sub">Control de acceso inteligente</div>
            </div>
          </div>

          {/* ✅ No mostrar navegación si no hay sesión */}
          {user ? (
            <div className="row centered">
              <nav className="app-nav">
                <NavLink to="/events" className={({ isActive }) => (isActive ? 'active' : '')}>
                  Eventos
                </NavLink>
                <NavLink to="/my-tickets" className={({ isActive }) => (isActive ? 'active' : '')}>
                  Mis tickets
                </NavLink>
                {isAdmin ? (
                  <NavLink to="/admin/nfc" className={({ isActive }) => (isActive ? 'active' : '')}>
                    Admin
                  </NavLink>
                ) : null}
              </nav>
              <button className="btn-ghost" onClick={onLogout}>
                Salir
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <main className="app-main">
        <div className="app-main-inner">{children}</div>
      </main>
    </div>
  )
}

export default function App() {
  const navigate = useNavigate()

  // ✅ Mantener sesión entre recargas
  const [user, setUser] = useState(() => safeReadUser())

  // Si existe token pero no user, aún así forzamos login
  const hasToken = useMemo(() => !!localStorage.getItem('token'), [user])

  useEffect(() => {
    // Si no hay token, limpiar cualquier user
    if (!localStorage.getItem('token')) {
      setUser(null)
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    navigate('/login', { replace: true })
  }

  return (
    <AppShell user={user} onLogout={handleLogout}>
      <Routes>
        {/* ✅ Primera pantalla: login */}
        <Route
          path="/login"
          element={
            user ? (
              <Navigate to="/events" replace />
            ) : (
              <div className="app-card">
                <LoginPage setUser={setUser} />
              </div>
            )
          }
        />

        {/* ✅ Rutas protegidas: si no hay sesión, redirige a login */}
        <Route
          path="/events"
          element={
            <ProtectedRoute user={user}>
              <div className="app-card">
                <EventsPage />
              </div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/events/:id"
          element={
            <ProtectedRoute user={user}>
              <div className="app-card">
                <PurchasePage />
              </div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-tickets"
          element={
            <ProtectedRoute user={user}>
              <div className="app-card">
                <MyTicketsPage />
              </div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/nfc"
          element={
            <ProtectedRoute user={user}>
              <div className="app-card">
                <AdminNFCPage user={user} />
              </div>
            </ProtectedRoute>
          }
        />

        {/* ✅ Root */}
        <Route path="/" element={user ? <Navigate to="/events" replace /> : <Navigate to="/login" replace />} />

        {/* ✅ Fallback */}
        <Route path="*" element={user ? <Navigate to="/events" replace /> : <Navigate to="/login" replace />} />
      </Routes>
    </AppShell>
  )
}

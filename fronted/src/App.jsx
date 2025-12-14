import React, { useEffect, useMemo, useState } from 'react'
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom'

import EventsPage from './pages/EventsPage'
import PurchasePage from './pages/PurchasePage'
import MyTicketsPage from './pages/MyTicketsPage'
import LoginPage from './pages/LoginPage'
import AdminNFCPage from './pages/AdminNFCPage'

import ProtectedRoute from './components/ProtectedRoute'

/* ================= ICONOS ================= */

function Icon({ name, size = 18 }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", xmlns: "http://www.w3.org/2000/svg" }
  switch (name) {
    case "logout":
      return (
        <svg {...common}>
          <path d="M10 7V5.8A2.8 2.8 0 0 1 12.8 3h4.4A2.8 2.8 0 0 1 20 5.8v12.4A2.8 2.8 0 0 1 17.2 21h-4.4A2.8 2.8 0 0 1 10 18.2V17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          <path d="M3 12h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          <path d="M6.5 8.5 3 12l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    default:
      return null
  }
}

/* ================= HELPERS ================= */

function safeReadUser() {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function clearSession() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  localStorage.removeItem('role')
  localStorage.removeItem('lastActivity')
}

/* ================= SHELL ================= */

function AppShell({ user, onLogout, children }) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="top-band" />
        <div className="app-header-inner" style={{ marginTop: '20px' }}>
          <div className="brand">
            <div className="brand-logo" />
            <div>
              <div className="brand-title">CloudTickets</div>
              <div className="brand-sub">Control de acceso inteligente</div>
            </div>
          </div>

          {user && (
            <div className="row centered">
              <nav className="app-nav">
                <NavLink to="/events">Eventos</NavLink>
                <NavLink to="/my-tickets">Mis tickets</NavLink>
              </nav>
              <button className="btn-primary" onClick={onLogout}>
                <Icon name="logout" />
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="app-main">
        <div className="app-main-inner">{children}</div>
      </main>
    </div>
  )
}

/* ================= APP ================= */

export default function App() {
  const navigate = useNavigate()
  const [user, setUser] = useState(() => safeReadUser())

  /* ========= LOGOUT ========= */

  const handleLogout = () => {
    clearSession()
    setUser(null)
    navigate('/login', { replace: true })
  }

  /* ========= SESIÓN VIVA (CIERRE TOTAL) ========= */

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      setUser(null)
      return
    }

    const alive = sessionStorage.getItem('app_alive')
    if (!alive) {
      clearSession()
      setUser(null)
    }

    sessionStorage.setItem('app_alive', '1')
  }, [])

  /* ========= INACTIVIDAD 30 MIN ========= */

  useEffect(() => {
    if (!user) return

    const IDLE_MS = 30 * 60 * 1000
    let timer = null

    const touch = () => {
      localStorage.setItem('lastActivity', String(Date.now()))
    }

    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        const last = Number(localStorage.getItem('lastActivity') || '0')
        if (!last || Date.now() - last >= IDLE_MS) {
          handleLogout()
        } else {
          schedule()
        }
      }, IDLE_MS)
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach(e => window.addEventListener(e, touch, { passive: true }))

    touch()
    schedule()

    return () => {
      clearTimeout(timer)
      events.forEach(e => window.removeEventListener(e, touch))
    }
  }, [user])

  /* ========= VOLVER DE BACKGROUND ========= */

  useEffect(() => {
    if (!user) return

    const IDLE_MS = 30 * 60 * 1000
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        const last = Number(localStorage.getItem('lastActivity') || '0')
        if (last && Date.now() - last >= IDLE_MS) {
          handleLogout()
        }
      }
    }

    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [user])

  /* ========= CIERRE DE PESTAÑA (WEB) ========= */

  useEffect(() => {
    const onUnload = () => clearSession()
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [])

  /* ========= ROUTES ========= */

  return (
    <AppShell user={user} onLogout={handleLogout}>
      <Routes>

        <Route
          path="/login"
          element={
            user
              ? <Navigate to="/events" replace />
              : <div className="app-card"><LoginPage setUser={setUser} /></div>
          }
        />

        <Route path="/events" element={
          <ProtectedRoute user={user}>
            <div className="app-card"><EventsPage /></div>
          </ProtectedRoute>
        } />

        <Route path="/events/:id" element={
          <ProtectedRoute user={user}>
            <div className="app-card"><PurchasePage /></div>
          </ProtectedRoute>
        } />

        <Route path="/my-tickets" element={
          <ProtectedRoute user={user}>
            <div className="app-card"><MyTicketsPage /></div>
          </ProtectedRoute>
        } />

        <Route path="/admin/nfc" element={
          <ProtectedRoute user={user}>
            <div className="app-card"><AdminNFCPage user={user} /></div>
          </ProtectedRoute>
        } />

        <Route path="/" element={<Navigate to={user ? '/events' : '/login'} replace />} />
        <Route path="*" element={<Navigate to={user ? '/events' : '/login'} replace />} />

      </Routes>
    </AppShell>
  )
}

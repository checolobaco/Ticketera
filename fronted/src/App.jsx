import React, { useState } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import EventsPage from './pages/EventsPage'
import PurchasePage from './pages/PurchasePage'
import MyTicketsPage from './pages/MyTicketsPage'
import LoginPage from './pages/LoginPage'

function AppShell({ children }) {
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
          <nav className="app-nav">
            <NavLink to="/events" className={({ isActive }) => isActive ? 'active' : ''}>
              Eventos
            </NavLink>
            <NavLink to="/my-tickets" className={({ isActive }) => isActive ? 'active' : ''}>
              Mis tickets
            </NavLink>
            <NavLink to="/login" className={({ isActive }) => isActive ? 'active' : ''}>
              Admin
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="app-main">
        <div className="app-main-inner">
          {children}
        </div>
      </main>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)

  return (
    <AppShell>
      <Routes>
        <Route path="/events" element={<div className="app-card"><EventsPage /></div>} />
        <Route path="/events/:id" element={<div className="app-card"><PurchasePage /></div>} />
        <Route path="/my-tickets" element={<div className="app-card"><MyTicketsPage /></div>} />
        <Route
          path="/login"
          element={
            <div className="app-card">
              <LoginPage setUser={setUser} />
            </div>
          }
        />
        <Route
          path="*"
          element={
            <div className="app-card">
              <EventsPage />
            </div>
          }
        />
      </Routes>
    </AppShell>
  )
}

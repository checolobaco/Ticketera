import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../api'

function TinyIcon({ name }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", xmlns: "http://www.w3.org/2000/svg" }
  switch (name) {
    case "user":
      return (
        <svg {...common}>
          <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" stroke="currentColor" strokeWidth="1.8"/>
          <path d="M4.5 21a7.5 7.5 0 0 1 15 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      )
    case "lock":
      return (
        <svg {...common}>
          <path d="M7.5 10.5V8.2A4.5 4.5 0 0 1 12 3.7a4.5 4.5 0 0 1 4.5 4.5v2.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          <path d="M7 10.5h10A2.5 2.5 0 0 1 19.5 13v5.5A2.5 2.5 0 0 1 17 21H7A2.5 2.5 0 0 1 4.5 18.5V13A2.5 2.5 0 0 1 7 10.5Z" stroke="currentColor" strokeWidth="1.8"/>
        </svg>
      )
    case "help":
      return (
        <svg {...common}>
          <path d="M12 21a9 9 0 1 0-9-9 9 9 0 0 0 9 9Z" stroke="currentColor" strokeWidth="1.8"/>
          <path d="M9.8 9.4A2.4 2.4 0 0 1 12 8a2.3 2.3 0 0 1 2.4 2.2c0 1.6-1.6 2-2.2 2.6-.5.4-.5.8-.5 1.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          <path d="M12 17.2h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
        </svg>
      )
    default:
      return null
  }
}

export default function LoginPage({ setUser, onLoginSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    try {
      const res = await api.post('/api/auth/login', { email, password })
      const { token, user } = res.data

      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))

      setUser?.(user)
      onLoginSuccess?.()

      // ✅ ADMIN/STAFF -> /admin
      if (user.role === 'ADMIN' || user.role === 'STAFF') {
        navigate('/admin', { replace: true })
        return
      }

      // ✅ CLIENT -> /events
      navigate('/events', { replace: true })
    } catch (err) {
      console.error(err)
      setError('Credenciales inválidas o error de servidor')
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-left">
          <div className="auth-left-inner">
            <div className="oci-pill">Plataforma</div>
            <div className="auth-brand">
              <div className="brand-logo big" />
              <div>
                <div className="brand-title">CloudTickets</div>
                <div className="brand-sub">FunPass NFC / QR</div>
              </div>
            </div>

            <div className="auth-bullets">
              <div className="auth-bullet">• Venta y asignación de tickets</div>
              <div className="auth-bullet">• Validación NFC/QR offline-local</div>
              <div className="auth-bullet">• Compartir ticket como imagen</div>
            </div>
          </div>
        </div>

        <div className="auth-right">
          <div className="auth-right-inner">
            <div className="auth-header">
              <div>
                <h1 className="app-title">Iniciar sesión</h1>
                <p className="app-subtitle">Accede a tu consola de eventos y tickets.</p>
              </div>
              <button
                type="button"
                className="icon-btn"
                title="Ayuda"
                onClick={() => alert('Ingresa tu email y contraseña. Si no funciona, comunicate con soporte TI.')}
              >
                <TinyIcon name="help" />
              </button>
            </div>

            <form className="stack-md" onSubmit={handleSubmit}>
              <label className="field">
                <span className="label">Email</span>
                <div className="input-icon">
                  <span className="input-ico"><TinyIcon name="user" /></span>
                  <input
                    value={email}
                    inputMode="email"
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="cliente@example.com"
                    autoComplete="email"
                  />
                </div>
              </label>

              <label className="field">
                <span className="label">Contraseña</span>
                <div className="input-icon">
                  <span className="input-ico"><TinyIcon name="lock" /></span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>
              </label>

              {error ? <div className="alert error">{error}</div> : null}

              <div className="row between wrap">
                <button type="submit" className="btn-primary">Entrar</button>
              </div>

              <div style={{ fontSize: 13, color: '#6b7380', marginTop: 10 }}>
                ¿No tienes cuenta? <Link to="/register">Crear cuenta</Link>
              </div>

              <div className="divider" />
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

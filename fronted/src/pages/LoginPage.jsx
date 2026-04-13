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
  const [submitting, setSubmitting] = useState(false)
  const [retryMessage, setRetryMessage] = useState('')
  const navigate = useNavigate()

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (submitting) return

    setError(null)
    setRetryMessage('')
    setSubmitting(true)

    const maxAttempts = 4

    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          if (attempt > 1) {
            setRetryMessage(`Activando servidor y base de datos... intento ${attempt} de ${maxAttempts}`)
          }

          const res = await api.post(
            '/api/auth/login',
            { email, password },
            { timeout: 15000 }
          )

          const { token, user } = res.data

          localStorage.setItem('token', token)
          localStorage.setItem('user', JSON.stringify(user))

          setUser?.(user)
          onLoginSuccess?.()

          const postLoginRedirect = sessionStorage.getItem('postLoginRedirect')
          const postLoginEventId = sessionStorage.getItem('postLoginEventId')
          const postLoginShareSlug = sessionStorage.getItem('postLoginShareSlug')

          if (postLoginEventId) {
            try {
              await api.patch(
                '/api/auth/me/link-event',
                { eventId: Number(postLoginEventId) },
                {
                  headers: {
                    Authorization: `Bearer ${token}`
                  },
                  timeout: 15000
                }
              )
            } catch (linkErr) {
              console.error('No se pudo asociar el evento al usuario', linkErr)
            }
          }

          sessionStorage.removeItem('postLoginRedirect')
          sessionStorage.removeItem('postLoginEventId')
          sessionStorage.removeItem('postLoginShareSlug')

          if (postLoginRedirect) {
            navigate(postLoginRedirect, { replace: true })
            return
          }

          if (postLoginShareSlug) {
            navigate(`/e/${postLoginShareSlug}`, { replace: true })
            return
          }

          if (user.role === 'ADMIN' || user.role === 'STAFF') {
            navigate('/admin', { replace: true })
            return
          }

          navigate('/events', { replace: true })
          return
        } catch (err) {
          console.error(`Login intento ${attempt} fallido`, err)

          const status = err?.response?.status
          const backendMessage = err?.response?.data?.message || ''
          const isAuthError = status === 400 || status === 401 || status === 403
          const isLastAttempt = attempt === maxAttempts

          if (isAuthError) {
            setError('Credenciales inválidas')
            return
          }

          if (isLastAttempt) {
            setError(
              backendMessage ||
              'No se pudo iniciar sesión en este momento. Intenta de nuevo en unos segundos.'
            )
            return
          }

          await wait(2500)
        }
      }
    } finally {
      setSubmitting(false)
      setRetryMessage('')
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-left">
          <div className="auth-left-inner">
            <div className="auth-brand">
              <img
                src="https://cdn.cloud-tickets.com/Icon_1.jpg"
                alt="CloudTickets Icon 1"
                className="brand-logo"
              />
              <div>
                <div className="brand-title">CloudTickets</div>
                <div className="brand-sub">Control de acceso inteligente</div>
              </div>
            </div>

            <div className="auth-bullets">
              <div className="auth-bullet">• Venta y asignación de tickets</div>
              <div className="auth-bullet">• Validación NFC/QR offline-local</div>
              <div className="auth-bullet">• Compartir ticket para acceso</div>
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
                    disabled={submitting}
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
                    disabled={submitting}
                  />
                </div>
              </label>

              {retryMessage ? <div className="alert">{retryMessage}</div> : null}
              {error ? <div className="alert error">{error}</div> : null}

              <div className="row between wrap">
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Entrando...' : 'Entrar'}
                </button>
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
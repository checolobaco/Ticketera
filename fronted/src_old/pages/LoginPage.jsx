import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

export default function LoginPage({ setUser }) {
  const [email, setEmail] = useState('admin@example.com')
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
      setUser(user)
      navigate('/events', { replace: true })
    } catch (err) {
      console.error(err)
      setError('Credenciales inválidas o error de servidor')
    }
  }

  return (
    <div className="login-narrow">
      <h1 className="app-title">Login</h1>
      <div className="app-subtitle">Accede para administrar eventos y tickets.</div>

      <form onSubmit={handleSubmit} className="stack-md">
        <div className="stack-sm">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </div>

        <div className="stack-sm">
          <label>Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        {error ? <div style={{ color: 'crimson' }}>{error}</div> : null}

        <div className="row centered wrap" style={{ justifyContent: 'space-between' }}>
          <button type="submit" className="btn-primary">Entrar</button>
          <div className="badge">Local • NFC/QR</div>
        </div>
      </form>
    </div>
  )
}

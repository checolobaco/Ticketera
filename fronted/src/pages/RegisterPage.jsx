import React, { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import api from "../api"

export default function RegisterPage({ setUser }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: "", email: "", password: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [showPassword, setShowPassword] = useState(false)

  const onChange = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    const name = form.name.trim()
    const email = form.email.trim().toLowerCase()
    const password = form.password

    if (!name || !email || !password) {
      setError("Completa nombre, email y contraseña")
      return
    }
    if (password.length < 6) {
      setError("La contraseña debe tener mínimo 6 caracteres")
      return
    }

    setLoading(true)
    try {
      const res = await api.post("/api/auth/register", { name, email, password })
      const { token, user } = res.data

      localStorage.setItem("token", token)
      localStorage.setItem("user", JSON.stringify(user))
      setUser(user)

      navigate("/events", { replace: true })
    } catch (err) {
      console.error(err)
      const code = err?.response?.data?.error
      if (code === "EMAIL_IN_USE") setError("Ese correo ya está registrado")
      else setError("No se pudo registrar. Verifica tus datos.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="stack-md">
      <div className="stack-sm">
        <h2 style={{ margin: 0 }}>Crear cuenta</h2>
        <p className="app-subtitle" style={{ margin: 0 }}>
          Regístrate para comprar y gestionar tus tickets.
        </p>
      </div>

      <form onSubmit={onSubmit} className="stack-md">
        <div className="stack-sm">
          <label>Nombre</label>
          <input
            value={form.name}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="Ej: Juan Pérez"
            autoComplete="name"
          />
        </div>

        <div className="stack-sm">
          <label>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => onChange("email", e.target.value)}
            placeholder="ej: juan@email.com"
            autoComplete="email"
          />
        </div>

        <div className="stack-sm">
          <label>Contraseña</label>

          {/* contenedor para input + botón */}
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(e) => onChange("password", e.target.value)}
              placeholder="mínimo 6 caracteres"
              autoComplete="new-password"
              style={{ paddingRight: 46 }}
            />

            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              title={showPassword ? "Ocultar" : "Mostrar"}
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: 18,
                lineHeight: 1,
                padding: 6,
                color: "#6b7380",
              }}
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>
        </div>

        {error && <div style={{ color: "#ef4444", fontSize: 13 }}>{error}</div>}

        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? "Creando..." : "Crear cuenta"}
        </button>

        <div style={{ fontSize: 13, color: "#6b7380" }}>
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
        </div>
      </form>
    </div>
  )
}

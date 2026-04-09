import React, { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import api from "../api"

export default function RegisterPage({ setUser }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: "", email: "", password: "" })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({}) // Usaremos solo este objeto para errores
  const [showPassword, setShowPassword] = useState(false)

  const onChange = (k, v) => {
    setForm(prev => ({ ...prev, [k]: v }));
    // Limpiar error del campo específico al escribir
    if (errors[k]) {
      setErrors(prev => {
        const { [k]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const validate = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!form.name.trim()) newErrors.name = "El nombre es obligatorio";
    
    if (!form.email.trim()) {
      newErrors.email = "El correo es obligatorio";
    } else if (!emailRegex.test(form.email.trim())) {
      newErrors.email = "Ingresa un correo válido";
    }

    if (!form.password) {
      newErrors.password = "La contraseña es obligatoria";
    } else if (form.password.length < 6) {
      newErrors.password = "Mínimo 6 caracteres";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const onSubmit = async (e) => {
  e.preventDefault();
  if (!validate()) return;

  setLoading(true);
  try {
    const registerEventId = sessionStorage.getItem('registerEventId');

    const payload = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
      ...(registerEventId ? { eventId: Number(registerEventId) } : {})
    };

    const res = await api.post("/api/auth/register", payload);
    const { token, user } = res.data;

    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    setUser(user);

    const postLoginRedirect = sessionStorage.getItem('postLoginRedirect');
    const postLoginEventId = sessionStorage.getItem('postLoginEventId');
    const postLoginShareSlug = sessionStorage.getItem('postLoginShareSlug');

    if (postLoginRedirect) {
      sessionStorage.removeItem('registerEventId');
      sessionStorage.removeItem('postLoginRedirect');
      sessionStorage.removeItem('postLoginEventId');
      sessionStorage.removeItem('postLoginShareSlug');

      navigate(postLoginRedirect, { replace: true });
      return;
    }

    if (postLoginShareSlug) {
      sessionStorage.removeItem('registerEventId');
      sessionStorage.removeItem('postLoginRedirect');
      sessionStorage.removeItem('postLoginEventId');
      sessionStorage.removeItem('postLoginShareSlug');

      navigate(`/e/${postLoginShareSlug}`, { replace: true });
      return;
    }

    navigate("/events", { replace: true });
  } catch (err) {
    console.error(err);
    const code = err?.response?.data?.error;
    if (code === "EMAIL_IN_USE") {
      setErrors({ email: "Este correo ya está registrado" });
    } else {
      setErrors({ general: "No se pudo registrar. Intenta de nuevo." });
    }
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="stack-md">
      <div className="stack-sm">
        <h2 style={{ margin: 0 }}>Crear cuenta</h2>
        <p className="app-subtitle" style={{ margin: 0 }}>
          Regístrate para comprar y gestionar tus tickets.
        </p>
      </div>

      <form onSubmit={onSubmit} className="stack-md">
        {/* NOMBRE */}
        <div className="stack-sm">
          <label>Nombre</label>
          <input
            value={form.name}
            onChange={(e) => onChange("name", e.target.value)} 
            placeholder="Ej: Juan Pérez"
            style={{ 
              border: errors.name ? '2px solid #ef4444' : '1px solid #ccc',
              width: '100%',
              padding: '8px'
            }}
          />
          {errors.name && <span style={{ color: '#ef4444', fontSize: 12 }}>{errors.name}</span>}
        </div>
        
        {/* EMAIL */}
        <div className="stack-sm">
          <label>Email</label>
          <input
            type="email"
            inputMode="email"
            value={form.email}
            onChange={(e) => onChange("email", e.target.value)}
            placeholder="ej: juan@email.com"
            autoComplete="email"
            style={{ 
              border: errors.email ? '2px solid #ef4444' : '1px solid #ccc',
              width: '100%',
              padding: '8px'
            }}
          />
          {errors.email && <span style={{ color: '#ef4444', fontSize: 12 }}>{errors.email}</span>}
        </div>

        {/* CONTRASEÑA */}
        <div className="stack-sm">
          <label>Contraseña</label>
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(e) => onChange("password", e.target.value)}
              placeholder="mínimo 6 caracteres"
              autoComplete="new-password"
              style={{ 
                border: errors.password ? '2px solid #ef4444' : '1px solid #ccc',
                paddingRight: 46,
                width: '100%',
                padding: '8px'
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              style={{
                position: "absolute",
                right: 5,
                top: "50%",
                transform: "translateY(-50%)",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: 18,
                padding: 6,
              }}
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>
          {errors.password && <span style={{ color: '#ef4444', fontSize: 12 }}>{errors.password}</span>}
        </div>

        {/* ERROR GENERAL */}
        {errors.general && <div style={{ color: "#ef4444", fontSize: 13, textAlign: 'center' }}>{errors.general}</div>}

        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? "Creando..." : "Crear cuenta"}
        </button>

        <div style={{ fontSize: 13, color: "#6b7380", textAlign: 'center' }}>
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
        </div>
      </form>
    </div>
  )
}
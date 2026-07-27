import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { getErrorMessage } from '../utils/errorMessages';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim()) {
      setError('Por favor ingresa tu correo electrónico.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccessMessage(null);

      const res = await api.post('/api/auth/forgot-password', { email });

      setSuccessMessage(
        res.data?.message ||
        'Si el correo electrónico está registrado, recibirás un enlace con las instrucciones en tu bandeja de entrada.'
      );
      setEmail('');
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err?.response?.data?.error || err?.response?.data?.message || 'No se pudo enviar la solicitud. Intenta de nuevo.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-left">
          <div className="auth-left-inner">
            <div className="auth-brand">
              <img
                src="https://cdn.cloud-tickets.com/Icon_1.jpg"
                alt="CloudTickets Icon"
                className="brand-logo"
              />
              <div>
                <div className="brand-title">CloudTickets</div>
                <div className="brand-sub">Recuperación de Acceso</div>
              </div>
            </div>

            <div className="auth-bullets">
              <div className="auth-bullet">• Seguridad garantizada</div>
              <div className="auth-bullet">• Enlace válido por 1 hora</div>
              <div className="auth-bullet">• Acceso rápido a tus entradas</div>
            </div>
          </div>
        </div>

        <div className="auth-right">
          <div className="auth-right-inner">
            <div className="auth-header">
              <div>
                <h1 className="app-title">Recuperar contraseña</h1>
                <p className="app-subtitle">Ingresa tu email registrado para recibir el enlace de restauración.</p>
              </div>
            </div>

            {successMessage ? (
              <div className="stack-md" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: 20, borderRadius: 12, color: '#166534' }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>¡Solicitud enviada! 📬</div>
                <div style={{ fontSize: 14, lineHeight: 1.5 }}>{successMessage}</div>
                <div style={{ marginTop: 12 }}>
                  <Link to="/login" className="btn-primary" style={{ display: 'inline-block', textAlign: 'center', width: '100%' }}>
                    Volver a Iniciar Sesión
                  </Link>
                </div>
              </div>
            ) : (
              <form className="stack-md" onSubmit={handleSubmit}>
                <label className="field">
                  <span className="label">Correo Electrónico</span>
                  <div className="input-icon">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu-correo@example.com"
                      autoComplete="email"
                      disabled={submitting}
                      required
                    />
                  </div>
                </label>

                {error ? <div className="alert error">{error}</div> : null}

                <div className="row between wrap" style={{ marginTop: 10 }}>
                  <button type="submit" className="btn-primary" disabled={submitting} style={{ width: '100%' }}>
                    {submitting ? 'Enviando enlace...' : 'Enviar enlace de recuperación'}
                  </button>
                </div>

                <div style={{ fontSize: 14, color: '#6b7280', marginTop: 16, textAlign: 'center' }}>
                  ¿Recordaste tu contraseña? <Link to="/login" style={{ fontWeight: 600, color: '#2563eb' }}>Iniciar sesión</Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

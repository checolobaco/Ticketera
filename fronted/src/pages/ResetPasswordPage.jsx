import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { getErrorMessage } from '../utils/errorMessages';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      setError('Enlace inválido o incompleto. Por favor solicita uno nuevo.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccessMessage(null);

      const res = await api.post('/api/auth/reset-password', {
        token,
        newPassword
      });

      setSuccessMessage(res.data?.message || '¡Contraseña restablecida con éxito!');
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err?.response?.data?.error || err?.response?.data?.message || 'No se pudo restablecer la contraseña. El enlace pudo haber expirado.'));
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
                <div className="brand-sub">Nueva Contraseña</div>
              </div>
            </div>

            <div className="auth-bullets">
              <div className="auth-bullet">• Crea una clave segura</div>
              <div className="auth-bullet">• Mínimo 6 caracteres</div>
              <div className="auth-bullet">• Acceso inmediato a tus compras</div>
            </div>
          </div>
        </div>

        <div className="auth-right">
          <div className="auth-right-inner">
            <div className="auth-header">
              <div>
                <h1 className="app-title">Crear nueva contraseña</h1>
                <p className="app-subtitle">{email ? `Para la cuenta: ${email}` : 'Ingresa tu nueva clave de acceso.'}</p>
              </div>
            </div>

            {successMessage ? (
              <div className="stack-md" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: 20, borderRadius: 12, color: '#166534' }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>¡Contraseña actualizada! 🎉</div>
                <div style={{ fontSize: 14, lineHeight: 1.5, marginTop: 6 }}>{successMessage}</div>
                <div style={{ marginTop: 16 }}>
                  <button
                    onClick={() => navigate('/login', { replace: true })}
                    className="btn-primary"
                    style={{ width: '100%', cursor: 'pointer' }}
                  >
                    Iniciar Sesión Ahora
                  </button>
                </div>
              </div>
            ) : !token ? (
              <div className="stack-md" style={{ background: '#FFF5F5', border: '1px solid #FECACA', padding: 20, borderRadius: 12, color: '#B91C1C' }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Enlace no válido</div>
                <div style={{ fontSize: 14, marginTop: 4 }}>
                  No se encontró ningún token de recuperación en este enlace. Por favor solicita un nuevo correo.
                </div>
                <div style={{ marginTop: 14 }}>
                  <Link to="/forgot-password" className="btn-primary" style={{ display: 'inline-block', textAlign: 'center', width: '100%' }}>
                    Solicitar nuevo enlace
                  </Link>
                </div>
              </div>
            ) : (
              <form className="stack-md" onSubmit={handleSubmit}>
                <label className="field">
                  <span className="label">Nueva Contraseña</span>
                  <div className="input-icon" style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      autoComplete="new-password"
                      disabled={submitting}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(prev => !prev)}
                      style={{
                        position: 'absolute',
                        right: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        fontSize: 14
                      }}
                    >
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </label>

                <label className="field">
                  <span className="label">Confirmar Nueva Contraseña</span>
                  <div className="input-icon">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repite la contraseña"
                      autoComplete="new-password"
                      disabled={submitting}
                      required
                    />
                  </div>
                </label>

                {error ? <div className="alert error">{error}</div> : null}

                <div className="row between wrap" style={{ marginTop: 10 }}>
                  <button type="submit" className="btn-primary" disabled={submitting} style={{ width: '100%' }}>
                    {submitting ? 'Guardando nueva contraseña...' : 'Restablecer contraseña'}
                  </button>
                </div>

                <div style={{ fontSize: 14, color: '#6b7280', marginTop: 16, textAlign: 'center' }}>
                  <Link to="/login" style={{ color: '#2563eb' }}>Volver al inicio de sesión</Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

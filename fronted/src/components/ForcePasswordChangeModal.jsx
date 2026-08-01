import React, { useState } from 'react';
import api from '../api';

export default function ForcePasswordChangeModal({ user, onPasswordChanged }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  if (!user || !user.must_change_password) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const cleanNew = String(newPassword || '').trim();
    const cleanConfirm = String(confirmPassword || '').trim();

    if (!cleanNew) {
      setError('Por favor ingresa la nueva contraseña.');
      return;
    }

    if (cleanNew.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (cleanNew === '1234' || cleanNew === '12345' || cleanNew === '123456' || cleanNew === '12345678') {
      setError('La contraseña ingresada es demasiado sencilla. Elige una más segura.');
      return;
    }

    if (cleanNew !== cleanConfirm) {
      setError('Las contraseñas no coinciden. Verifícalas nuevamente.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('/api/auth/change-password', {
        newPassword: cleanNew
      });

      const updatedUser = {
        ...user,
        ...(res.data?.user || {}),
        must_change_password: false
      };

      localStorage.setItem('user', JSON.stringify(updatedUser));
      setSuccess(true);

      setTimeout(() => {
        if (onPasswordChanged) {
          onPasswordChanged(updatedUser);
        }
      }, 1000);
    } catch (err) {
      console.error('Error cambiando contraseña obligatoria:', err);
      const backendMsg = err?.response?.data?.message || err?.response?.data?.error;
      setError(backendMsg || 'No se pudo actualizar la contraseña. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div
        className="app-card"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '32px 28px',
          borderRadius: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          background: '#ffffff',
          border: '1px solid #e2e8f0'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#fef3c7',
              color: '#d97706',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              marginBottom: '12px'
            }}
          >
            🔒
          </div>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>
            Cambio de Contraseña Obligatorio
          </h2>
          <p style={{ margin: 0, fontSize: '14px', color: '#64748b', lineHeight: 1.5 }}>
            Detectamos que tu cuenta ingresó con una contraseña temporal o muy sencilla (ej: <strong>1234</strong>). Por seguridad, debes crear una nueva contraseña para continuar.
          </p>
        </div>

        {error && (
          <div
            style={{
              marginBottom: '16px',
              padding: '12px 14px',
              borderRadius: '12px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: '13px',
              lineHeight: 1.4
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div
            style={{
              marginBottom: '16px',
              padding: '12px 14px',
              borderRadius: '12px',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              color: '#166534',
              fontSize: '14px',
              fontWeight: 600,
              textAlign: 'center'
            }}
          >
            ✅ ¡Contraseña actualizada con éxito! Redirigiendo...
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Nueva Contraseña
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Escribe tu nueva contraseña segura"
              required
              disabled={loading || success}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Confirmar Nueva Contraseña
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirma la nueva contraseña"
              required
              disabled={loading || success}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                fontSize: '14px'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="btn-primary"
            style={{
              width: '100%',
              justifyContent: 'center',
              height: '46px',
              fontSize: '15px',
              fontWeight: 700,
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)'
            }}
          >
            {loading ? 'Guardando contraseña...' : 'Actualizar Contraseña y Continuar ➔'}
          </button>
        </form>
      </div>
    </div>
  );
}

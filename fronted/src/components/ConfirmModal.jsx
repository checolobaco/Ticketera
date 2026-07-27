/**
 * ConfirmModal.jsx - UX4: Modal reutilizable para confirmación de acciones administrativas críticas
 */

import React from 'react';

export default function ConfirmModal({
  isOpen,
  title = '¿Confirmar Acción?',
  message = '¿Estás seguro de que deseas realizar esta acción?',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  isDanger = false,
  isLoading = false,
  onConfirm,
  onCancel
}) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      backdropFilter: 'blur(4px)',
      padding: '16px'
    }}>
      <div style={{
        background: '#0F172A',
        color: '#FFFFFF',
        borderRadius: '16px',
        maxWidth: '440px',
        width: '100%',
        padding: '24px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        border: '1px solid #1E293B',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '20px', fontWeight: 700, color: isDanger ? '#EF4444' : '#F8FAFC' }}>
          {title}
        </h3>
        <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#94A3B8', lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            disabled={isLoading}
            onClick={onCancel}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: '1px solid #334155',
              background: '#1E293B',
              color: '#CBD5E1',
              fontWeight: 600,
              fontSize: '14px',
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: 'none',
              background: isDanger ? '#DC2626' : '#2563EB',
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: '14px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1
            }}
          >
            {isLoading ? 'Procesando...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

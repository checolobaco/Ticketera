import React, { useState } from 'react';
import { publicApi } from '../api';

export default function EventQuoteForm() {
  const [form, setForm] = useState({
    organizerName: '',
    organizerEmail: '',
    organizerPhone: '',
    eventType: 'CONCIERTO',
    estimatedCapacity: 500,
    estimatedTicketPrice: 50000,
    targetDate: '',
    city: '',
    services: ['ONLINE_TICKETS', 'QR_ACCESS_CONTROL'],
    comments: ''
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  const availableServices = [
    { id: 'ONLINE_TICKETS', label: '💳 Venta de Boletas Online (Wompi)' },
    { id: 'QR_ACCESS_CONTROL', label: '📱 Control de Acceso QR en Puerta' },
    { id: 'POS_BOXOFFICE', label: '💰 Taquilla Física POS en Efectivo' },
    { id: 'WRISTBANDS_NFC', label: '🎟️ Manillas / Impresión de Tickets' },
    { id: 'STAFF_SUPPORT', label: '👥 Personal de Apoyo e Ingreso' }
  ];

  const handleServiceToggle = (serviceId) => {
    setForm(prev => {
      const exists = prev.services.includes(serviceId);
      const nextServices = exists
        ? prev.services.filter(s => s !== serviceId)
        : [...prev.services, serviceId];
      return { ...prev, services: nextServices };
    });
  };

  const calculatedRevenue = (form.estimatedCapacity || 0) * (form.estimatedTicketPrice || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(null);
    setError(null);

    if (!form.organizerName || !form.organizerEmail) {
      setError('Por favor ingresa tu nombre y correo electrónico.');
      setLoading(false);
      return;
    }

    try {
      const servicesList = availableServices
        .filter(s => form.services.includes(s.id))
        .map(s => s.label)
        .join('\n  - ');

      const formattedMessage = `
🎪 NUEVA COTIZACIÓN DE EVENTO REQUERIDA:
------------------------------------------
• Organizador / Empresa: ${form.organizerName}
• Correo de contacto: ${form.organizerEmail}
• Teléfono / WhatsApp: ${form.organizerPhone || 'No proporcionado'}
• Ciudad del Evento: ${form.city || 'No especificada'}
• Tipo de Evento: ${form.eventType || 'CONCIERTO'}
• Fecha Estimada: ${form.targetDate || 'No especificada'}
• Aforo Estimado: ${form.estimatedCapacity} personas
• Precio Ticket Promedio: $${Number(form.estimatedTicketPrice).toLocaleString('es-CO')} COP
• Recaudo Proyectado: $${calculatedRevenue.toLocaleString('es-CO')} COP

🛠️ SERVICIOS REQUERIDOS:
  - ${servicesList || 'Ninguno seleccionado'}

📝 COMENTARIOS ADICIONALES:
${form.comments || 'Sin comentarios adicionales.'}
      `.trim();

      const payload = {
        category: 'VENTAS',
        name: form.organizerName,
        email: form.organizerEmail,
        phone: form.organizerPhone || '',
        message: formattedMessage,
        clientMetadata: {
          type: 'EVENT_QUOTE',
          screenResolution: typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : '',
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: typeof navigator !== 'undefined' ? (navigator.language || 'es-CO') : 'es-CO',
          platform: typeof navigator !== 'undefined' ? navigator.platform : ''
        }
      };

      const res = await publicApi.post('/api/support/contact', payload);
      setSuccess(res.data?.message || '¡Cotización enviada con éxito! Un asesor comercial se pondrá en contacto contigo.');
      setForm({
        organizerName: '',
        organizerEmail: '',
        organizerPhone: '',
        eventType: 'CONCIERTO',
        estimatedCapacity: 500,
        estimatedTicketPrice: 50000,
        targetDate: '',
        city: '',
        services: ['ONLINE_TICKETS', 'QR_ACCESS_CONTROL'],
        comments: ''
      });
    } catch (err) {
      console.error('Error enviando cotización:', err);
      const msg = err?.response?.data?.message || err?.response?.data?.error || 'No se pudo enviar la cotización. Por favor verifica tu conexión o intenta más tarde.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '24px', border: '1px solid #E5E7EB', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 'bold', margin: '0 0 8px 0', color: '#111827' }}>
          🎪 Cotiza tu Evento con Nosotros
        </h2>
        <p style={{ color: '#6B7280', fontSize: 15, margin: 0 }}>
          Vende boletería, controla accesos en puerta y gestiona tu evento de forma 100% segura y automatizada.
        </p>
      </div>

      {success && (
        <div style={{ background: '#D1FAE5', border: '1px solid #10B981', color: '#065F46', padding: 14, borderRadius: 10, marginBottom: 20, textAlign: 'center', fontWeight: 'bold' }}>
          {success}
        </div>
      )}

      {error && (
        <div style={{ background: '#FEE2E2', border: '1px solid #EF4444', color: '#991B1B', padding: 14, borderRadius: 10, marginBottom: 20, textAlign: 'center' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="stack-md">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
              Nombre del Organizador / Empresa *
            </label>
            <input
              type="text"
              required
              value={form.organizerName}
              onChange={e => setForm({ ...form, organizerName: e.target.value })}
              placeholder="Ej: Producciones VIP"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
              Correo Electrónico *
            </label>
            <input
              type="email"
              required
              value={form.organizerEmail}
              onChange={e => setForm({ ...form, organizerEmail: e.target.value })}
              placeholder="contacto@tuevento.com"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
              Teléfono / WhatsApp
            </label>
            <input
              type="tel"
              value={form.organizerPhone}
              onChange={e => setForm({ ...form, organizerPhone: e.target.value })}
              placeholder="Ej: +57 300 123 4567"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
              Ciudad del Evento
            </label>
            <input
              type="text"
              value={form.city}
              onChange={e => setForm({ ...form, city: e.target.value })}
              placeholder="Ej: Medellín, Bogotá, Cali..."
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 12 }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
              Tipo de Evento
            </label>
            <select
              value={form.eventType}
              onChange={e => setForm({ ...form, eventType: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', boxSizing: 'border-box', background: '#FFF' }}
            >
              <option value="CONCIERTO">🎵 Concierto / Show en Vivo</option>
              <option value="FIESTA">🍸 Fiesta / Discoteca / Club</option>
              <option value="TEATRO">🎭 Teatro / Arte / Cultura</option>
              <option value="CONFERENCIA">🎓 Conferencia / Seminario</option>
              <option value="DEPORTES">⚽ Evento Deportivo</option>
              <option value="OTRO">✨ Otro tipo de evento</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
              Fecha Estimada
            </label>
            <input
              type="date"
              value={form.targetDate}
              onChange={e => setForm({ ...form, targetDate: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {/* 🧮 Calculadora de Recaudo en Tiempo Real */}
        <div style={{ background: '#F8FAFC', padding: 16, borderRadius: 12, border: '1px solid #E2E8F0', marginTop: 16 }}>
          <div style={{ fontWeight: 'bold', color: '#1E293B', marginBottom: 12 }}>
            🧮 Calculadora Estimada de Recaudo
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#475569', marginBottom: 4 }}>
                Aforo Estimado: <strong>{form.estimatedCapacity} personas</strong>
              </label>
              <input
                type="range"
                min="50"
                max="10000"
                step="50"
                value={form.estimatedCapacity}
                onChange={e => setForm({ ...form, estimatedCapacity: Number(e.target.value) })}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#475569', marginBottom: 4 }}>
                Precio Promedio Ticket: <strong>${Number(form.estimatedTicketPrice).toLocaleString('es-CO')} COP</strong>
              </label>
              <input
                type="range"
                min="10000"
                max="500000"
                step="5000"
                value={form.estimatedTicketPrice}
                onChange={e => setForm({ ...form, estimatedTicketPrice: Number(e.target.value) })}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>
          </div>
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px stroke #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#64748B' }}>Recaudo Bruto Proyectado:</span>
            <span style={{ fontSize: 18, fontWeight: 'bold', color: '#2563EB' }}>
              ${calculatedRevenue.toLocaleString('es-CO')} COP
            </span>
          </div>
        </div>

        {/* 🛠️ Selección de Servicios */}
        <div style={{ marginTop: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 10, fontSize: 14 }}>
            Servicios que necesitas:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            {availableServices.map(srv => {
              const active = form.services.includes(srv.id);
              return (
                <div
                  key={srv.id}
                  onClick={() => handleServiceToggle(srv.id)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: `1px solid ${active ? '#3B82F6' : '#E5E7EB'}`,
                    background: active ? '#EFF6FF' : '#FFF',
                    color: active ? '#1D4ED8' : '#374151',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 500,
                    transition: 'all 0.2s ease',
                    userSelect: 'none'
                  }}
                >
                  {srv.label}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
            Comentarios o requerimientos adicionales
          </label>
          <textarea
            rows={3}
            value={form.comments}
            onChange={e => setForm({ ...form, comments: e.target.value })}
            placeholder="Cuéntanos más detalles sobre tu evento..."
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', boxSizing: 'border-box' }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary"
          style={{
            width: '100%',
            padding: '14px',
            fontSize: 16,
            marginTop: 12,
            background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
            cursor: loading ? 'wait' : 'pointer'
          }}
        >
          {loading ? 'Enviando cotización...' : '🚀 Enviar Cotización Gratis'}
        </button>
      </form>
    </div>
  );
}

import React, { useState } from 'react';
import { publicApi } from '../api';

export default function AdRequestForm() {
  const [form, setForm] = useState({
    advertiserName: '',
    advertiserEmail: '',
    advertiserPhone: '',
    adType: 'BANNER_HOME',
    budgetRange: '$500.000 - $1.500.000 COP',
    message: ''
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(null);
    setError(null);

    if (!form.advertiserName || !form.advertiserEmail) {
      setError('Por favor ingresa tu nombre o el de tu marca y tu correo.');
      setLoading(false);
      return;
    }

    try {
      const formattedMessage = `
📢 NUEVA SOLICITUD DE ESPACIO PUBLICITARIO / ANUNCIO:
--------------------------------------------------
• Marca / Empresa: ${form.advertiserName}
• Correo de contacto: ${form.advertiserEmail}
• Teléfono / WhatsApp: ${form.advertiserPhone || 'No proporcionado'}
• Espacio Publicitario Deseado: ${form.adType}
• Presupuesto Estimado: ${form.budgetRange}

📝 DETALLES DE LA PROPUESTA:
${form.message || 'Sin detalles adicionales.'}
      `.trim();

      const payload = {
        category: 'VENTAS',
        name: form.advertiserName,
        email: form.advertiserEmail,
        phone: form.advertiserPhone || '',
        message: formattedMessage,
        clientMetadata: {
          type: 'AD_REQUEST',
          screenResolution: typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : '',
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: typeof navigator !== 'undefined' ? (navigator.language || 'es-CO') : 'es-CO',
          platform: typeof navigator !== 'undefined' ? navigator.platform : ''
        }
      };

      const res = await publicApi.post('/api/support/contact', payload);
      setSuccess(res.data?.message || '¡Solicitud de anuncio enviada con éxito! Nos comunicaremos contigo a la brevedad.');
      setForm({
        advertiserName: '',
        advertiserEmail: '',
        advertiserPhone: '',
        adType: 'BANNER_HOME',
        budgetRange: '$500.000 - $1.500.000 COP',
        message: ''
      });
    } catch (err) {
      console.error('Error enviando solicitud de anuncio:', err);
      const msg = err?.response?.data?.message || err?.response?.data?.error || 'Error enviando la solicitud. Por favor intenta más tarde.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '24px', border: '1px solid #E5E7EB', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 24, fontWeight: 'bold', margin: '0 0 8px 0', color: '#111827' }}>
          📢 Publica tu Anuncio o Patrocinio
        </h2>
        <p style={{ color: '#6B7280', fontSize: 15, margin: 0 }}>
          Llega a miles de asistentes a eventos en tu ciudad. Promociona tu marca en nuestros canales oficiales.
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
              Nombre de tu Marca / Empresa *
            </label>
            <input
              type="text"
              required
              value={form.advertiserName}
              onChange={e => setForm({ ...form, advertiserName: e.target.value })}
              placeholder="Ej: Red Bull / Heineken"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
              Correo de Contacto *
            </label>
            <input
              type="email"
              required
              value={form.advertiserEmail}
              onChange={e => setForm({ ...form, advertiserEmail: e.target.value })}
              placeholder="marketing@marca.com"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
              Teléfono / WhatsApp
            </label>
            <input
              type="tel"
              value={form.advertiserPhone}
              onChange={e => setForm({ ...form, advertiserPhone: e.target.value })}
              placeholder="Ej: +57 300 000 0000"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 12 }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
              Espacio Publicitario deseado
            </label>
            <select
              value={form.adType}
              onChange={e => setForm({ ...form, adType: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', boxSizing: 'border-box', background: '#FFF' }}
            >
              <option value="BANNER_HOME">🖼️ Banner Principal en Inicio</option>
              <option value="FEATURED_EVENT">⭐ Destacar mi Evento en Portada</option>
              <option value="TICKET_PDF_AD">📄 Publicidad en Boletos PDF</option>
              <option value="WHATSAPP_CAMPAIGN">📱 Campaña de Notificación WhatsApp</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
              Presupuesto Aproximado
            </label>
            <select
              value={form.budgetRange}
              onChange={e => setForm({ ...form, budgetRange: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', boxSizing: 'border-box', background: '#FFF' }}
            >
              <option value="$200.000 - $500.000 COP">$200.000 - $500.000 COP</option>
              <option value="$500.000 - $1.500.000 COP">$500.000 - $1.500.000 COP</option>
              <option value="$1.500.000 - $5.000.000 COP">$1.500.000 - $5.000.000 COP</option>
              <option value="+$5.000.000 COP">+$5.000.000 COP</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
            Detalles de tu propuesta publicitaria
          </label>
          <textarea
            rows={3}
            value={form.message}
            onChange={e => setForm({ ...form, message: e.target.value })}
            placeholder="Describe qué buscas lograr con la pauta..."
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
            background: 'linear-gradient(135deg, #10B981, #059669)',
            borderColor: '#10B981',
            cursor: loading ? 'wait' : 'pointer'
          }}
        >
          {loading ? 'Enviando solicitud...' : '📣 Solicitar Espacio Publicitario'}
        </button>
      </form>
    </div>
  );
}

import React, { useState } from 'react';
import QRCode from 'react-qr-code';
import QRCodeLib from 'qrcode';
import { Link } from 'react-router-dom';

export default function ContactPage() {
  const [downloading, setDownloading] = useState(false);

  // URL directa de la opción de contacto
  const contactUrl = `${window.location.origin}/contact?contact=true`;

  const downloadQRCode = async () => {
    try {
      setDownloading(true);
      const dataUrl = await QRCodeLib.toDataURL(contactUrl, {
        width: 800,
        margin: 2,
        color: {
          dark: '#0F172A',
          light: '#FFFFFF'
        }
      });

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `QR_Contacto_Ventas_CloudTickets.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
      alert('No se pudo generar la descarga del código QR.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '10px 15px' }}>
      <div className="app-card" style={{ padding: '30px', borderRadius: 20 }}>
        {/* Encabezado */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid #E5E7EB', paddingBottom: 24, marginBottom: 24, flexWrap: 'wrap' }}>
          <img
            src="https://cdn.cloud-tickets.com/CT_simbolo_G.jpg"
            alt="CloudTickets Logo"
            style={{ width: 56, height: 56, borderRadius: 14, objectFit: 'cover', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
          />
          <div style={{ flex: 1 }}>
            <h1 className="app-title" style={{ fontSize: 26, margin: 0, color: '#0F172A' }}>
              Contacto, Ventas y Atención
            </h1>
            <div style={{ fontSize: 13, color: '#64748B', marginTop: 4, fontWeight: 500 }}>
              Soluciones en boletería digital para organizadores de eventos y atención a clientes
            </div>
          </div>
        </div>

        <div className="stack-lg" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
          {/* Tarjetas de Áreas de Atención */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            <div className="ticket-card" style={{ padding: 20, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1E293B', marginTop: 0, marginBottom: 8 }}>
                💼 Ventas y Organización de Eventos
              </h2>
              <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, margin: 0 }}>
                ¿Quieres cotizar o vender boletas de tu concierto, fiesta o evento deportivo con QR y envío por WhatsApp? Escríbenos directamente desde el chat en vivo.
              </p>
            </div>

            <div className="ticket-card" style={{ padding: 20, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1E293B', marginTop: 0, marginBottom: 8 }}>
                🎟️ Soporte y Atención a Compradores
              </h2>
              <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, margin: 0 }}>
                ¿Necesitas ayuda con tus entradas, reenvío a tu correo o verificación de pago? Selecciona la opción de soporte en nuestro chat flotante.
              </p>
            </div>
          </div>

          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', padding: 16, borderRadius: 12, color: '#1E40AF', fontSize: 14 }}>
            💬 <strong>Chat en vivo:</strong> Puedes hacer clic en el botón azul de chat situado en la esquina inferior derecha para enviarnos tu consulta comercial o de soporte de inmediato.
          </div>

          {/* Tarjeta con Generación del Código QR para dirigir a Contacto/Ventas */}
          <div className="ticket-card" style={{ padding: 24, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, textAlign: 'center' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1E293B', marginTop: 0, marginBottom: 8 }}>
              📱 Código QR Directo de Contacto y Ventas
            </h2>
            <p style={{ fontSize: 14, color: '#64748B', marginBottom: 20 }}>
              Escanea o comparte este código QR para abrir directamente esta opción de contacto y cotización desde cualquier dispositivo.
            </p>

            <div
              style={{
                position: 'relative',
                width: 'fit-content',
                margin: '0 auto 20px auto',
                padding: 16,
                background: '#FFFFFF',
                borderRadius: 16,
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                border: '1px solid #E2E8F0'
              }}
            >
              <QRCode
                value={contactUrl}
                size={200}
                bgColor="#FFFFFF"
                fgColor="#0F172A"
                level="H"
              />
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 36,
                  height: 36,
                  background: '#FFFFFF',
                  borderRadius: 8,
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 1px 6px rgba(0,0,0,0.15)'
                }}
              >
                <img
                  src="https://cdn.cloud-tickets.com/CT_simbolo_G.jpg"
                  alt="Logo QR"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                className="btn-primary"
                onClick={downloadQRCode}
                disabled={downloading}
                style={{ padding: '10px 20px' }}
              >
                {downloading ? 'Generando descarga...' : '📥 Descargar Código QR'}
              </button>

              <Link to="/events" className="btn-primary" style={{ background: '#1E293B', padding: '10px 20px' }}>
                Volver a Eventos
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

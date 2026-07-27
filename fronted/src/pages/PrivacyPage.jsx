import React from 'react';
import { Link } from 'react-router-dom';

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '10px 15px' }}>
      <div className="app-card" style={{ padding: '30px', borderRadius: 20 }}>
        {/* Header de la Página */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid #E5E7EB', paddingBottom: 24, marginBottom: 24, flexWrap: 'wrap' }}>
          <img
            src="https://cdn.cloud-tickets.com/CT_simbolo_G.jpg"
            alt="CloudTickets Logo"
            style={{ width: 56, height: 56, borderRadius: 14, objectFit: 'cover', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
          />
          <div style={{ flex: 1 }}>
            <h1 className="app-title" style={{ fontSize: 26, margin: 0, color: '#0F172A' }}>
              Política de Privacidad de CloudTickets
            </h1>
            <div style={{ fontSize: 13, color: '#64748B', marginTop: 4, fontWeight: 500 }}>
              <strong>Última actualización:</strong> julio de 2026
            </div>
          </div>
        </div>

        {/* Introducción */}
        <div style={{ fontSize: 15, lineHeight: 1.7, color: '#334155', marginBottom: 24 }}>
          En <strong>CloudTickets</strong> nos tomamos muy en serio la privacidad y protección de los datos personales de nuestros usuarios. Esta Política de Privacidad describe cómo recopilamos, utilizamos, almacenamos y protegemos la información personal que nos proporcionas al utilizar nuestros servicios de compra de entradas, gestión de tickets y notificaciones a través de correo electrónico y WhatsApp.
        </div>

        {/* Sección 1 */}
        <div className="ticket-card" style={{ marginBottom: 20, padding: 20, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 14 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1E293B', marginTop: 0, marginBottom: 12 }}>
            1. Información que Recopilamos
          </h2>
          <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6 }}>
            Para procesar las compras de boletos y garantizar la entrega oportuna de las entradas digitales, recopilamos los siguientes datos personales:
          </p>
          <ul style={{ margin: '8px 0 0 20px', padding: 0, fontSize: 14, color: '#334155', lineHeight: 1.7 }}>
            <li>
              <strong>Datos de contacto e identificación:</strong> Nombre completo, dirección de correo electrónico, número de teléfono celular (incluyendo código de país) y documento de identidad.
            </li>
            <li>
              <strong>Información de transacciones:</strong> Detalles del evento, cantidad de boletos adquiridos, identificador de la orden e historial de compra (no almacenamos datos sensibles de tarjetas de crédito ni claves bancarias directamente).
            </li>
          </ul>
        </div>

        {/* Sección 2 */}
        <div className="ticket-card" style={{ marginBottom: 20, padding: 20, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 14 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1E293B', marginTop: 0, marginBottom: 12 }}>
            2. Uso de la Información y Finalidad del Tratamiento
          </h2>
          <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6 }}>
            Los datos personales recopilados se utilizan exclusivamente para los siguientes fines:
          </p>
          <ul style={{ margin: '8px 0 0 20px', padding: 0, fontSize: 14, color: '#334155', lineHeight: 1.7 }}>
            <li>Generación de las entradas digitales con código QR único.</li>
            <li>
              Envío de confirmaciones de compra, tickets en formato PDF y notificaciones del evento mediante correo electrónico y mensajes transaccionales a través de la <strong>WhatsApp Business API (Cloud API)</strong>.
            </li>
            <li>Verificación y validación de las entradas en los puntos de acceso del evento.</li>
            <li>Atención a consultas, soporte al cliente y resolución de peticiones sobre compras realizadas.</li>
          </ul>
        </div>

        {/* Sección 3 */}
        <div className="ticket-card" style={{ marginBottom: 20, padding: 20, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 14 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1E293B', marginTop: 0, marginBottom: 12 }}>
            3. Compartición de Datos con Terceros y Proveedores
          </h2>
          <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6 }}>
            No vendemos, alquilamos ni comercializamos los datos personales de nuestros usuarios con terceros bajo ninguna circunstancia. Únicamente compartimos la información estrictamente necesaria con proveedores tecnológicos encargados de la infraestructura de entrega:
          </p>
          <ul style={{ margin: '8px 0 0 20px', padding: 0, fontSize: 14, color: '#334155', lineHeight: 1.7 }}>
            <li>
              <strong>Meta Platforms, Inc. (WhatsApp Cloud API):</strong> Para procesar y entregar mensajes informativos y tickets en formato PDF al número de teléfono registrado por el usuario.
            </li>
            <li>
              <strong>Cloudflare R2:</strong> Para el almacenamiento seguro y la distribución de los archivos PDF comprimidos de los tickets.
            </li>
          </ul>
        </div>

        {/* Sección 4 */}
        <div className="ticket-card" style={{ marginBottom: 20, padding: 20, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 14 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1E293B', marginTop: 0, marginBottom: 12 }}>
            4. Seguridad de la Información
          </h2>
          <p style={{ fontSize: 14, color: '#334155', lineHeight: 1.7, margin: 0 }}>
            Implementamos medidas de seguridad técnicas, administrativas y físicas apropiadas para proteger los datos personales contra acceso no autorizado, pérdida, alteración o divulgación. Las comunicaciones enviadas mediante la API de WhatsApp utilizan cifrado de extremo a extremo y protocolos seguros HTTPS (TLS).
          </p>
        </div>

        {/* Sección 5 */}
        <div className="ticket-card" style={{ marginBottom: 20, padding: 20, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 14 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1E293B', marginTop: 0, marginBottom: 12 }}>
            5. Derechos del Usuario (ARCO)
          </h2>
          <p style={{ fontSize: 14, color: '#334155', lineHeight: 1.7 }}>
            Como titular de los datos personales, tienes derecho en cualquier momento a solicitar el acceso, rectificación, actualización o eliminación de tu información personal de nuestros registros.
          </p>
          <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, marginBottom: 6 }}>
            Para ejercer tus derechos de privacidad, puedes enviar una solicitud a nuestro equipo de soporte:
          </p>
          <ul style={{ margin: '4px 0 0 20px', padding: 0, fontSize: 14, color: '#334155', lineHeight: 1.7 }}>
            <li>
              <strong>Correo Electrónico:</strong> <a href="mailto:cloudticketts@gmail.com" style={{ color: '#2563EB', fontWeight: 600 }}>cloudticketts@gmail.com</a>
            </li>
            <li>
              <strong>Sitio Web:</strong> <a href="https://cloud-tickets.com" target="_blank" rel="noreferrer" style={{ color: '#2563EB', fontWeight: 600 }}>https://cloud-tickets.com</a>
            </li>
          </ul>
        </div>

        {/* Sección 6 */}
        <div className="ticket-card" style={{ marginBottom: 24, padding: 20, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 14 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1E293B', marginTop: 0, marginBottom: 12 }}>
            6. Modificaciones a esta Política
          </h2>
          <p style={{ fontSize: 14, color: '#334155', lineHeight: 1.7, margin: 0 }}>
            Nos reservamos el derecho de actualizar esta Política de Privacidad en cualquier momento para reflejar cambios en nuestros servicios o en la normativa legal aplicable. Cualquier modificación será publicada en nuestro sitio web.
          </p>
        </div>

        {/* Pie de Página y Enlaces */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20, borderTop: '1px solid #E5E7EB', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontSize: 13, color: '#94A3B8' }}>
            © 2026 CloudTickets. Todos los derechos reservados.
          </div>
          <div>
            <Link to="/" className="btn-primary" style={{ padding: '8px 18px', fontSize: 14 }}>
              Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

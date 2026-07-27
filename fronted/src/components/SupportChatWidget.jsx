import React, { useState, useEffect, useRef } from 'react';
import { publicApi } from '../api';
import { getErrorMessage } from '../utils/errorMessages';

export default function SupportChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState('VENTAS'); // VENTAS | SOPORTE | GENERAL
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: '¡Hola! 👋 Bienvenido a CloudTickets. ¿Deseas cotizar boletería para tu evento, información de ventas o ayuda con tus entradas? Déjanos tu mensaje y te responderemos a la brevedad.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const [name, setName] = useState('');
  const [contact, setContact] = useState(''); // Email or Phone
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [error, setError] = useState('');

  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Autodetect ?support=true o ?contact=true query parameter para abrir automáticamente
    if (window.location.search.includes('support=true') || window.location.search.includes('contact=true')) {
      setIsOpen(true);
    }

    // Autodatos de usuario autenticado
    try {
      const u = JSON.parse(localStorage.getItem('user') || 'null');
      if (u) {
        if (u.name) setName(u.name);
        if (u.email) setContact(u.email);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!text.trim()) return;

    const userText = text.trim();
    const userName = name.trim() || 'Usuario Anónimo';
    const userContact = contact.trim();

    // Determinar si es email o teléfono
    const isEmail = userContact.includes('@');
    const payload = {
      category: category,
      name: userName,
      email: isEmail ? userContact : '',
      phone: !isEmail ? userContact : '',
      message: userText,
      clientMetadata: {
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language || 'es-CO',
        platform: navigator.platform
      }
    };

    try {
      setSubmitting(true);
      setError('');

      // Agregar mensaje enviado al chat local
      const newMsgId = Date.now();
      setMessages(prev => [
        ...prev,
        {
          id: newMsgId,
          sender: 'user',
          text: `[${category === 'VENTAS' ? '💼 Ventas/Eventos' : category === 'SOPORTE' ? '🎟️ Soporte' : '💬 Consulta'}] ${userText}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);

      setText('');

      await publicApi.post('/api/support/contact', payload);

      setSentSuccess(true);

      // Respuesta de confirmación del bot
      setTimeout(() => {
        setMessages(prev => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'bot',
            text: `¡Gracias, ${userName}! ✅ Tu mensaje ha sido recibido por nuestro equipo de ${category === 'VENTAS' ? 'Ventas & Eventos' : 'Atención al Cliente'}. Te responderemos a la brevedad.`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }, 500);

    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err?.response?.data?.message || 'Error al enviar mensaje de contacto.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 99999, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Ventana flotante de Chat */}
      {isOpen && (
        <div
          style={{
            width: '90vw',
            maxWidth: 395,
            height: 540,
            maxHeight: '82vh',
            backgroundColor: '#ffffff',
            borderRadius: 20,
            boxShadow: '0 20px 40px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.08)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            marginBottom: 16,
            animation: 'fadeInUp 0.3s ease-out'
          }}
        >
          {/* Header del Chat */}
          <div
            style={{
              background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
              color: '#ffffff',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ position: 'relative' }}>
                <img
                  src="https://cdn.cloud-tickets.com/CT_simbolo_G.jpg"
                  alt="CloudTickets Contacto"
                  style={{ width: 38, height: 38, borderRadius: 10, objectFit: 'cover' }}
                />
                <span
                  style={{
                    position: 'absolute',
                    bottom: -2,
                    right: -2,
                    width: 10,
                    height: 10,
                    backgroundColor: '#22C55E',
                    border: '2px solid #0F172A',
                    borderRadius: '50%'
                  }}
                />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Contacto & Ventas</div>
                <div style={{ fontSize: 12, color: '#94A3B8' }}>CloudTickets • En línea</div>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              style={{
                border: 'none',
                background: 'rgba(255,255,255,0.15)',
                color: '#ffffff',
                width: 30,
                height: 30,
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ✕
            </button>
          </div>

          {/* Selector de Categoría (Ventas / Soporte / Consulta) */}
          <div style={{ display: 'flex', gap: 6, padding: '10px 14px', background: '#F1F5F9', borderBottom: '1px solid #E2E8F0' }}>
            <button
              type="button"
              onClick={() => setCategory('VENTAS')}
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 600,
                border: category === 'VENTAS' ? '1px solid #2563EB' : '1px solid #CBD5E1',
                background: category === 'VENTAS' ? '#2563EB' : '#FFFFFF',
                color: category === 'VENTAS' ? '#FFFFFF' : '#475569',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              💼 Ventas / Eventos
            </button>
            <button
              type="button"
              onClick={() => setCategory('SOPORTE')}
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 600,
                border: category === 'SOPORTE' ? '1px solid #2563EB' : '1px solid #CBD5E1',
                background: category === 'SOPORTE' ? '#2563EB' : '#FFFFFF',
                color: category === 'SOPORTE' ? '#FFFFFF' : '#475569',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              🎟️ Soporte Boletas
            </button>
            <button
              type="button"
              onClick={() => setCategory('GENERAL')}
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 600,
                border: category === 'GENERAL' ? '1px solid #2563EB' : '1px solid #CBD5E1',
                background: category === 'GENERAL' ? '#2563EB' : '#FFFFFF',
                color: category === 'GENERAL' ? '#FFFFFF' : '#475569',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              💬 General
            </button>
          </div>

          {/* Área de Mensajes */}
          <div
            style={{
              flex: 1,
              padding: 16,
              overflowY: 'auto',
              backgroundColor: '#F8FAFC',
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}
          >
            {messages.map(m => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%'
                }}
              >
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: m.sender === 'user' ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                    backgroundColor: m.sender === 'user' ? '#2563EB' : '#FFFFFF',
                    color: m.sender === 'user' ? '#FFFFFF' : '#1E293B',
                    boxShadow: m.sender === 'user' ? '0 2px 4px rgba(37,99,235,0.2)' : '0 1px 3px rgba(0,0,0,0.06)',
                    fontSize: 14,
                    lineHeight: 1.5,
                    border: m.sender === 'bot' ? '1px solid #E2E8F0' : 'none'
                  }}
                >
                  {m.text}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: '#94A3B8',
                    marginTop: 3,
                    textAlign: m.sender === 'user' ? 'right' : 'left',
                    padding: '0 4px'
                  }}
                >
                  {m.time}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Formulario de Entrada */}
          <form onSubmit={handleSendMessage} style={{ padding: 14, backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0' }}>
            {error ? (
              <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 8, padding: '4px 8px', background: '#FEE2E2', borderRadius: 6 }}>
                {error}
              </div>
            ) : null}

            {!sentSuccess && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <input
                  type="text"
                  placeholder="Tu nombre"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={submitting}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    fontSize: 12,
                    outline: 'none'
                  }}
                />
                <input
                  type="text"
                  placeholder="Correo o Teléfono (opcional)"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  disabled={submitting}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    fontSize: 12,
                    outline: 'none'
                  }}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder={category === 'VENTAS' ? 'Describe tu evento o requerimiento comercial...' : 'Escribe tu mensaje aquí...'}
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={submitting}
                required
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid #CBD5E1',
                  fontSize: 13,
                  outline: 'none'
                }}
              />
              <button
                type="submit"
                disabled={submitting || !text.trim()}
                style={{
                  backgroundColor: '#2563EB',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 10,
                  padding: '0 16px',
                  fontWeight: 700,
                  cursor: submitting || !text.trim() ? 'not-allowed' : 'pointer',
                  opacity: submitting || !text.trim() ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {submitting ? '...' : 'Enviar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Botón Flotante */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          width: 60,
          height: 60,
          borderRadius: '50%',
          backgroundColor: '#0F172A',
          color: '#ffffff',
          border: 'none',
          boxShadow: '0 8px 24px rgba(15,23,42,0.35)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 26,
          transition: 'transform 0.2s ease, background-color 0.2s ease',
          marginLeft: 'auto'
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        title="Contacto y Ventas"
      >
        {isOpen ? '✕' : '💬'}
      </button>
    </div>
  );
}

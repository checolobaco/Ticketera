import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import EventQuoteForm from '../components/EventQuoteForm';
import AdRequestForm from '../components/AdRequestForm';
// LandingPage.jsx

export default function LandingPage() {
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [activeTab, setActiveTab] = useState('CATALOG'); // CATALOG, QUOTE, AD
  const navigate = useNavigate();

  // Leer sesión de usuario si existe
  const currentUser = useMemo(() => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    async function loadEvents() {
      try {
        const res = await api.get('/api/events');
        const data = res.data;
        const list = Array.isArray(data) ? data :
                     Array.isArray(data?.events) ? data.events :
                     Array.isArray(data?.rows) ? data.rows : [];
        setEvents(list);
      } catch (err) {
        console.error('Error cargando catálogo de eventos:', err);
      } finally {
        setLoadingEvents(false);
      }
    }
    loadEvents();
  }, []);

  // Filtrar eventos por búsqueda
  const filteredEvents = useMemo(() => {
    return events.filter(ev => {
      const nameMatch = (ev.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (ev.description || '').toLowerCase().includes(searchTerm.toLowerCase());
      return nameMatch;
    });
  }, [events, searchTerm]);

  const scrollToSection = (id, tabName) => {
    if (tabName) setActiveTab(tabName);
    const targetId = (id === 'catalog-section' || id === 'catalogo') ? 'catalogo' : id;

    setTimeout(() => {
      const el = document.getElementById(targetId);
      if (el) {
        let totalTop = 0;
        let curr = el;
        while (curr) {
          totalTop += curr.offsetTop || 0;
          curr = curr.offsetParent;
        }
        const finalY = Math.max(0, totalTop - 80);

        try {
          window.scrollTo({
            top: finalY,
            behavior: 'smooth'
          });
        } catch {
          window.scrollTo(0, finalY);
        }
      }
    }, 20);
  };

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    scrollToSection('catalogo', 'CATALOG');
  };

  return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Estilos responsivos de la barra de navegación */}
      <style>{`
        html {
          scroll-behavior: smooth !important;
        }
        .landing-header-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 12px 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .mobile-auth-btn { display: flex; }
        .desktop-auth-btn { display: none; }

        @media (min-width: 768px) {
          .landing-header-inner {
            flex-direction: row !important;
            justify-content: space-between !important;
            align-items: center !important;
            gap: 20px !important;
          }
          .mobile-auth-btn { display: none !important; }
          .desktop-auth-btn { display: flex !important; }
          .landing-nav-pills {
            justify-content: center !important;
            overflow-x: visible !important;
          }
        }
      `}</style>

      {/* ── 1. Navbar Público ── */}
      <header style={{
        background: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
      }}>
        <div className="landing-header-inner">
          
          {/* Logo Brand Oficial & Botón Móvil */}
          <div style={{
            display: 'flex',
            justify: 'space-between',
            alignItems: 'center',
            width: '100%',
            maxWidth: '100%'
          }} className="landing-brand-row">
            <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
              <img
                src="https://cdn.cloud-tickets.com/CT_simbolo_G.jpg"
                alt="CloudTickets Logo"
                style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'contain' }}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'https://cdn.cloud-tickets.com/Icon_1.jpg';
                }}
              />
              <div>
                <div style={{ fontSize: 19, fontWeight: 900, color: '#0F172A', lineHeight: 1.1, letterSpacing: '-0.3px' }}>
                  CloudTickets
                </div>
                <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>
                  Potenciando Accesos • Conectando Experiencias
                </div>
              </div>
            </Link>

            {/* Botón Móvil (Solo se muestra en celular) */}
            <div className="mobile-auth-btn">
              {currentUser ? (
                <Link
                  to={currentUser.role === 'ADMIN' || currentUser.role === 'STAFF' ? '/admin' : '/my-tickets'}
                  className="btn-primary"
                  style={{
                    textDecoration: 'none',
                    padding: '8px 14px',
                    fontSize: 13,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    borderRadius: 20
                  }}
                >
                  {currentUser.role === 'ADMIN' ? '⚙️ Admin' : '👤 Cuenta'}
                </Link>
              ) : (
                <Link
                  to="/login"
                  style={{
                    background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
                    color: '#FFFFFF',
                    textDecoration: 'none',
                    padding: '8px 16px',
                    borderRadius: 20,
                    fontWeight: 700,
                    fontSize: 13,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
                  }}
                >
                  🔑 Iniciar Sesión
                </Link>
              )}
            </div>
          </div>

          {/* Enlaces de Navegación (Pills Deslizables en Móvil / Línea continua en Escritorio) */}
          <nav className="landing-nav-pills" style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            paddingBottom: 4,
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            alignItems: 'center'
          }}>
            {/* 1. Eventos */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('catalogo', 'CATALOG');
              }}
              style={{
                background: activeTab === 'CATALOG' ? '#2563EB' : '#F1F5F9',
                color: activeTab === 'CATALOG' ? '#FFFFFF' : '#475569',
                border: 'none',
                outline: 'none',
                padding: '8px 16px',
                borderRadius: 20,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              🎉 Eventos
            </button>

            {/* 2. Mis Tickets (Público directo) */}
            <Link
              to="/my-tickets"
              style={{
                background: '#F1F5F9',
                color: '#475569',
                textDecoration: 'none',
                padding: '8px 16px',
                borderRadius: 20,
                fontWeight: 600,
                fontSize: 13,
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              🎫 Mis Tickets
            </Link>

            {/* 3. Cotizar mi Evento */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('cotizar', 'QUOTE');
              }}
              style={{
                background: activeTab === 'QUOTE' ? '#2563EB' : '#F1F5F9',
                color: activeTab === 'QUOTE' ? '#FFFFFF' : '#475569',
                border: 'none',
                outline: 'none',
                padding: '8px 16px',
                borderRadius: 20,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              🎪 Cotizar mi Evento
            </button>

            {/* 4. Publicar Anuncio */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('anuncios', 'AD');
              }}
              style={{
                background: activeTab === 'AD' ? '#2563EB' : '#F1F5F9',
                color: activeTab === 'AD' ? '#FFFFFF' : '#475569',
                border: 'none',
                outline: 'none',
                padding: '8px 16px',
                borderRadius: 20,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              📢 Publicar Anuncio
            </button>
          </nav>

          {/* Botón Escritorio (Se muestra alineado a la derecha en PC/Web) */}
          <div className="desktop-auth-btn">
            {currentUser ? (
              <Link
                to={currentUser.role === 'ADMIN' || currentUser.role === 'STAFF' ? '/admin' : '/my-tickets'}
                className="btn-primary"
                style={{
                  textDecoration: 'none',
                  padding: '8px 18px',
                  fontSize: 14,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  borderRadius: 20
                }}
              >
                {currentUser.role === 'ADMIN' ? '⚙️ Panel Admin' : '👤 Mi Cuenta'}
              </Link>
            ) : (
              <Link
                to="/login"
                style={{
                  background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
                  color: '#FFFFFF',
                  textDecoration: 'none',
                  padding: '8px 18px',
                  borderRadius: 20,
                  fontWeight: 700,
                  fontSize: 14,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
                }}
              >
                🔑 Iniciar Sesión
              </Link>
            )}
          </div>

        </div>
      </header>

      {/* ── 2. Hero Section ── */}
      <section style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        color: '#FFFFFF',
        padding: '60px 20px 80px 20px',
        textAlign: 'center',
        position: 'relative'
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          {/* Logo 3D Oficial en Hero */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 20 }}>
            <img
              src="https://cdn.cloud-tickets.com/Icon_1.jpg"
              alt="CloudTickets"
              style={{ width: 64, height: 64, borderRadius: 14, boxShadow: '0 8px 20px rgba(0,0,0,0.4)', objectFit: 'contain' }}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://cdn.cloud-tickets.com/CT_simbolo_G.jpg';
              }}
            />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.5px' }}>
                CloudTickets
              </div>
              <div style={{ fontSize: 13, color: '#93C5FD', fontWeight: 600 }}>
                Control de acceso inteligente
              </div>
            </div>
          </div>

          <span style={{
            background: 'rgba(59, 130, 246, 0.2)',
            color: '#60A5FA',
            padding: '6px 16px',
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            display: 'inline-block',
            marginBottom: 16
          }}>
				• Potenciando Accesos
				• Conectando Experiencias 
          </span>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 900, margin: '0 0 20px 0', lineHeight: 1.2 }}>
            Vive tus momentos inolvidables en los mejores eventos
          </h1>
          <p style={{ fontSize: 18, color: '#94A3B8', marginBottom: 36, lineHeight: 1.6 }}>
            Compra tus entradas de forma instantánea, recibe tu código QR en minutos y disfruta de acceso 100% verificado.
          </p>

          {/* Buscador Rápido */}
          <form
            onSubmit={handleSearchSubmit}
            style={{
              background: '#FFFFFF',
              borderRadius: 14,
              padding: 8,
              display: 'flex',
              gap: 8,
              boxShadow: '0 20px 30px rgba(0,0,0,0.3)',
              maxWidth: 600,
              margin: '0 auto'
            }}
          >
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="🔍 Buscar evento por nombre, concierto, fiesta..."
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                padding: '12px 16px',
                fontSize: 16,
                color: '#1E293B'
              }}
            />
            <button
              type="submit"
              className="btn-primary"
              style={{ padding: '12px 24px', fontSize: 16, border: 'none', cursor: 'pointer' }}
            >
              Buscar
            </button>
          </form>
        </div>
      </section>

      {/* ── 3. Métricas de Confianza (Trust Badges) ── */}
      <section style={{ maxWidth: 1100, margin: '-40px auto 40px auto', padding: '0 20px', position: 'relative', zIndex: 10 }}>
        <div style={{
          background: '#FFFFFF',
          borderRadius: 16,
          padding: '24px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 20,
          textAlign: 'center'
        }}>
          <div>
            <div style={{ fontSize: 28, marginBottom: 4 }}>📱</div>
            <div style={{ fontWeight: 'bold', color: '#1E293B' }}>Control QR Inmediato</div>
            <div style={{ fontSize: 13, color: '#64748B' }}>Entrada directa sin filas</div>
          </div>
          <div>
            <div style={{ fontSize: 28, marginBottom: 4 }}>📄</div>
            <div style={{ fontWeight: 'bold', color: '#1E293B' }}>Ticket Digital PDF</div>
            <div style={{ fontSize: 13, color: '#64748B' }}>Recibe tus tickets en PDF y QR</div>
          </div>
          <div>
            <div style={{ fontSize: 28, marginBottom: 4 }}>💳</div>
            <div style={{ fontWeight: 'bold', color: '#1E293B' }}>Pagos Seguros (Wompi)</div>
            <div style={{ fontSize: 13, color: '#64748B' }}>PSE, Tarjetas, Nequi y Bancolombia</div>
          </div>
          <div>
            <div style={{ fontSize: 28, marginBottom: 4 }}>🎟️</div>
            <div style={{ fontWeight: 'bold', color: '#1E293B' }}>Boletas Auténticas</div>
            <div style={{ fontSize: 13, color: '#64748B' }}>Firma criptográfica anti-fraude</div>
          </div>
          <div>
            <div style={{ fontSize: 28, marginBottom: 4 }}>💬</div>
            <div style={{ fontWeight: 'bold', color: '#1E293B' }}>Soporte 24/7</div>
            <div style={{ fontSize: 13, color: '#64748B' }}>Atención personalizada</div>
          </div>
        </div>
      </section>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px 60px 20px' }}>

        {/* ── 4. Catálogo de Eventos ── */}
        <section id="catalogo" style={{ marginBottom: 60, scrollMarginTop: 90 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
            <div>
              <h2 style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', margin: '0 0 6px 0' }}>
                🎉 Próximos Eventos Disponibles
              </h2>
              <p style={{ color: '#64748B', margin: 0 }}>
                Explora y asegura tus entradas antes de que se agoten.
              </p>
            </div>


          </div>

          {loadingEvents ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748B' }}>
              Cargando catálogo de eventos...
            </div>
          ) : filteredEvents.length === 0 ? (
            <div style={{ background: '#FFFFFF', padding: 40, borderRadius: 16, textAlign: 'center', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎟️</div>
              <h3 style={{ margin: '0 0 8px 0', color: '#1E293B' }}>No se encontraron eventos activos</h3>
              <p style={{ color: '#64748B', margin: 0 }}>Intenta buscando con otro término o categoría.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24 }}>
              {filteredEvents.map(ev => (
                <div
                  key={ev.id}
                  style={{
                    background: '#FFFFFF',
                    borderRadius: 16,
                    overflow: 'hidden',
                    border: '1px solid #E2E8F0',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    justify: 'space-between',
                    transition: 'transform 0.2s ease, boxShadow 0.2s ease'
                  }}
                >
                  {/* Banner / Imagen del evento */}
                  <div style={{ height: 200, background: '#1E293B', overflow: 'hidden', position: 'relative' }}>
                    {ev.image_url ? (
                      <img
                        src={ev.image_url}
                        alt={ev.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94A3B8', fontSize: 16, fontWeight: 'bold' }}>
                        🎉 {ev.name}
                      </div>
                    )}

                    <div style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      background: 'rgba(16, 185, 129, 0.9)',
                      color: '#FFF',
                      padding: '4px 10px',
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 'bold',
                      backdropFilter: 'blur(4px)'
                    }}>
                      Vigente
                    </div>
                  </div>

                  {/* Información del evento */}
                  <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <h3 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 10px 0', color: '#0F172A' }}>
                        {ev.name}
                      </h3>
                      <p style={{ color: '#64748B', fontSize: 14, margin: '0 0 16px 0', lineClamp: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {ev.description || 'Disfruta de este gran evento. Adquiere tus tickets digitales con acceso verificado.'}
                      </p>

                      <div style={{ fontSize: 13, color: '#475569', marginBottom: 16 }}>
                        {ev.start_datetime && (
                          <div style={{ marginBottom: 4 }}>
                            📅 <strong>Fecha:</strong> {new Date(ev.start_datetime).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Botón de Compra Directa */}
                    <div style={{ paddingTop: 16, borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Link
                        to={`/events/${ev.id}`}
                        className="btn-primary"
                        style={{
                          width: '100%',
                          textAlign: 'center',
                          padding: '12px',
                          textDecoration: 'none',
                          fontSize: 15,
                          fontWeight: 700,
                          borderRadius: 10
                        }}
                      >
                        🎟️ Comprar Entradas
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── 5. Módulo de Cotización para Organizadores ── */}
        <section id="cotizar" style={{ marginBottom: 60, scrollMarginTop: 90 }}>
          <EventQuoteForm />
        </section>

        {/* ── 6. Módulo de Solicitud de Anuncios y Patrocinio ── */}
        <section id="anuncios" style={{ marginBottom: 60, scrollMarginTop: 90 }}>
          <AdRequestForm />
        </section>

      </main>

      {/* ── 7. Footer ── */}
      <footer style={{ background: '#0F172A', color: '#94A3B8', padding: '40px 20px', borderTop: '1px solid #1E293B' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 30 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <img
                src="https://cdn.cloud-tickets.com/CT_simbolo_G.jpg"
                alt="CloudTickets Logo"
                style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'contain' }}
              />
              <div>
                <div style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 900, lineHeight: 1.1 }}>CloudTickets</div>
                <div style={{ color: '#60A5FA', fontSize: 11, fontWeight: 600 }}>Potenciando Accesos • Conectando Experiencias</div>
              </div>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.6 }}>
              Plataforma tecnológica para la gestión, venta de boletería digital y control de acceso inteligente de eventos.
            </p>
          </div>

          <div>
            <h4 style={{ color: '#FFFFFF', fontSize: 16, margin: '0 0 12px 0' }}>Enlaces Rápidos</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
              <a href="#catalogo" onClick={(e) => { e.preventDefault(); scrollToSection('catalogo', 'CATALOG'); }} style={{ color: '#94A3B8', textDecoration: 'none', cursor: 'pointer' }}>🎉 Catálogo de Eventos</a>
              <Link to="/my-tickets" style={{ color: '#94A3B8', textDecoration: 'none' }}>🎫 Consultar mis Tickets</Link>
              <a href="#cotizar" onClick={(e) => { e.preventDefault(); scrollToSection('cotizar', 'QUOTE'); }} style={{ color: '#94A3B8', textDecoration: 'none', cursor: 'pointer' }}>🎪 Cotizar mi Evento</a>
              <a href="#anuncios" onClick={(e) => { e.preventDefault(); scrollToSection('anuncios', 'AD'); }} style={{ color: '#94A3B8', textDecoration: 'none', cursor: 'pointer' }}>📢 Publicar Anuncio</a>
              <Link to="/login" style={{ color: '#94A3B8', textDecoration: 'none' }}>🔑 Iniciar Sesión Admin</Link>
            </div>
          </div>

          <div>
            <h4 style={{ color: '#FFFFFF', fontSize: 16, margin: '0 0 12px 0' }}>Soporte & Legal</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
              <Link to="/privacy" style={{ color: '#94A3B8', textDecoration: 'none' }}>Política de Privacidad</Link>
              <Link to="/contact" style={{ color: '#94A3B8', textDecoration: 'none' }}>Contacto de Soporte</Link>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 1200, margin: '30px auto 0 auto', paddingTop: 20, borderTop: '1px solid #1E293B', textAlign: 'center', fontSize: 13 }}>
          © {new Date().getFullYear()} CloudTickets. Todos los derechos reservados.
        </div>
      </footer>

    </div>
  );
}

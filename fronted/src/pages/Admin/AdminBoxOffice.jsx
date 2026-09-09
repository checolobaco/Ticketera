import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api';
import EventAdminMenu from '../../components/EventAdminMenu';

export default function AdminBoxOffice() {
  const { id } = useParams();
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const isAdmin = user?.role === 'ADMIN';

  const [ticketTypes, setTicketTypes] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // Status & Permissions
  const [isBoxofficeEnabled, setIsBoxofficeEnabled] = useState(true);
  const [staffList, setStaffList] = useState([]);
  const [myPermission, setMyPermission] = useState(true);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [addingStaff, setAddingStaff] = useState(false);

  // Form Options
  const [paymentMethod, setPaymentMethod] = useState('EFECTIVO'); // EFECTIVO, DATAFONO, TRANSFERENCIA
  const [amountReceived, setAmountReceived] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        // Fetch Event Details (boxoffice enabled status)
        const evRes = await api.get(`/api/events/${id}`);
        if (evRes.data && evRes.data.is_boxoffice_enabled !== undefined) {
          setIsBoxofficeEnabled(evRes.data.is_boxoffice_enabled);
        }

        // Fetch Ticket Types
        const tRes = await api.get(`/api/ticket-types?eventId=${id}`);
        setTicketTypes(tRes.data || []);

        // Fetch Staff List
        try {
          const sRes = await api.get(`/api/eventstaff/${id}/staff`);
          const staffData = Array.isArray(sRes.data) ? sRes.data : [];
          setStaffList(staffData);

          if (!isAdmin && user?.id) {
            const me = staffData.find(s => Number(s.user_id) === Number(user.id));
            if (me && me.can_access_taquilla === false) {
              setMyPermission(false);
            }
          }
        } catch (sErr) {
          console.warn('Could not fetch staff list:', sErr);
        }

      } catch (err) {
        setErrorMsg('Error cargando los datos de la taquilla');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id, isAdmin, user?.id]);

  // Admin Toggle BoxOffice Enable / Disable
  const handleToggleBoxoffice = async () => {
    try {
      setTogglingStatus(true);
      const next = !isBoxofficeEnabled;
      const res = await api.patch(`/api/events/${id}/boxoffice-status`, { enabled: next });
      setIsBoxofficeEnabled(res.data.is_boxoffice_enabled);
    } catch (err) {
      alert('Error al cambiar el estado de la Taquilla: ' + (err.response?.data?.error || err.message));
    } finally {
      setTogglingStatus(false);
    }
  };

  // Admin Toggle Staff Taquilla Permission
  const handleToggleStaffPermission = async (targetUserId, currentVal) => {
    try {
      const next = !currentVal;
      await api.patch(`/api/eventstaff/${id}/staff/${targetUserId}/taquilla-permission`, { can_access_taquilla: next });
      setStaffList(prev => prev.map(s => Number(s.user_id) === Number(targetUserId) ? { ...s, can_access_taquilla: next } : s));
    } catch (err) {
      alert('Error actualizando permiso: ' + (err.response?.data?.error || err.message));
    }
  };

  // Admin Add Staff Member
  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!newStaffEmail.trim()) return;
    try {
      setAddingStaff(true);
      const res = await api.post(`/api/eventstaff/${id}/staff`, { email: newStaffEmail.trim(), can_access_taquilla: true });
      const newStaff = res.data;
      setStaffList(prev => {
        const filtered = prev.filter(s => Number(s.user_id) !== Number(newStaff.user_id));
        return [...filtered, {
          ...newStaff,
          name: newStaff.user?.name || newStaff.name || newStaffEmail.trim(),
          email: newStaff.user?.email || newStaff.email || newStaffEmail.trim()
        }];
      });
      setNewStaffEmail('');
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo agregar al usuario. Verifica que esté registrado.');
    } finally {
      setAddingStaff(false);
    }
  };

  const handleQty = (tId, delta) => {
    setQuantities(prev => {
      const current = prev[tId] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [tId]: next };
    });
  };

  const visibleTicketTypes = isAdmin 
    ? ticketTypes 
    : ticketTypes.filter(t => t.status === 'ACTIVE');

  const selectedItems = visibleTicketTypes.filter(t => (quantities[t.id] || 0) > 0).map(t => ({
    ticket_type_id: t.id,
    quantity: quantities[t.id],
    price_pesos: t.price_pesos
  }));

  const totalPesos = selectedItems.reduce((acc, it) => acc + (it.price_pesos * it.quantity), 0);
  const change = amountReceived ? Math.max(0, Number(amountReceived) - totalPesos) : 0;

  const handleCheckout = async (autoCheckin) => {
    if (selectedItems.length === 0) {
      setErrorMsg('Debe seleccionar al menos un ticket');
      return;
    }

    if (!autoCheckin && !customerPhone && !customerEmail) {
      setErrorMsg('Debe ingresar al menos un número de WhatsApp o un Correo Electrónico para enviar los tickets');
      return;
    }

    setProcessing(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const payload = {
        eventId: id,
        items: selectedItems,
        paymentMethod: paymentMethod === 'EFECTIVO' ? 'CASH' : paymentMethod,
        autoCheckin,
        amountReceived: amountReceived ? Number(amountReceived) : null,
        customerPhone: customerPhone ? customerPhone.trim() : null,
        customerEmail: customerEmail ? customerEmail.trim() : null
      };

      const res = await api.post('/api/orders/boxoffice', payload);
      
      let msg = `Venta exitosa. ${res.data.createdTicketsCount} tickets generados.`;
      if (autoCheckin) {
        msg += ' Marcados como INGRESADOS automáticamente.';
      } else {
        const sentVia = [];
        if (res.data.whatsappSent) sentVia.push('WhatsApp');
        if (res.data.emailSent) sentVia.push('Correo Electrónico');
        if (sentVia.length > 0) {
          msg += ` QR enviado por ${sentVia.join(' y ')}.`;
        } else {
          msg += ' Orden creada (no se pudo enviar notificación digital).';
        }
      }

      setSuccessMsg(msg);
      setQuantities({});
      setAmountReceived('');
      setCustomerPhone('');
      setCustomerEmail('');
      
    } catch (err) {
      setErrorMsg(err?.response?.data?.error || 'Error procesando la venta');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div style={{ padding: 20 }}>Cargando taquilla...</div>;

  // BLOCKING CASE FOR STAFF: No permission
  if (!isAdmin && !myPermission) {
    return (
      <div className="stack-lg">
        <h1 className="app-title">Taquilla</h1>
        <EventAdminMenu eventId={id} />
        <div style={{ maxWidth: 600, margin: '40px auto', padding: 30, background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⛔</div>
          <h2 style={{ color: '#991B1B', marginTop: 0 }}>Acceso denegado</h2>
          <p style={{ color: '#7F1D1D', fontSize: 16 }}>No tienes permiso para acceder a la Taquilla de este evento. Contacta al Administrador.</p>
        </div>
      </div>
    );
  }

  // BLOCKING CASE FOR STAFF: BoxOffice disabled
  if (!isAdmin && !isBoxofficeEnabled) {
    return (
      <div className="stack-lg">
        <h1 className="app-title">Taquilla</h1>
        <EventAdminMenu eventId={id} />
        <div style={{ maxWidth: 600, margin: '40px auto', padding: 30, background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
          <h2 style={{ color: '#92400E', marginTop: 0 }}>Taquilla Deshabilitada</h2>
          <p style={{ color: '#78350F', fontSize: 16 }}>La Taquilla para este evento ha sido deshabilitada por el Administrador.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="stack-lg">
      <h1 className="app-title">Taquilla</h1>
      <EventAdminMenu eventId={id} />

      <div style={{ maxWidth: 650, margin: '0 auto', padding: '12px 10px', width: '100%', boxSizing: 'border-box' }}>
        
        {/* ======================================================== */}
        {/* ADMIN PANEL: TOGGLE SWITCH & STAFF PERMISSIONS (OPTION 1) */}
        {/* ======================================================== */}
        {isAdmin && (
          <div style={{ background: isBoxofficeEnabled ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${isBoxofficeEnabled ? '#86EFAC' : '#FCA5A5'}`, padding: 14, borderRadius: 14, marginBottom: 20, boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ margin: 0, color: isBoxofficeEnabled ? '#166534' : '#991B1B', display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
                  <span>{isBoxofficeEnabled ? '🟢 Taquilla Habilitada' : '🔴 Taquilla Deshabilitada'}</span>
                </h3>
                <div style={{ fontSize: 13, color: isBoxofficeEnabled ? '#15803D' : '#991B1B', marginTop: 4 }}>
                  {isBoxofficeEnabled 
                    ? 'Los usuarios autorizados pueden ingresar y realizar ventas.' 
                    : 'La taquilla está bloqueada. Ningún usuario staff podrá cobrar entradas.'}
                </div>
              </div>

              <button
                onClick={handleToggleBoxoffice}
                disabled={togglingStatus}
                style={{
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: 'none',
                  fontWeight: 'bold',
                  fontSize: 13,
                  cursor: togglingStatus ? 'not-allowed' : 'pointer',
                  background: isBoxofficeEnabled ? '#DC2626' : '#16A34A',
                  color: '#FFF',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                  flexShrink: 0
                }}
              >
                {togglingStatus ? 'Cambiando...' : isBoxofficeEnabled ? '🔴 Deshabilitar Taquilla' : '🟢 Habilitar Taquilla'}
              </button>
            </div>

            {/* SECCIÓN OPCIÓN 1: PERMISOS DE USUARIOS / STAFF DE TAQUILLA */}
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${isBoxofficeEnabled ? '#BBF7D0' : '#FECACA'}` }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#1E293B', fontSize: 15 }}>
                👥 Permisos de Usuarios para Taquilla
              </h4>
              <p style={{ margin: '0 0 12px 0', fontSize: 13, color: '#475569' }}>
                Selecciona qué usuarios del equipo tienen permiso para vender en la Taquilla de este evento:
              </p>

              {/* Formulario agregar usuario por correo */}
              <form onSubmit={handleAddStaff} style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <input 
                  type="email" 
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                  placeholder="Correo del usuario (Ej: vendedor@gmail.com)"
                  style={{ flex: '1 1 200px', minWidth: 0, padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, boxSizing: 'border-box' }}
                />
                <button 
                  type="submit" 
                  disabled={addingStaff || !newStaffEmail.trim()}
                  style={{ flex: '0 0 auto', padding: '10px 16px', borderRadius: 8, border: 'none', background: '#3B82F6', color: '#FFF', fontWeight: 'bold', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {addingStaff ? 'Guardando...' : '+ Dar Permiso'}
                </button>
              </form>

              {/* Lista de usuarios con checkbox */}
              {staffList.length === 0 ? (
                <div style={{ fontSize: 13, color: '#64748B', fontStyle: 'italic' }}>
                  No hay usuarios adicionales asignados a este evento aún. (Como Administrador, tú siempre tienes acceso).
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {staffList.map(s => (
                    <label 
                      key={s.user_id} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '10px 12px', 
                        background: '#FFF', 
                        borderRadius: 10, 
                        border: '1px solid #E2E8F0',
                        cursor: 'pointer',
                        gap: 8,
                        boxSizing: 'border-box'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                        <span style={{ fontWeight: 'bold', fontSize: 14, color: '#1E293B', display: 'inline-block' }}>{s.name || s.email}</span>
                        {s.name && <span style={{ fontSize: 12, color: '#64748B', display: 'block', wordBreak: 'break-all' }}>({s.email})</span>}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <input 
                          type="checkbox"
                          checked={s.can_access_taquilla !== false}
                          onChange={() => handleToggleStaffPermission(s.user_id, s.can_access_taquilla !== false)}
                          style={{ width: 18, height: 18, cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: 13, fontWeight: 600, color: s.can_access_taquilla !== false ? '#15803D' : '#991B1B' }}>
                          {s.can_access_taquilla !== false ? 'Permitido' : 'Bloqueado'}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ALERTA DE TAQUILLA DESHABILITADA PARA ADMIN */}
        {isAdmin && !isBoxofficeEnabled && (
          <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', color: '#92400E', padding: 14, borderRadius: 12, marginBottom: 16, fontWeight: 'bold', textAlign: 'center', fontSize: 13 }}>
            ⚠️ ATENCIÓN: La taquilla está deshabilitada actualmente. Puedes hacer pruebas como Administrador, pero los usuarios Staff no podrán realizar ventas hasta que la habilites arriba.
          </div>
        )}

        {errorMsg && <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{errorMsg}</div>}
        {successMsg && <div style={{ background: '#D1FAE5', color: '#065F46', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{successMsg}</div>}

        <div style={{ background: '#FFF', padding: '16px 14px', borderRadius: 12, border: '1px solid #E5E7EB', marginBottom: 20, boxSizing: 'border-box' }}>
          <h3 style={{ marginTop: 0, marginBottom: 14 }}>Seleccionar Entradas</h3>
          {visibleTicketTypes.map(t => {
            const qty = quantities[t.id] || 0;
            return (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #F3F4F6', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0, paddingRight: 4 }}>
                  <div style={{ fontWeight: 'bold', fontSize: 15, wordBreak: 'break-word' }}>{t.name}</div>
                  <div style={{ color: '#6B7280', fontSize: 14, marginTop: 2 }}>${Number(t.price_pesos).toLocaleString('es-CO')}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <button 
                    onClick={() => handleQty(t.id, -1)}
                    style={{ width: 36, height: 36, borderRadius: '50%', background: '#F3F4F6', border: 'none', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >-</button>
                  <span style={{ fontSize: 18, fontWeight: 'bold', width: 22, textAlign: 'center' }}>{qty}</span>
                  <button 
                    onClick={() => handleQty(t.id, 1)}
                    style={{ width: 36, height: 36, borderRadius: '50%', background: '#E0E7FF', color: '#4F46E5', border: 'none', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >+</button>
                </div>
              </div>
            );
          })}

          <div style={{ marginTop: 18, fontSize: 22, fontWeight: 'bold', textAlign: 'right' }}>
            Total: ${totalPesos.toLocaleString('es-CO')}
          </div>
        </div>

        <div style={{ background: '#FFF', padding: '16px 14px', borderRadius: 12, border: '1px solid #E5E7EB', marginBottom: 80, boxSizing: 'border-box' }}>
          <h3 style={{ marginTop: 0 }}>Detalles del Pago</h3>
          
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold', fontSize: 14 }}>Método de Pago</label>
            <select 
              value={paymentMethod} 
              onChange={(e) => setPaymentMethod(e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 14, boxSizing: 'border-box' }}
            >
              <option value="EFECTIVO">Efectivo</option>
              <option value="DATAFONO">Datáfono</option>
              <option value="TRANSFERENCIA">Transferencia</option>
            </select>
          </div>

          {paymentMethod === 'EFECTIVO' && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold', fontSize: 14 }}>Monto Recibido</label>
              <input 
                type="number" 
                value={amountReceived} 
                onChange={(e) => setAmountReceived(e.target.value)}
                placeholder="¿Con cuánto pagan?"
                style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 14, boxSizing: 'border-box' }}
              />
              {amountReceived && Number(amountReceived) > totalPesos && (
                <div style={{ marginTop: 8, color: '#059669', fontWeight: 'bold', fontSize: 17 }}>
                  Vueltas / Cambio: ${change.toLocaleString('es-CO')}
                </div>
              )}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold', fontSize: 14 }}>WhatsApp (Opcional)</label>
            <input 
              type="text" 
              value={customerPhone} 
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Ej: +573001234567"
              style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold', fontSize: 14 }}>Correo Electrónico (Opcional)</label>
            <input 
              type="email" 
              value={customerEmail} 
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="Ej: cliente@gmail.com (Opcional si no tiene WhatsApp)"
              style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
            <button 
              onClick={() => handleCheckout(true)}
              disabled={processing || totalPesos === 0}
              style={{ width: '100%', padding: 14, background: '#10B981', color: '#FFF', border: 'none', borderRadius: 8, fontWeight: 'bold', fontSize: 15, cursor: processing || totalPesos === 0 ? 'not-allowed' : 'pointer' }}
            >
              {processing ? 'Procesando...' : '💰 Cobrar y Dar Ingreso Automático'}
            </button>

            <button 
              onClick={() => handleCheckout(false)}
              disabled={processing || totalPesos === 0}
              style={{ width: '100%', padding: 14, background: '#3B82F6', color: '#FFF', border: 'none', borderRadius: 8, fontWeight: 'bold', fontSize: 15, cursor: processing || totalPesos === 0 ? 'not-allowed' : 'pointer' }}
            >
              {processing ? 'Procesando...' : '📱 Cobrar y Enviar Entradas'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

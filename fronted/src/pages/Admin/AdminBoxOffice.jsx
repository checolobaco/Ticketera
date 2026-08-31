import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api';
import EventAdminMenu from '../../components/EventAdminMenu';

export default function AdminBoxOffice() {
  const { id } = useParams();
  const [ticketTypes, setTicketTypes] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // Options
  const [paymentMethod, setPaymentMethod] = useState('EFECTIVO'); // EFECTIVO, DATAFONO, TRANSFERENCIA
  const [amountReceived, setAmountReceived] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function fetchTickets() {
      try {
        const res = await api.get(`/api/ticket-types?eventId=${id}`);
        setTicketTypes(res.data || []);
      } catch (err) {
        setErrorMsg('Error cargando los tickets');
      } finally {
        setLoading(false);
      }
    }
    fetchTickets();
  }, [id]);

  const handleQty = (tId, delta) => {
    setQuantities(prev => {
      const current = prev[tId] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [tId]: next };
    });
  };

  const selectedItems = ticketTypes.filter(t => (quantities[t.id] || 0) > 0).map(t => ({
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

    if (!autoCheckin && !customerPhone) {
      setErrorMsg('Debe ingresar un número de WhatsApp para enviar el QR');
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
        customerPhone: customerPhone || null
      };

      const res = await api.post('/api/orders/boxoffice', payload);
      
      let msg = `Venta exitosa. ${res.data.createdTicketsCount} tickets generados.`;
      if (autoCheckin) msg += ' Marcados como INGRESADOS automáticamente.';
      else if (res.data.whatsappSent) msg += ' QR enviado por WhatsApp.';
      else if (!autoCheckin) msg += ' Error enviando WhatsApp, pero la orden se creó.';

      setSuccessMsg(msg);
      setQuantities({});
      setAmountReceived('');
      setCustomerPhone('');
      
    } catch (err) {
      setErrorMsg(err?.response?.data?.error || 'Error procesando la venta');
    } finally {
      setProcessing(false);
    }
  };
  if (loading) return <div style={{ padding: 20 }}>Cargando taquilla...</div>;

  return (
    <div className="stack-lg">
      <h1 className="app-title">Taquilla Rápida (POS)</h1>
      <EventAdminMenu eventId={id} />
      
      <div style={{ maxWidth: 600, margin: '0 auto', padding: 20 }}>
      {errorMsg && <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: 12, borderRadius: 8, marginBottom: 16 }}>{errorMsg}</div>}
      {successMsg && <div style={{ background: '#D1FAE5', color: '#065F46', padding: 12, borderRadius: 8, marginBottom: 16 }}>{successMsg}</div>}

      <div style={{ background: '#FFF', padding: 20, borderRadius: 12, border: '1px solid #E5E7EB', marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Seleccionar Entradas</h3>
        {ticketTypes.map(t => {
          const qty = quantities[t.id] || 0;
          return (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #F3F4F6' }}>
              <div>
                <div style={{ fontWeight: 'bold' }}>{t.name}</div>
                <div style={{ color: '#6B7280', fontSize: 14 }}>${Number(t.price_pesos).toLocaleString('es-CO')}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button 
                  onClick={() => handleQty(t.id, -1)}
                  style={{ width: 36, height: 36, borderRadius: '50%', background: '#F3F4F6', border: 'none', fontSize: 20, cursor: 'pointer' }}
                >-</button>
                <span style={{ fontSize: 18, fontWeight: 'bold', width: 24, textAlign: 'center' }}>{qty}</span>
                <button 
                  onClick={() => handleQty(t.id, 1)}
                  style={{ width: 36, height: 36, borderRadius: '50%', background: '#E0E7FF', color: '#4F46E5', border: 'none', fontSize: 20, cursor: 'pointer' }}
                >+</button>
              </div>
            </div>
          );
        })}

        <div style={{ marginTop: 20, fontSize: 24, fontWeight: 'bold', textAlign: 'right' }}>
          Total: ${totalPesos.toLocaleString('es-CO')}
        </div>
      </div>

      <div style={{ background: '#FFF', padding: 20, borderRadius: 12, border: '1px solid #E5E7EB' }}>
        <h3 style={{ marginTop: 0 }}>Detalles del Pago</h3>
        
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold' }}>Método de Pago</label>
          <select 
            value={paymentMethod} 
            onChange={(e) => setPaymentMethod(e.target.value)}
            style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #D1D5DB' }}
          >
            <option value="EFECTIVO">Efectivo</option>
            <option value="DATAFONO">Datáfono</option>
            <option value="TRANSFERENCIA">Transferencia</option>
          </select>
        </div>

        {paymentMethod === 'EFECTIVO' && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold' }}>Monto Recibido</label>
            <input 
              type="number" 
              value={amountReceived} 
              onChange={(e) => setAmountReceived(e.target.value)}
              placeholder="¿Con cuánto pagan?"
              style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #D1D5DB' }}
            />
            {amountReceived && Number(amountReceived) > totalPesos && (
              <div style={{ marginTop: 8, color: '#059669', fontWeight: 'bold', fontSize: 18 }}>
                Vueltas / Cambio: ${change.toLocaleString('es-CO')}
              </div>
            )}
          </div>
        )}

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold' }}>WhatsApp (Solo si enviará QR)</label>
          <input 
            type="text" 
            value={customerPhone} 
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="Ej: +573001234567"
            style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #D1D5DB' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
          <button 
            onClick={() => handleCheckout(true)}
            disabled={processing || totalPesos === 0}
            style={{ width: '100%', padding: 16, background: '#10B981', color: '#FFF', border: 'none', borderRadius: 8, fontWeight: 'bold', fontSize: 16, cursor: processing || totalPesos === 0 ? 'not-allowed' : 'pointer' }}
          >
            {processing ? 'Procesando...' : '💰 Cobrar y Dar Ingreso Automático'}
          </button>

          <button 
            onClick={() => handleCheckout(false)}
            disabled={processing || totalPesos === 0}
            style={{ width: '100%', padding: 16, background: '#3B82F6', color: '#FFF', border: 'none', borderRadius: 8, fontWeight: 'bold', fontSize: 16, cursor: processing || totalPesos === 0 ? 'not-allowed' : 'pointer' }}
          >
            {processing ? 'Procesando...' : '📱 Cobrar y Enviar QR por WhatsApp'}
          </button>
        </div>
      </div>
    </div>
    </div>
  );
}

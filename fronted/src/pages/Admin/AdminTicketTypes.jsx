import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../api'

function computeTicketState(ticket) {
  const now = new Date()

  if (ticket.status === 'HIDDEN') return 'OCULTO'
  if (ticket.status === 'SOLD_OUT') return 'AGOTADO'

  const stockRestante =
    ticket.stock_restante != null
      ? Number(ticket.stock_restante)
      : Number(ticket.stock_total || 0) - Number(ticket.stock_sold || 0)

  if (stockRestante <= 0) return 'AGOTADO'

  if (ticket.sales_start_at && now < new Date(ticket.sales_start_at)) {
    return 'PROGRAMADO'
  }

  if (ticket.sales_end_at && now > new Date(ticket.sales_end_at)) {
    return 'EXPIRADO'
  }

  return 'VIGENTE'
}

function toLocalDatetimeInput(value) {
  if (!value) return ''
  const d = new Date(value)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function AdminTicketTypes() {
  const { id } = useParams()

  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)

  const emptyForm = {
    name: '',
    price_pesos: '',
    price_cents: '',
    stock_total: '',
    entries_per_ticket: '1',
    sales_start_at: '',
    sales_end_at: '',
    status: 'ACTIVE'
  }

  const [form, setForm] = useState(emptyForm)

  async function load() {
    try {
      setLoading(true)
      setError('')

      const [ticketsRes, salesRes] = await Promise.all([
        api.get('/api/ticket-types', {
          params: { eventId: id }
        }),
        api.get(`/api/events/${id}/sales-by-ticket-type`)
      ])

      const ticketsData = Array.isArray(ticketsRes.data) ? ticketsRes.data : []
      const salesData = Array.isArray(salesRes.data) ? salesRes.data : []

      const salesMap = new Map(
        salesData.map(row => [Number(row.ticket_type_id), row])
      )

      const merged = ticketsData.map(ticket => {
        const sale = salesMap.get(Number(ticket.id))

        return {
          ...ticket,
          cantidad_vendida: Number(sale?.cantidad_vendida || 0),
          stock_restante:
            sale?.stock_restante != null
              ? Number(sale.stock_restante)
              : Number(ticket.stock_total || 0) - Number(ticket.stock_sold || 0)
        }
      })

      setTickets(merged)
    } catch (err) {
      console.error(err)
      setError('No se pudieron cargar los tickets')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id])

  async function create(e) {
    e.preventDefault()

    try {
      setSaving(true)
      setError('')

      const pricePesos = Number(form.price_pesos || 0)
      const stockTotal = Number(form.stock_total || 0)
      const entriesPerTicket = Number(form.entries_per_ticket || 1)

      await api.post('/api/ticket-types', {
        event_id: Number(id),
        name: form.name,
        price_cents: Math.round(pricePesos * 100),
        price_pesos: Math.round(pricePesos),
        stock_total: stockTotal,
        entries_per_ticket: entriesPerTicket,
        sales_start_at: form.sales_start_at || null,
        sales_end_at: form.sales_end_at || null,
        status: form.status || 'ACTIVE'
      })

      setForm(emptyForm)
      await load()
    } catch (err) {
      console.error(err)
      setError(err?.response?.data?.error || 'No se pudo crear el ticket')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(ticket) {
    setEditingId(ticket.id)
    setForm({
      name: ticket.name || '',
      price_pesos: String(ticket.price_pesos || Math.round((ticket.price_cents || 0) / 100)),
      price_cents: String(ticket.price_cents || ''),
      stock_total: String(ticket.stock_total || ''),
      entries_per_ticket: String(ticket.entries_per_ticket || 1),
      sales_start_at: toLocalDatetimeInput(ticket.sales_start_at),
      sales_end_at: toLocalDatetimeInput(ticket.sales_end_at),
      status: ticket.status || 'ACTIVE'
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm)
  }

  async function saveEdit(e) {
    e.preventDefault()

    try {
      setSaving(true)
      setError('')

      const pricePesos = Number(form.price_pesos || 0)

      await api.patch(`/api/ticket-types/${editingId}`, {
        name: form.name,
        price_cents: Math.round(pricePesos * 100),
        price_pesos: Math.round(pricePesos),
        stock_total: Number(form.stock_total || 0),
        entries_per_ticket: Number(form.entries_per_ticket || 1),
        sales_start_at: form.sales_start_at || null,
        sales_end_at: form.sales_end_at || null,
        status: form.status || 'ACTIVE'
      })

      setEditingId(null)
      setForm(emptyForm)
      await load()
    } catch (err) {
      console.error(err)
      setError(err?.response?.data?.error || 'No se pudo editar el ticket')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div>Cargando tickets...</div>

  return (
    <div className="stack-lg">
      <div>
        <h1 className="app-title">Ticket Types</h1>
        <div className="app-subtitle">Evento #{id}</div>
      </div>

      {error ? (
        <div style={{ color: 'crimson' }}>{error}</div>
      ) : null}

      <div className="ticket-card">
        <form onSubmit={create} className="stack-md">
          <div style={{ fontWeight: 700 }}>Nuevo ticket</div>

          <input
            className="input"
            placeholder="Nombre"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            required
          />

          <input
            className="input"
            type="number"
            min="0"
            step="1"
            placeholder="Precio en pesos"
            value={form.price_pesos}
            onChange={e => setForm({ ...form, price_pesos: e.target.value })}
            required
          />

          <input
            className="input"
            type="number"
            min="0"
            step="1"
            placeholder="Stock total"
            value={form.stock_total}
            onChange={e => setForm({ ...form, stock_total: e.target.value })}
            required
          />

          <input
            className="input"
            type="number"
            min="1"
            step="1"
            placeholder="Entradas permitidas por ticket"
            value={form.entries_per_ticket}
            onChange={e => setForm({ ...form, entries_per_ticket: e.target.value })}
            required
          />

          <select
            className="input"
            value={form.status}
            onChange={e => setForm({ ...form, status: e.target.value })}
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="HIDDEN">HIDDEN</option>
            <option value="SOLD_OUT">SOLD_OUT</option>
          </select>

          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div>
              <div style={{ marginBottom: 6 }}>Inicio venta</div>
              <input
                className="input"
                type="datetime-local"
                value={form.sales_start_at}
                onChange={e => setForm({ ...form, sales_start_at: e.target.value })}
              />
            </div>

            <div>
              <div style={{ marginBottom: 6 }}>Fin venta</div>
              <input
                className="input"
                type="datetime-local"
                value={form.sales_end_at}
                onChange={e => setForm({ ...form, sales_end_at: e.target.value })}
              />
            </div>
          </div>

          <div>
            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? 'Guardando...' : 'Crear ticket'}
            </button>
          </div>
        </form>
      </div>

      {tickets.length === 0 ? (
        <div className="ticket-card">No hay tickets creados aún.</div>
      ) : (
        tickets.map(ticket => {
          const state = computeTicketState(ticket)
          const price = Number(ticket.price_pesos || (ticket.price_cents || 0) / 100)
          const vendidos = Number(ticket.cantidad_vendida || 0)
          const stockTotal = Number(ticket.stock_total || 0)
          const stockRestante =
            ticket.stock_restante != null
              ? Number(ticket.stock_restante)
              : stockTotal - Number(ticket.stock_sold || 0)

          return (
            <div key={ticket.id} className="ticket-card">
              {editingId === ticket.id ? (
                <form onSubmit={saveEdit} className="stack-md">
                  <input
                    className="input"
                    placeholder="Nombre"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    required
                  />

                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Precio en pesos"
                    value={form.price_pesos}
                    onChange={e => setForm({ ...form, price_pesos: e.target.value })}
                    required
                  />

                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Stock total"
                    value={form.stock_total}
                    onChange={e => setForm({ ...form, stock_total: e.target.value })}
                    required
                  />
                  <input
                    className="input"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Entradas permitidas por ticket"
                    value={form.entries_per_ticket}
                    onChange={e => setForm({ ...form, entries_per_ticket: e.target.value })}
                    required
                  />
                  <select
                    className="input"
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="HIDDEN">HIDDEN</option>
                    <option value="SOLD_OUT">SOLD_OUT</option>
                  </select>

                  <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                    <input
                      className="input"
                      type="datetime-local"
                      value={form.sales_start_at}
                      onChange={e => setForm({ ...form, sales_start_at: e.target.value })}
                    />

                    <input
                      className="input"
                      type="datetime-local"
                      value={form.sales_end_at}
                      onChange={e => setForm({ ...form, sales_end_at: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button className="btn-primary" type="submit" disabled={saving}>
                      {saving ? 'Guardando...' : 'Guardar'}
                    </button>

                    <button
                      className="btn-outline"
                      type="button"
                      onClick={cancelEdit}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{ticket.name}</div>

                    <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 4 }}>
                      Precio: ${price.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 4 }}>
                      Ingresos permitidos por ticket: {Number(ticket.entries_per_ticket || 1)}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 4 }}>
                      Vendidos: {vendidos}
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 4 }}>
                      Stock restante: {stockRestante} / {stockTotal}
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 4 }}>
                      Inicio: {ticket.sales_start_at ? new Date(ticket.sales_start_at).toLocaleString() : '—'}
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 4 }}>
                      Fin: {ticket.sales_end_at ? new Date(ticket.sales_end_at).toLocaleString() : '—'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
                    <span className="btn-outline">{state}</span>

                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => startEdit(ticket)}
                    >
                      Editar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
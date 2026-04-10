import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../../api'

function formatMoney(value) {
  const n = Number(value || 0)
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(n)
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-CO')
}

function normalizeSummaryPayload(payload) {
  return {
    summary: {
      totalTicketsSold: Number(payload?.summary?.totalTicketsSold || 0),
      totalCollected: Number(payload?.summary?.totalCollected || 0),
      totalAvailableStock: Number(payload?.summary?.totalAvailableStock || 0),
      totalRemainingStock: Number(payload?.summary?.totalRemainingStock || 0)
    },
    salesByTicketType: Array.isArray(payload?.salesByTicketType)
      ? payload.salesByTicketType.map(row => ({
          ...row,
          ticket_type_id: Number(row.ticket_type_id || 0),
          stock_total: Number(row.stock_total || 0),
          price_pesos: Number(row.price_pesos || 0),
          cantidad_vendida: Number(row.cantidad_vendida || 0),
          stock_restante: Number(row.stock_restante || 0),
          recaudado_por_tipo: Number(row.recaudado_por_tipo || 0)
        }))
      : [],
    salesFunnel: Array.isArray(payload?.salesFunnel)
      ? payload.salesFunnel.map(row => ({
          ...row,
          total_orders: Number(row.total_orders || 0)
        }))
      : [],
    ticketStatusBalance: Array.isArray(payload?.ticketStatusBalance)
      ? payload.ticketStatusBalance.map(row => ({
          ...row,
          total_count: Number(row.total_count || 0)
        }))
      : []
  }
}

export default function AdminReports() {
  const { id } = useParams()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [eventData, setEventData] = useState(null)
  const [summary, setSummary] = useState({
    totalTicketsSold: 0,
    totalCollected: 0,
    totalAvailableStock: 0,
    totalRemainingStock: 0
  })
  const [salesByType, setSalesByType] = useState([])
  const [salesFunnel, setSalesFunnel] = useState([])
  const [ticketStatusBalance, setTicketStatusBalance] = useState([])

  async function load() {
    try {
      setLoading(true)
      setError('')

      const [eventRes, reportRes] = await Promise.all([
        api.get(`/api/events/${id}`).catch(() => null),
        api.get(`/api/reports/events/${id}/summary`)
      ])

      const normalized = normalizeSummaryPayload(reportRes.data)

      setEventData(eventRes?.data || null)
      setSummary(normalized.summary)
      setSalesByType(normalized.salesByTicketType)
      setSalesFunnel(normalized.salesFunnel)
      setTicketStatusBalance(normalized.ticketStatusBalance)
    } catch (err) {
      console.error(err)
      setError(err?.response?.data?.message || 'No se pudieron cargar los informes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id])

  const funnelMap = useMemo(() => {
    const map = {}
    for (const row of salesFunnel) {
      map[row.order_status] = Number(row.total_orders || 0)
    }
    return map
  }, [salesFunnel])

  const balanceResume = useMemo(() => {
    let used = 0
    let notUsed = 0

    for (const row of ticketStatusBalance) {
      const count = Number(row.total_count || 0)
      if (row.usage_status === 'USED') used += count
      else notUsed += count
    }

    return { used, notUsed }
  }, [ticketStatusBalance])

  if (loading) return <div>Cargando informes...</div>

  if (error) {
    return (
      <div className="ticket-card">
        <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>
        <Link to="/admin">Volver</Link>
      </div>
    )
  }

  return (
    <div className="stack-lg">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="app-title">Informes del evento</h1>
          <div className="app-subtitle">{eventData?.name || `Evento #${id}`}</div>
        </div>
        {/* --- IGNORE --- 
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to={`/admin/events/${id}/sales`}>Ver ventas</Link>
          <Link to={`/admin/events/${id}/ticket-types`}>Tipos de ticket</Link>
          <Link to={`/admin/events/${id}/approvedorder`}>Órdenes pendientes</Link>
        </div>
        */}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div className="ticket-card">
          <div style={labelStyle}>Tickets vendidos</div>
          <div style={valueStyle}>{summary.totalTicketsSold}</div>
        </div>

        <div className="ticket-card">
          <div style={labelStyle}>Recaudado</div>
          <div style={valueStyle}>{formatMoney(summary.totalCollected)}</div>
        </div>

        <div className="ticket-card">
          <div style={labelStyle}>Stock total</div>
          <div style={valueStyle}>{summary.totalAvailableStock}</div>
        </div>

        <div className="ticket-card">
          <div style={labelStyle}>Stock restante</div>
          <div style={valueStyle}>{summary.totalRemainingStock}</div>
        </div>

        <div className="ticket-card">
          <div style={labelStyle}>Tickets usados</div>
          <div style={valueStyle}>{balanceResume.used}</div>
        </div>

        <div className="ticket-card">
          <div style={labelStyle}>Tickets no usados</div>
          <div style={valueStyle}>{balanceResume.notUsed}</div>
        </div>
      </div>

      <div className="ticket-card">
        <h2 style={{ marginTop: 0 }}>Ventas por tipo de ticket</h2>

        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Ticket</th>
                <th style={thStyle}>Estado</th>
                <th style={thStyle}>Precio</th>
                <th style={thStyle}>Stock total</th>
                <th style={thStyle}>Vendidos</th>
                <th style={thStyle}>Restante</th>
                <th style={thStyle}>Recaudado</th>
                <th style={thStyle}>Inicio ventas</th>
                <th style={thStyle}>Fin ventas</th>
              </tr>
            </thead>
            <tbody>
              {salesByType.length === 0 ? (
                <tr>
                  <td style={tdStyle} colSpan={9}>No hay datos</td>
                </tr>
              ) : (
                salesByType.map(row => (
                  <tr key={row.ticket_type_id}>
                    <td style={tdStyle}>{row.ticket_name}</td>
                    <td style={tdStyle}>{row.status}</td>
                    <td style={tdStyle}>{formatMoney(row.price_pesos)}</td>
                    <td style={tdStyle}>{row.stock_total}</td>
                    <td style={tdStyle}>{row.cantidad_vendida}</td>
                    <td style={tdStyle}>{row.stock_restante}</td>
                    <td style={tdStyle}>{formatMoney(row.recaudado_por_tipo)}</td>
                    <td style={tdStyle}>{formatDate(row.sales_start_at)}</td>
                    <td style={tdStyle}>{formatDate(row.sales_end_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="ticket-card">
        <h2 style={{ marginTop: 0 }}>Embudo de órdenes</h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          {['PENDING', 'PENDING_APPROVAL', 'PAID', 'CANCELLED', 'EXPIRED'].map(status => (
            <div key={status} className="ticket-card">
              <div style={labelStyle}>{status}</div>
              <div style={valueStyle}>{funnelMap[status] || 0}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="ticket-card">
        <h2 style={{ marginTop: 0 }}>Balance de tickets</h2>

        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Estado ticket</th>
                {/*
                  <th style={thStyle}>Uso</th>
                */}
                <th style={thStyle}>Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {ticketStatusBalance.length === 0 ? (
                <tr>
                  <td style={tdStyle} colSpan={3}>No hay datos</td>
                </tr>
              ) : (
                ticketStatusBalance.map((row, idx) => (
                  <tr key={`${row.ticket_status}-${row.usage_status}-${idx}`}>
                    <td style={tdStyle}>{row.ticket_status}</td>
                    {/*
                      <td style={tdStyle}>{row.usage_status}</td>
                    */}
                    <td style={tdStyle}>{row.total_count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const labelStyle = {
  fontSize: 13,
  opacity: 0.7,
  marginBottom: 8
}

const valueStyle = {
  fontSize: 28,
  fontWeight: 700
}

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse'
}

const thStyle = {
  textAlign: 'left',
  padding: 12,
  borderBottom: '1px solid #e5e7eb',
  background: '#f9fafb',
  fontSize: 14
}

const tdStyle = {
  padding: 12,
  borderBottom: '1px solid #e5e7eb',
  fontSize: 14
}
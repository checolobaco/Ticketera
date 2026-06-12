import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../../api'
import EventAdminMenu from '../../components/EventAdminMenu'

function formatMoney(value) {
  const n = Number(value || 0)
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(n)
}

function formatDate(value) {
  if (!value) return '�'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '�'
  return d.toLocaleString('es-CO')
}

function normalizeSummaryPayload(payload) {
  return {
    summary: {
      totalTicketsSold: Number(payload?.summary?.totalTicketsSold || 0),
      totalCollected: Number(payload?.summary?.totalCollected || 0),
      totalAvailableStock: Number(payload?.summary?.totalAvailableStock || 0),
      totalRemainingStock: Number(payload?.summary?.totalRemainingStock || 0),
      promoOrdersCount: Number(payload?.summary?.promoOrdersCount || 0),
      promoCodesUsedCount: Number(payload?.summary?.promoCodesUsedCount || 0),
      promoDiscountTotal: Number(payload?.summary?.promoDiscountTotal || 0),
      benefitTicketsCount: Number(payload?.summary?.benefitTicketsCount || 0),
      benefitClaimsCount: Number(payload?.summary?.benefitClaimsCount || 0),
      benefitUnitsTotal: Number(payload?.summary?.benefitUnitsTotal || 0),
      benefitUnitsRedeemed: Number(payload?.summary?.benefitUnitsRedeemed || 0),
      benefitUnitsPending: Number(payload?.summary?.benefitUnitsPending || 0)
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
      : [],
    promoCodeUsage: Array.isArray(payload?.promoCodeUsage)
      ? payload.promoCodeUsage.map(row => ({
          ...row,
          promo_code_id: Number(row.promo_code_id || 0),
          discount_value: Number(row.discount_value || 0),
          discount_cents: Number(row.discount_cents || 0),
          max_discount_cents: Number(row.max_discount_cents || 0),
          used_count: Number(row.used_count || 0),
          orders_count: Number(row.orders_count || 0),
          paid_orders_count: Number(row.paid_orders_count || 0),
          pending_approval_orders_count: Number(row.pending_approval_orders_count || 0),
          pending_orders_count: Number(row.pending_orders_count || 0),
          cancelled_orders_count: Number(row.cancelled_orders_count || 0),
          total_discount_cents: Number(row.total_discount_cents || 0),
          benefit_tickets_count: Number(row.benefit_tickets_count || 0),
          benefit_units_total: Number(row.benefit_units_total || 0),
          benefit_units_redeemed: Number(row.benefit_units_redeemed || 0),
          benefit_units_pending: Number(row.benefit_units_pending || 0)
        }))
      : [],
    benefitUsage: Array.isArray(payload?.benefitUsage)
      ? payload.benefitUsage.map(row => ({
          ...row,
          promo_code_id: Number(row.promo_code_id || 0),
          benefit_id: Number(row.benefit_id || 0),
          quantity_per_ticket: Number(row.quantity_per_ticket || 0),
          tickets_with_benefit: Number(row.tickets_with_benefit || 0),
          total_units: Number(row.total_units || 0),
          redeemed_units: Number(row.redeemed_units || 0),
          pending_units: Number(row.pending_units || 0)
        }))
      : []
  }
}

function formatDiscountLabel(row) {
  if (row.discount_type === 'PERCENT') {
    return `${Number(row.discount_value || 0)}%`
  }
  return formatMoney(Math.round(Number(row.discount_cents || 0) / 100))
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
    totalRemainingStock: 0,
    promoOrdersCount: 0,
    promoCodesUsedCount: 0,
    promoDiscountTotal: 0,
    benefitTicketsCount: 0,
    benefitClaimsCount: 0,
    benefitUnitsTotal: 0,
    benefitUnitsRedeemed: 0,
    benefitUnitsPending: 0
  })
  const [salesByType, setSalesByType] = useState([])
  const [salesFunnel, setSalesFunnel] = useState([])
  const [ticketStatusBalance, setTicketStatusBalance] = useState([])
  const [promoCodeUsage, setPromoCodeUsage] = useState([])
  const [benefitUsage, setBenefitUsage] = useState([])

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
      setPromoCodeUsage(normalized.promoCodeUsage)
      setBenefitUsage(normalized.benefitUsage)
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

        <EventAdminMenu eventId={id} />
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

        <div className="ticket-card">
          <div style={labelStyle}>Ordenes con promo</div>
          <div style={valueStyle}>{summary.promoOrdersCount}</div>
        </div>

        <div className="ticket-card">
          <div style={labelStyle}>Codigos usados</div>
          <div style={valueStyle}>{summary.promoCodesUsedCount}</div>
        </div>

        <div className="ticket-card">
          <div style={labelStyle}>Descuento otorgado</div>
          <div style={valueStyle}>{formatMoney(summary.promoDiscountTotal)}</div>
        </div>

        <div className="ticket-card">
          <div style={labelStyle}>Tickets con beneficios</div>
          <div style={valueStyle}>{summary.benefitTicketsCount}</div>
        </div>

        <div className="ticket-card">
          <div style={labelStyle}>Beneficios redimidos</div>
          <div style={valueStyle}>{summary.benefitUnitsRedeemed}</div>
        </div>

        <div className="ticket-card">
          <div style={labelStyle}>Beneficios pendientes</div>
          <div style={valueStyle}>{summary.benefitUnitsPending}</div>
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
        <h2 style={{ marginTop: 0 }}>Codigos promocionales</h2>

        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Codigo</th>
                <th style={thStyle}>Descuento</th>
                <th style={thStyle}>Ordenes</th>
                <th style={thStyle}>Pagadas</th>
                <th style={thStyle}>Pend. aprobacion</th>
                <th style={thStyle}>Pendientes</th>
                <th style={thStyle}>Canceladas</th>
                <th style={thStyle}>Used count</th>
                <th style={thStyle}>Descuento total</th>
                <th style={thStyle}>Tickets con beneficio</th>
                <th style={thStyle}>Redimidos</th>
                <th style={thStyle}>Pendientes</th>
              </tr>
            </thead>
            <tbody>
              {promoCodeUsage.length === 0 ? (
                <tr>
                  <td style={tdStyle} colSpan={12}>No hay codigos promocionales para este evento.</td>
                </tr>
              ) : (
                promoCodeUsage.map(row => (
                  <tr key={row.promo_code_id}>
                    <td style={tdStyle}>{row.code}</td>
                    <td style={tdStyle}>{formatDiscountLabel(row)}</td>
                    <td style={tdStyle}>{row.orders_count}</td>
                    <td style={tdStyle}>{row.paid_orders_count}</td>
                    <td style={tdStyle}>{row.pending_approval_orders_count}</td>
                    <td style={tdStyle}>{row.pending_orders_count}</td>
                    <td style={tdStyle}>{row.cancelled_orders_count}</td>
                    <td style={tdStyle}>{row.used_count}</td>
                    <td style={tdStyle}>{formatMoney(Math.round(row.total_discount_cents / 100))}</td>
                    <td style={tdStyle}>{row.benefit_tickets_count}</td>
                    <td style={tdStyle}>{row.benefit_units_redeemed}</td>
                    <td style={tdStyle}>{row.benefit_units_pending}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="ticket-card">
        <h2 style={{ marginTop: 0 }}>Beneficios canjeables</h2>

        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Codigo promo</th>
                <th style={thStyle}>Beneficio</th>
                <th style={thStyle}>Activo</th>
                <th style={thStyle}>Cant. por ticket</th>
                <th style={thStyle}>Tickets</th>
                <th style={thStyle}>Total unidades</th>
                <th style={thStyle}>Redimidas</th>
                <th style={thStyle}>Pendientes</th>
              </tr>
            </thead>
            <tbody>
              {benefitUsage.length === 0 ? (
                <tr>
                  <td style={tdStyle} colSpan={8}>No hay beneficios configurados para este evento.</td>
                </tr>
              ) : (
                benefitUsage.map(row => (
                  <tr key={row.benefit_id}>
                    <td style={tdStyle}>{row.promo_code}</td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600 }}>{row.benefit_name}</div>
                      {row.benefit_description ? (
                        <div style={{ color: '#6b7280', fontSize: 12 }}>{row.benefit_description}</div>
                      ) : null}
                    </td>
                    <td style={tdStyle}>{row.active ? 'Si' : 'No'}</td>
                    <td style={tdStyle}>{row.quantity_per_ticket}</td>
                    <td style={tdStyle}>{row.tickets_with_benefit}</td>
                    <td style={tdStyle}>{row.total_units}</td>
                    <td style={tdStyle}>{row.redeemed_units}</td>
                    <td style={tdStyle}>{row.pending_units}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="ticket-card">
        <h2 style={{ marginTop: 0 }}>Embudo de ordenes</h2>

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
                <th style={thStyle}>Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {ticketStatusBalance.length === 0 ? (
                <tr>
                  <td style={tdStyle} colSpan={2}>No hay datos</td>
                </tr>
              ) : (
                ticketStatusBalance.map((row, idx) => (
                  <tr key={`${row.ticket_status}-${row.usage_status}-${idx}`}>
                    <td style={tdStyle}>{row.ticket_status}</td>
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
  fontSize: 14,
  verticalAlign: 'top'
}

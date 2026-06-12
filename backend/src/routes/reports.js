const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

async function canViewEventReports(req, eventId) {
  const user = req.user;

  if (!user) return false;
  if (user.role === 'ADMIN') return true;

  const ownerCheck = await db.query(
    `
    SELECT id
    FROM events
    WHERE id = $1
      AND created_by_user_id = $2
    LIMIT 1
    `,
    [eventId, user.id]
  );

  if (ownerCheck.rows.length) return true;

  const staffCheck = await db.query(
    `
    SELECT 1
    FROM event_staff
    WHERE event_id = $1
      AND user_id = $2
    LIMIT 1
    `,
    [eventId, user.id]
  );

  return staffCheck.rows.length > 0;
}

router.get(
  '/events/:eventId/sales-by-ticket-type',
  auth(['ADMIN', 'STAFF']),
  async (req, res) => {
    try {
      const eventId = Number(req.params.eventId);
      if (!eventId) {
        return res.status(400).json({ message: 'eventId inválido' });
      }

      const allowed = await canViewEventReports(req, eventId);
      if (!allowed) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const result = await db.query(
        `
        SELECT
          event_id,
          ticket_type_id,
          ticket_name,
          status,
          stock_total,
          price_pesos,
          sales_start_at,
          sales_end_at,
          cantidad_vendida,
          stock_restante,
          recaudado_por_tipo
        FROM view_report_sales_by_ticket_type
        WHERE event_id = $1
        ORDER BY ticket_name ASC
        `,
        [eventId]
      );

      res.json(result.rows);
    } catch (error) {
      console.error('GET /reports/events/:eventId/sales-by-ticket-type', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }
);

router.get(
  '/events/:eventId/sales-funnel',
  auth(['ADMIN', 'STAFF']),
  async (req, res) => {
    try {
      const eventId = Number(req.params.eventId);
      if (!eventId) {
        return res.status(400).json({ message: 'eventId inválido' });
      }

      const allowed = await canViewEventReports(req, eventId);
      if (!allowed) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const result = await db.query(
        `
        SELECT
          event_id,
          order_status,
          total_orders
        FROM view_report_sales_funnel
        WHERE event_id = $1
        ORDER BY order_status ASC
        `,
        [eventId]
      );

      res.json(result.rows);
    } catch (error) {
      console.error('GET /reports/events/:eventId/sales-funnel', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }
);

router.get(
  '/events/:eventId/ticket-status-balance',
  auth(['ADMIN', 'STAFF']),
  async (req, res) => {
    try {
      const eventId = Number(req.params.eventId);
      if (!eventId) {
        return res.status(400).json({ message: 'eventId inválido' });
      }

      const allowed = await canViewEventReports(req, eventId);
      if (!allowed) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const result = await db.query(
        `
        SELECT
          event_id,
          ticket_status,
          usage_status,
          total_count
        FROM view_report_ticket_status_balance
        WHERE event_id = $1
        ORDER BY ticket_status ASC, usage_status ASC
        `,
        [eventId]
      );

      res.json(result.rows);
    } catch (error) {
      console.error('GET /reports/events/:eventId/ticket-status-balance', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }
);

router.get(
  '/events/:eventId/summary',
  auth(['ADMIN', 'STAFF']),
  async (req, res) => {
    try {
      const eventId = Number(req.params.eventId);
      if (!eventId) {
        return res.status(400).json({ message: 'eventId inválido' });
      }

      const allowed = await canViewEventReports(req, eventId);
      if (!allowed) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const [salesByType, funnel, balance, promoSummary, promoUsage, benefitUsage] = await Promise.all([
        db.query(
          `
          SELECT *
          FROM view_report_sales_by_ticket_type
          WHERE event_id = $1
          `,
          [eventId]
        ),
        db.query(
          `
          SELECT *
          FROM view_report_sales_funnel
          WHERE event_id = $1
          `,
          [eventId]
        ),
        db.query(
          `
          SELECT *
          FROM view_report_ticket_status_balance
          WHERE event_id = $1
          `,
          [eventId]
        ),
        db.query(
          `
          WITH event_orders AS (
            SELECT DISTINCT
              o.id,
              o.status,
              o.promo_code_id,
              o.promo_code,
              COALESCE(o.promo_discount_cents, 0) AS promo_discount_cents
            FROM orders o
            JOIN order_items oi ON oi.order_id = o.id
            JOIN ticket_types tt ON tt.id = oi.ticket_type_id
            WHERE tt.event_id = $1
          ),
          event_tickets AS (
            SELECT
              t.id,
              o.promo_code_id
            FROM tickets t
            JOIN orders o ON o.id = t.order_id
            JOIN ticket_types tt ON tt.id = t.ticket_type_id
            WHERE tt.event_id = $1
          ),
          benefit_claims AS (
            SELECT
              bc.id,
              bc.ticket_id,
              bc.total_quantity,
              bc.redeemed_quantity
            FROM ticket_benefit_claims bc
            JOIN event_tickets et ON et.id = bc.ticket_id
          )
          SELECT
            (SELECT COUNT(*) FROM event_orders WHERE promo_code_id IS NOT NULL) AS promo_orders_count,
            (SELECT COUNT(DISTINCT promo_code_id) FROM event_orders WHERE promo_code_id IS NOT NULL) AS promo_codes_used_count,
            (SELECT COALESCE(SUM(promo_discount_cents), 0) FROM event_orders WHERE promo_code_id IS NOT NULL) AS promo_discount_cents_total,
            (SELECT COUNT(DISTINCT ticket_id) FROM benefit_claims) AS benefit_tickets_count,
            (SELECT COUNT(*) FROM benefit_claims) AS benefit_claims_count,
            (SELECT COALESCE(SUM(total_quantity), 0) FROM benefit_claims) AS benefit_units_total,
            (SELECT COALESCE(SUM(redeemed_quantity), 0) FROM benefit_claims) AS benefit_units_redeemed,
            (SELECT COALESCE(SUM(GREATEST(0, total_quantity - redeemed_quantity)), 0) FROM benefit_claims) AS benefit_units_pending
          `,
          [eventId]
        ),
        db.query(
          `
          WITH event_orders AS (
            SELECT DISTINCT
              o.id,
              o.status,
              o.promo_code_id,
              o.promo_code,
              COALESCE(o.promo_discount_cents, 0) AS promo_discount_cents
            FROM orders o
            JOIN order_items oi ON oi.order_id = o.id
            JOIN ticket_types tt ON tt.id = oi.ticket_type_id
            WHERE tt.event_id = $1
              AND o.promo_code_id IS NOT NULL
          ),
          ticket_benefit_totals AS (
            SELECT
              o.promo_code_id,
              COUNT(DISTINCT t.id) AS benefit_tickets_count,
              COALESCE(SUM(bc.total_quantity), 0) AS benefit_units_total,
              COALESCE(SUM(bc.redeemed_quantity), 0) AS benefit_units_redeemed
            FROM tickets t
            JOIN orders o ON o.id = t.order_id
            JOIN ticket_types tt ON tt.id = t.ticket_type_id
            LEFT JOIN ticket_benefit_claims bc ON bc.ticket_id = t.id
            WHERE tt.event_id = $1
              AND o.promo_code_id IS NOT NULL
            GROUP BY o.promo_code_id
          )
          SELECT
            epc.id AS promo_code_id,
            epc.code,
            epc.discount_type,
            epc.discount_value,
            epc.discount_cents,
            epc.max_discount_cents,
            epc.used_count,
            COUNT(DISTINCT eo.id) AS orders_count,
            COUNT(DISTINCT eo.id) FILTER (WHERE eo.status = 'PAID') AS paid_orders_count,
            COUNT(DISTINCT eo.id) FILTER (WHERE eo.status = 'PENDING_APPROVAL') AS pending_approval_orders_count,
            COUNT(DISTINCT eo.id) FILTER (WHERE eo.status = 'PENDING') AS pending_orders_count,
            COUNT(DISTINCT eo.id) FILTER (WHERE eo.status = 'CANCELLED') AS cancelled_orders_count,
            COALESCE(SUM(eo.promo_discount_cents), 0) AS total_discount_cents,
            COALESCE(tbt.benefit_tickets_count, 0) AS benefit_tickets_count,
            COALESCE(tbt.benefit_units_total, 0) AS benefit_units_total,
            COALESCE(tbt.benefit_units_redeemed, 0) AS benefit_units_redeemed,
            GREATEST(0, COALESCE(tbt.benefit_units_total, 0) - COALESCE(tbt.benefit_units_redeemed, 0)) AS benefit_units_pending
          FROM event_promo_codes epc
          LEFT JOIN event_orders eo ON eo.promo_code_id = epc.id
          LEFT JOIN ticket_benefit_totals tbt ON tbt.promo_code_id = epc.id
          WHERE epc.event_id = $1
          GROUP BY
            epc.id,
            epc.code,
            epc.discount_type,
            epc.discount_value,
            epc.discount_cents,
            epc.max_discount_cents,
            epc.used_count,
            tbt.benefit_tickets_count,
            tbt.benefit_units_total,
            tbt.benefit_units_redeemed
          ORDER BY COUNT(DISTINCT eo.id) DESC, epc.code ASC
          `,
          [eventId]
        ),
        db.query(
          `
          WITH event_tickets AS (
            SELECT
              t.id,
              o.promo_code_id
            FROM tickets t
            JOIN orders o ON o.id = t.order_id
            JOIN ticket_types tt ON tt.id = t.ticket_type_id
            WHERE tt.event_id = $1
          )
          SELECT
            epc.id AS promo_code_id,
            epc.code AS promo_code,
            pcb.id AS benefit_id,
            pcb.benefit_name,
            pcb.benefit_description,
            pcb.quantity_per_ticket,
            pcb.active,
            COUNT(DISTINCT t.id) AS tickets_with_benefit,
            COALESCE(SUM(tbc.total_quantity), 0) AS total_units,
            COALESCE(SUM(tbc.redeemed_quantity), 0) AS redeemed_units,
            GREATEST(
              0,
              COALESCE(SUM(tbc.total_quantity), 0) - COALESCE(SUM(tbc.redeemed_quantity), 0)
            ) AS pending_units
          FROM event_promo_codes epc
          JOIN promo_code_benefits pcb
            ON pcb.promo_code_id = epc.id
          LEFT JOIN event_tickets t
            ON t.promo_code_id = epc.id
          LEFT JOIN ticket_benefit_claims tbc
            ON tbc.ticket_id = t.id
           AND tbc.promo_code_benefit_id = pcb.id
          WHERE epc.event_id = $1
          GROUP BY
            epc.id,
            epc.code,
            pcb.id,
            pcb.benefit_name,
            pcb.benefit_description,
            pcb.quantity_per_ticket,
            pcb.active
          ORDER BY epc.code ASC, pcb.benefit_name ASC
          `,
          [eventId]
        ),
      ]);

      const totalTicketsSold = salesByType.rows.reduce(
        (acc, row) => acc + Number(row.cantidad_vendida || 0),
        0
      );

      const totalCollected = salesByType.rows.reduce(
        (acc, row) => acc + Number(row.recaudado_por_tipo || 0),
        0
      );

      const totalAvailableStock = salesByType.rows.reduce(
        (acc, row) => acc + Number(row.stock_total || 0),
        0
      );

      const totalRemainingStock = salesByType.rows.reduce(
        (acc, row) => acc + Number(row.stock_restante || 0),
        0
      );

      const promoSummaryRow = promoSummary.rows[0] || {};

      res.json({
        summary: {
          totalTicketsSold,
          totalCollected,
          totalAvailableStock,
          totalRemainingStock,
          promoOrdersCount: Number(promoSummaryRow.promo_orders_count || 0),
          promoCodesUsedCount: Number(promoSummaryRow.promo_codes_used_count || 0),
          promoDiscountTotal: Math.round(Number(promoSummaryRow.promo_discount_cents_total || 0) / 100),
          benefitTicketsCount: Number(promoSummaryRow.benefit_tickets_count || 0),
          benefitClaimsCount: Number(promoSummaryRow.benefit_claims_count || 0),
          benefitUnitsTotal: Number(promoSummaryRow.benefit_units_total || 0),
          benefitUnitsRedeemed: Number(promoSummaryRow.benefit_units_redeemed || 0),
          benefitUnitsPending: Number(promoSummaryRow.benefit_units_pending || 0),
        },
        salesByTicketType: salesByType.rows,
        salesFunnel: funnel.rows,
        ticketStatusBalance: balance.rows,
        promoCodeUsage: promoUsage.rows,
        benefitUsage: benefitUsage.rows,
      });
    } catch (error) {
      console.error('GET /reports/events/:eventId/summary', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }
);

module.exports = router;

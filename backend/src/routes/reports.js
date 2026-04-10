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

      const [salesByType, funnel, balance] = await Promise.all([
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

      res.json({
        summary: {
          totalTicketsSold,
          totalCollected,
          totalAvailableStock,
          totalRemainingStock,
        },
        salesByTicketType: salesByType.rows,
        salesFunnel: funnel.rows,
        ticketStatusBalance: balance.rows,
      });
    } catch (error) {
      console.error('GET /reports/events/:eventId/summary', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }
);

module.exports = router;
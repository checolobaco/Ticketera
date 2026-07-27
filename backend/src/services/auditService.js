/**
 * auditService.js
 * FL4: Servicio para registrar acciones administrativas en admin_audit_log
 */

'use strict';

const db = require('../db');

/**
 * Registra una acción administrativa en la base de datos de auditoría.
 *
 * @param {object} opts
 * @param {number|null} [opts.userId]     - ID del administrador o usuario staff que realiza la acción
 * @param {string|null} [opts.userEmail]  - Email del usuario
 * @param {string}      opts.action       - Identificador de la acción (ej. 'APPROVE_ORDER', 'REJECT_ORDER', 'ADD_STAFF')
 * @param {string}      [opts.entityType] - Tipo de entidad afectada ('ORDER', 'EVENT', 'TICKET_TYPE', etc.)
 * @param {number|null} [opts.entityId]   - ID de la entidad
 * @param {object|null} [opts.details]    - Objeto JSON con detalles adicionales
 * @param {import('pg').PoolClient} [opts.client] - Opcional: cliente dentro de una transacción activa
 */
async function logAdminAction({
  userId = null,
  userEmail = null,
  action,
  entityType = null,
  entityId = null,
  details = null,
  client = null
}) {
  const queryFn = client ? client.query.bind(client) : db.query.bind(db);

  try {
    await queryFn(
      `INSERT INTO admin_audit_log (
        user_id,
        user_email,
        action,
        entity_type,
        entity_id,
        details
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId ? Number(userId) : null,
        userEmail ? String(userEmail) : null,
        String(action),
        entityType ? String(entityType) : null,
        entityId ? Number(entityId) : null,
        details ? JSON.stringify(details) : null
      ]
    );
  } catch (err) {
    console.error('❌ Error registrando audit log:', err.message);
  }
}

module.exports = { logAdminAction };

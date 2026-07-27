/**
 * promoService.js
 *
 * Servicio compartido para resolución de códigos promocionales.
 * Antes estaba duplicado en orders.js y checkout.js; ahora vive aquí.
 *
 * Exporta:
 *   resolvePromoDiscount({ client, eventId, promoCode, subtotalCents, lockRow? })
 */

'use strict';

function normalizePromoCode(code) {
  return String(code || '').trim().toUpperCase();
}

/**
 * Valida y calcula el descuento de un código promo para un subtotal dado.
 *
 * @param {object} opts
 * @param {import('pg').PoolClient} opts.client  - Cliente PG dentro de una transacción activa
 * @param {number}  opts.eventId                 - ID del evento
 * @param {string}  opts.promoCode               - Código introducido por el usuario (puede estar vacío)
 * @param {number}  opts.subtotalCents           - Subtotal en centavos ANTES del descuento
 * @param {boolean} [opts.lockRow=true]          - true → FOR UPDATE (al crear orden); false → solo lectura (preview)
 *
 * @returns {Promise<{
 *   promoId: number|null,
 *   normalizedCode: string,
 *   discountCents: number,
 *   applied: boolean,
 *   reservesUsage: boolean
 * }>}
 *
 * @throws 'PROMO_CODE_NOT_FOUND'
 * @throws 'PROMO_CODE_INACTIVE'
 * @throws 'PROMO_CODE_NOT_STARTED'
 * @throws 'PROMO_CODE_EXPIRED'
 * @throws 'PROMO_CODE_MIN_ORDER_NOT_MET'
 * @throws 'PROMO_CODE_EXHAUSTED'
 * @throws 'PROMO_CODE_INVALID_CONFIG'
 */
async function resolvePromoDiscount({ client, eventId, promoCode, subtotalCents, lockRow = true }) {
  const normalizedCode = normalizePromoCode(promoCode);

  // Sin código → sin descuento, sin error
  if (!normalizedCode) {
    return {
      promoId: null,
      normalizedCode: '',
      discountCents: 0,
      applied: false,
      reservesUsage: false,
    };
  }

  const lockClause = lockRow ? 'FOR UPDATE' : '';

  const { rows } = await client.query(
    `SELECT
       id,
       event_id,
       code,
       discount_type,
       discount_value,
       discount_cents,
       max_discount_cents,
       min_order_cents,
       starts_at,
       ends_at,
       max_uses,
       used_count,
       active
     FROM event_promo_codes
     WHERE event_id = $1
       AND UPPER(code) = $2
     ${lockClause}
     LIMIT 1`,
    [eventId, normalizedCode]
  );

  if (!rows.length) throw new Error('PROMO_CODE_NOT_FOUND');

  const promo = rows[0];

  // Contar beneficios activos asociados al código
  const { rows: benefitRows } = await client.query(
    `SELECT COUNT(*)::int AS count
       FROM promo_code_benefits
      WHERE promo_code_id = $1
        AND active = true`,
    [promo.id]
  );

  // ── Validaciones ──────────────────────────────────────────────────────────
  if (!promo.active) throw new Error('PROMO_CODE_INACTIVE');

  const now = new Date();
  if (promo.starts_at && now < new Date(promo.starts_at)) throw new Error('PROMO_CODE_NOT_STARTED');
  if (promo.ends_at   && now > new Date(promo.ends_at))   throw new Error('PROMO_CODE_EXPIRED');

  const minOrderCents = Number(promo.min_order_cents || 0);
  if (subtotalCents < minOrderCents) throw new Error('PROMO_CODE_MIN_ORDER_NOT_MET');

  const maxUses   = promo.max_uses == null ? null : Number(promo.max_uses);
  const usedCount = Number(promo.used_count || 0);
  if (maxUses !== null && usedCount >= maxUses) throw new Error('PROMO_CODE_EXHAUSTED');

  // ── Cálculo de descuento ──────────────────────────────────────────────────
  const discountType = String(promo.discount_type || '').toUpperCase();
  let discountCents = 0;

  if (discountType === 'PERCENT') {
    const pct = Number(promo.discount_value || 0);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) throw new Error('PROMO_CODE_INVALID_CONFIG');
    discountCents = Math.floor((subtotalCents * pct) / 100);
  } else if (discountType === 'FIXED') {
    const raw = promo.discount_cents != null ? promo.discount_cents : promo.discount_value;
    discountCents = Math.floor(Number(raw || 0));
  } else {
    throw new Error('PROMO_CODE_INVALID_CONFIG');
  }

  // Aplica cap de descuento máximo si existe
  const maxDiscountCents = promo.max_discount_cents == null ? null : Number(promo.max_discount_cents);
  if (maxDiscountCents !== null && Number.isFinite(maxDiscountCents)) {
    discountCents = Math.min(discountCents, Math.floor(maxDiscountCents));
  }

  // Nunca negativo ni mayor que el subtotal
  discountCents = Math.max(0, Math.min(subtotalCents, Math.floor(discountCents)));

  const activeBenefitCount = Number(benefitRows[0]?.count || 0);

  return {
    promoId: Number(promo.id),
    normalizedCode,
    discountCents,
    applied: discountCents > 0,
    reservesUsage: discountCents > 0 || activeBenefitCount > 0,
  };
}

module.exports = { resolvePromoDiscount };

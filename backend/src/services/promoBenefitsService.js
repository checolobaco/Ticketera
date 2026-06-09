const db = require('../db')

async function createTicketBenefitClaims({ client, ticketId, promoCodeId }) {
  if (!promoCodeId || !ticketId) return []

  const runner = client || db

  const { rows: benefits } = await runner.query(
    `
    SELECT id, benefit_name, benefit_description, quantity_per_ticket
    FROM promo_code_benefits
    WHERE promo_code_id = $1
      AND active = true
    ORDER BY id ASC
    `,
    [promoCodeId]
  )

  const created = []

  for (const benefit of benefits) {
    const { rows } = await runner.query(
      `
      INSERT INTO ticket_benefit_claims
      (
        ticket_id,
        promo_code_benefit_id,
        benefit_name,
        benefit_description,
        total_quantity,
        redeemed_quantity,
        status
      )
      VALUES ($1,$2,$3,$4,$5,0,'AVAILABLE')
      RETURNING *
      `,
      [
        ticketId,
        benefit.id,
        benefit.benefit_name,
        benefit.benefit_description || null,
        Number(benefit.quantity_per_ticket || 1)
      ]
    )

    created.push(rows[0])
  }

  return created
}

async function getTicketBenefitClaims(ticketId, client = db) {
  const { rows } = await client.query(
    `
    SELECT
      id,
      ticket_id,
      promo_code_benefit_id,
      benefit_name,
      benefit_description,
      total_quantity,
      redeemed_quantity,
      status,
      created_at,
      updated_at,
      redeemed_at
    FROM ticket_benefit_claims
    WHERE ticket_id = $1
    ORDER BY id ASC
    `,
    [ticketId]
  )

  return rows
}

async function redeemTicketBenefit({ client, ticketId, claimId }) {
  const { rows } = await client.query(
    `
    SELECT *
    FROM ticket_benefit_claims
    WHERE ticket_id = $1
      AND id = $2
    FOR UPDATE
    `,
    [ticketId, claimId]
  )

  if (!rows.length) {
    throw new Error('BENEFIT_NOT_FOUND')
  }

  const claim = rows[0]
  const total = Number(claim.total_quantity || 0)
  const redeemed = Number(claim.redeemed_quantity || 0)

  if (redeemed >= total) {
    throw new Error('BENEFIT_ALREADY_REDEEMED')
  }

  const nextRedeemed = redeemed + 1
  const nextStatus = nextRedeemed >= total ? 'REDEEMED' : 'PARTIAL'

  const { rows: updatedRows } = await client.query(
    `
    UPDATE ticket_benefit_claims
    SET
      redeemed_quantity = $2,
      status = $3,
      updated_at = now(),
      redeemed_at = CASE
        WHEN $4::boolean THEN now()
        ELSE redeemed_at
      END
    WHERE id = $1
    RETURNING *
    `,
    [claim.id, nextRedeemed, nextStatus, nextStatus === 'REDEEMED']
  )

  return updatedRows[0]
}

module.exports = {
  createTicketBenefitClaims,
  getTicketBenefitClaims,
  redeemTicketBenefit
}

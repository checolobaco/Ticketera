const express = require('express')
const router = express.Router()
const db = require('../db')
const auth = require('../middleware/auth')
const cryptoService = require('../services/cryptoService') // ✅ existe en tu proyecto
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const nodeCrypto = require('crypto')

function slugifyFolderName(name = '') {
  return String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80)
}

async function uploadEventImageToR2({ client, eventId, file, type }) {
  const bucket = process.env.R2_BUCKET_2
  const publicBase = process.env.R2_PUBLIC_BASE_URL_2

  if (!bucket) throw new Error('R2_BUCKET_2 missing')
  if (!publicBase) throw new Error('R2_PUBLIC_BASE_URL_2 missing')

  const { rows: [event] } = await client.query(
    `SELECT id, name FROM events WHERE id = $1 LIMIT 1`,
    [eventId]
  )

  if (!event) throw new Error('EVENT_NOT_FOUND')

  const folder = `${slugifyFolderName(event.name)}-${event.id}`

  const ext =
    file.mimetype === 'image/png' ? 'png' :
    file.mimetype === 'image/webp' ? 'webp' :
    file.mimetype === 'image/jpeg' ? 'jpg' :
    file.mimetype === 'image/jpg' ? 'jpg' :
    'jpg'

  const safeType = ['card', 'ticket', 'cover'].includes(type) ? type : 'card'
  const random = nodeCrypto.randomBytes(4).toString('hex')
  const key = `${folder}/event_${eventId}_${safeType}_${Date.now()}_${random}.${ext}`

  await r2.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype
  }))

  return { key, url: `${publicBase}/${key}` }
}

function makeShareSlug() {
  return Math.random().toString(36).slice(2, 12)
}

// ===== Multer (memory) para recibir imagen sin guardar en disco =====
const uploadReceipt = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 }, // 6MB
  fileFilter: (req, file, cb) => {
    const ok = ['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype);
    if (!ok) return cb(new Error('Solo PNG/JPG/WEBP'));
    cb(null, true);
  }
});

// ===== Cloudflare R2 (S3 compatible) =====
const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT, // ej: https://<accountid>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});
/**
 * GET /api/events
 * - Público: devuelve todos (con venue)
 * GET /api/events?mine=1 (requiere auth ADMIN/STAFF)
 * - ADMIN: todos
 * - STAFF: solo created_by_user_id = req.user.id
 */
router.get('/', async (req, res) => {
  try {
    const mine = String(req.query.mine || '') === '1'

    // mine=1 requiere auth
    if (mine) {
      const header = req.headers.authorization || ''
      const token = header.replace('Bearer ', '')
      if (!token) return res.status(401).json({ error: 'NO_TOKEN' })

      return auth(['ADMIN', 'STAFF'])(req, res, async () => {
        const q = req.user.role === 'ADMIN'
          ? `
            SELECT e.*, v.name as venue_name
            FROM events e
            LEFT JOIN venues v ON e.venue_id = v.id
            ORDER BY e.start_datetime DESC
          `
          : `
            SELECT e.*, v.name as venue_name
            FROM events e
            LEFT JOIN venues v ON e.venue_id = v.id
            WHERE e.created_by_user_id = $1
            ORDER BY e.start_datetime DESC
          `

        const params = req.user.role === 'ADMIN' ? [] : [req.user.id]
        const { rows } = await db.query(q, params)
        return res.json(rows)
      })
    }

    // público: solo activos y no expirados
    const { rows } = await db.query(`
      SELECT e.*, v.name as venue_name
      FROM events e
      LEFT JOIN venues v ON e.venue_id = v.id
      WHERE COALESCE(e.active, 1) = 1
        AND (
          e.end_datetime IS NULL
          OR e.end_datetime >= NOW()
        )
      ORDER BY e.start_datetime ASC
    `)

    return res.json(rows)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

/**
 * POST /api/events
 * Crea evento y guarda owner + share_slug 
 */
router.post('/', auth(['ADMIN', 'STAFF']), async (req, res) => {
  const {
    venue_id,
    name,
    description,
    start_datetime,
    end_datetime,
    image_url,
    cover_image_url,
    ticket_image_url,
    email_adm
  } = req.body

  if (!name || !start_datetime) {
    return res.status(400).json({ error: 'VALIDATION_ERROR' })
  }

  const share_slug = makeShareSlug()

  const { rows } = await db.query(
    `
    INSERT INTO events
    (
      venue_id,
      name,
      description,
      start_datetime,
      end_datetime,
      image_url,
      cover_image_url,
      ticket_image_url,
      email_adm,
      share_slug,
      created_by_user_id
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING *
    `,
    [
      venue_id || null,
      name,
      description || null,
      start_datetime,
      end_datetime || null,
      image_url || null,
      cover_image_url || null,
      ticket_image_url || null,
      email_adm || null,
      share_slug,
      req.user.id
    ]
  )

  return res.status(201).json(rows[0])
})

router.patch('/:id', auth(['ADMIN', 'STAFF']), async (req, res) => {
  try {
    const { id } = req.params
    const {
      venue_id,
      name,
      description,
      start_datetime,
      end_datetime,
      image_url,
      cover_image_url,
      ticket_image_url,
      email_adm
    } = req.body

    const ev = await db.query(
      'SELECT created_by_user_id FROM events WHERE id = $1',
      [id]
    )

    if (!ev.rowCount) return res.sendStatus(404)

    if (
      req.user.role !== 'ADMIN' &&
      Number(ev.rows[0].created_by_user_id) !== Number(req.user.id)
    ) {
      return res.sendStatus(403)
    }

    const { rows } = await db.query(
      `
      UPDATE events
      SET
        venue_id = COALESCE($1, venue_id),
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        start_datetime = COALESCE($4, start_datetime),
        end_datetime = COALESCE($5, end_datetime),
        image_url = COALESCE($6, image_url),
        cover_image_url = COALESCE($7, cover_image_url),
        ticket_image_url = COALESCE($8, ticket_image_url),
        email_adm = COALESCE($9, email_adm)
      WHERE id = $10
      RETURNING *
      `,
      [
        venue_id ?? null,
        name ?? null,
        description ?? null,
        start_datetime ?? null,
        end_datetime ?? null,
        image_url ?? null,
        cover_image_url ?? null,
        ticket_image_url ?? null,
        email_adm ?? null,
        id
      ]
    )

    return res.json(rows[0])
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

router.get('/:id/payment-config', auth(['ADMIN', 'STAFF', 'CLIENT']), async (req, res) => {
  try {
    const { id } = req.params

    const ev = await db.query(
      'SELECT created_by_user_id FROM events WHERE id = $1',
      [id]
    )

    if (!ev.rowCount) return res.sendStatus(404)

    const isAdmin = req.user.role === 'ADMIN'
    const isOwner = Number(ev.rows[0].created_by_user_id) === Number(req.user.id)

    const { rows } = await db.query(
      `
      SELECT
        event_id,
        environment,
        wompi_public_key,
        is_active,
        note,
        email_adm,
        bank_account,
        created_at,
        updated_at,
        enable_wompi,
        enable_manual,
        enable_receipt,
        CASE WHEN wompi_integrity_secret_enc IS NOT NULL THEN true ELSE false END AS has_wompi_integrity_secret,
        CASE WHEN wompi_private_key_enc IS NOT NULL THEN true ELSE false END AS has_wompi_private_key,
        CASE WHEN wompi_events_secret_enc IS NOT NULL THEN true ELSE false END AS has_wompi_events_secret
      FROM public.event_payment_config
      WHERE event_id = $1
      `,
      [id]
    )

    const config = rows[0] || {
      event_id: Number(id),
      environment: 'production',
      wompi_public_key: '',
      is_active: true,
      note: '',
      email_adm: '',
      bank_account: '',
      enable_wompi: false,
      enable_manual: false,
      enable_receipt: false,
      has_wompi_integrity_secret: false,
      has_wompi_private_key: false,
      has_wompi_events_secret: false
    }

    // ✅ ADMIN o dueño: vista completa de admin
    if (isAdmin || isOwner) {
      return res.json(config)
    }

    // ✅ CLIENT / otros: solo datos públicos para PurchasePage
    return res.json({
      event_id: config.event_id,
      is_active: config.is_active ?? true,
      enable_wompi: !!config.enable_wompi,
      enable_manual: !!config.enable_manual,
      enable_receipt: !!config.enable_receipt,
      note: config.note || '',
      bank_account: config.bank_account || ''
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

router.put('/:id/payment-config', auth(['ADMIN', 'STAFF']), async (req, res) => {
  try {
    const { id } = req.params
    const {
      environment,
      wompi_public_key,
      wompi_integrity_secret,
      wompi_private_key,
      wompi_events_secret,
      is_active,
      enable_wompi,
      enable_manual,
      enable_receipt,
      note,
      email_adm,
      bank_account
    } = req.body

    const ev = await db.query(
      'select created_by_user_id from events where id = $1',
      [id]
    )

    if (!ev.rowCount) return res.sendStatus(404)

    if (
      req.user.role !== 'ADMIN' &&
      Number(ev.rows[0].created_by_user_id) !== Number(req.user.id)
    ) {
      return res.sendStatus(403)
    }

    const existingRes = await db.query(
      `SELECT * FROM event_payment_config WHERE event_id = $1 LIMIT 1`,
      [id]
    )

    const existing = existingRes.rows[0] || null

    const normIntegrity = String(wompi_integrity_secret || '').trim()
    const normPrivate = String(wompi_private_key || '').trim()
    const normEvents = String(wompi_events_secret || '').trim()

    const encIntegrity = normIntegrity ? cryptoService.encrypt(normIntegrity) : null
    const encPrivate = normPrivate ? cryptoService.encrypt(normPrivate) : null
    const encEvents = normEvents ? cryptoService.encrypt(normEvents) : null

    const finalEnvironment =
      environment ??
      existing?.environment ??
      'production'

    const finalWompiPublicKey =
      wompi_public_key != null && String(wompi_public_key).trim() !== ''
        ? String(wompi_public_key).trim()
        : (existing?.wompi_public_key ?? '')

    const finalIsActive =
      is_active ?? existing?.is_active ?? true

    const finalEnableWompi =
      enable_wompi ?? existing?.enable_wompi ?? false

    const finalEnableManual =
      enable_manual ?? existing?.enable_manual ?? false

    const finalEnableReceipt =
      enable_receipt ?? existing?.enable_receipt ?? false

    const finalNote =
      note !== undefined ? note : (existing?.note ?? null)

    const finalEmailAdm =
      email_adm !== undefined ? email_adm : (existing?.email_adm ?? null)

    const finalBankAccount =
      bank_account !== undefined ? bank_account : (existing?.bank_account ?? null)

    await db.query(
      `
      INSERT INTO event_payment_config
      (
        event_id,
        environment,
        wompi_public_key,
        wompi_integrity_secret_enc,
        wompi_integrity_secret_iv,
        wompi_private_key_enc,
        wompi_private_key_iv,
        wompi_events_secret_enc,
        wompi_events_secret_iv,
        is_active,
        enable_wompi,
        enable_manual,
        enable_receipt,
        note,
        email_adm,
        bank_account
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      ON CONFLICT (event_id) DO UPDATE SET
        environment = EXCLUDED.environment,
        wompi_public_key = EXCLUDED.wompi_public_key,

        wompi_integrity_secret_enc = COALESCE(EXCLUDED.wompi_integrity_secret_enc, event_payment_config.wompi_integrity_secret_enc),
        wompi_integrity_secret_iv = COALESCE(EXCLUDED.wompi_integrity_secret_iv, event_payment_config.wompi_integrity_secret_iv),

        wompi_private_key_enc = COALESCE(EXCLUDED.wompi_private_key_enc, event_payment_config.wompi_private_key_enc),
        wompi_private_key_iv = COALESCE(EXCLUDED.wompi_private_key_iv, event_payment_config.wompi_private_key_iv),

        wompi_events_secret_enc = COALESCE(EXCLUDED.wompi_events_secret_enc, event_payment_config.wompi_events_secret_enc),
        wompi_events_secret_iv = COALESCE(EXCLUDED.wompi_events_secret_iv, event_payment_config.wompi_events_secret_iv),

        is_active = EXCLUDED.is_active,
        enable_wompi = EXCLUDED.enable_wompi,
        enable_manual = EXCLUDED.enable_manual,
        enable_receipt = EXCLUDED.enable_receipt,
        note = EXCLUDED.note,
        email_adm = EXCLUDED.email_adm,
        bank_account = EXCLUDED.bank_account,
        updated_at = now()
      `,
      [
        id,
        finalEnvironment,
        finalWompiPublicKey,
        encIntegrity?.data ?? null,
        encIntegrity?.iv ?? null,
        encPrivate?.data ?? null,
        encPrivate?.iv ?? null,
        encEvents?.data ?? null,
        encEvents?.iv ?? null,
        finalIsActive,
        finalEnableWompi,
        finalEnableManual,
        finalEnableReceipt,
        finalNote,
        finalEmailAdm,
        finalBankAccount
      ]
    )

    return res.sendStatus(204)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

router.get('/:id/sales-by-ticket-type', auth(['ADMIN', 'STAFF']), async (req, res) => {
  try {
    const { id } = req.params

    const ev = await db.query(
      'SELECT created_by_user_id FROM events WHERE id = $1',
      [id]
    )

    if (!ev.rowCount) return res.sendStatus(404)

    if (
      req.user.role !== 'ADMIN' &&
      Number(ev.rows[0].created_by_user_id) !== Number(req.user.id)
    ) {
      return res.sendStatus(403)
    }

    const { rows } = await db.query(
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
      FROM public.view_report_sales_by_ticket_type
      WHERE event_id = $1
      ORDER BY ticket_name ASC
      `,
      [id]
    )

    return res.json(rows)
  } catch (err) {
    console.error('GET /api/events/:id/sales-by-ticket-type error:', err)
    return res.status(500).json({
      error: 'SERVER_ERROR',
      detail: err.message
    })
  }
})

router.patch('/:id/upload-image', auth(['ADMIN', 'STAFF']), uploadReceipt.single('file'), async (req, res) => {
  try {
    const { id } = req.params
    const { type } = req.body // card | ticket | cover

    const ev = await db.query(
      'SELECT created_by_user_id FROM events WHERE id = $1',
      [id]
    )

    if (!ev.rowCount) return res.sendStatus(404)

    if (
      req.user.role !== 'ADMIN' &&
      Number(ev.rows[0].created_by_user_id) !== Number(req.user.id)
    ) {
      return res.sendStatus(403)
    }

    if (!req.file) {
      return res.status(400).json({ error: 'FILE_REQUIRED' })
    }

    const client = await db.getClient()

    try {
      await client.query('BEGIN')

      const safeType = ['card', 'ticket', 'cover'].includes(type) ? type : 'card'

      const { url: uploadedUrl, key } = await uploadEventImageToR2({
        client,
        eventId: Number(id),
        file: req.file,
        type: safeType
      })

      let column = 'image_url'
      if (safeType === 'ticket') column = 'ticket_image_url'
      if (safeType === 'cover') column = 'cover_image_url'

      const { rows } = await client.query(
        `
        UPDATE events
        SET ${column} = $1
        WHERE id = $2
        RETURNING id, image_url, cover_image_url, ticket_image_url
        `,
        [uploadedUrl, id]
      )

      await client.query('COMMIT')

      return res.json({
        ...rows[0],
        uploaded_key: key,
        uploaded_type: safeType
      })
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('UPLOAD_EVENT_IMAGE_ERROR:', {
      message: err.message,
      name: err.name,
      code: err.code,
      statusCode: err.$metadata?.httpStatusCode,
      stack: err.stack
    })

    return res.status(500).json({
      error: err.message,
      name: err.name,
      code: err.code,
      statusCode: err.$metadata?.httpStatusCode
    })
  }
})
router.get('/share/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const eventResult = await db.query(
      `
      SELECT
        e.id,
        e.name,
        e.description,
        e.start_datetime,
        e.end_datetime,
        e.image_url,
        e.cover_image_url,
        e.ticket_image_url,
        e.share_slug,
        e.email_adm
      FROM events e
      WHERE e.share_slug = $1
      LIMIT 1
      `,
      [slug]
    );

    if (!eventResult.rows.length) {
      return res.status(404).json({ message: 'Evento no encontrado' });
    }

    const event = eventResult.rows[0];

    const ticketTypesResult = await db.query(
      `
      SELECT
        id,
        event_id,
        name,
        price_cents,
        price_pesos,
        stock_total,
        status,
        sales_start_at,
        sales_end_at,
        created_at,
        updated_at
      FROM ticket_types
      WHERE event_id = $1
      ORDER BY created_at ASC, id ASC
      `,
      [event.id]
    );

    const paymentConfigResult = await db.query(
      `
      SELECT
        event_id,
        environment,
        is_active,
        enable_wompi,
        enable_manual,
        enable_receipt,
        note,
        email_adm,
        bank_account
      FROM event_payment_config
      WHERE event_id = $1
      LIMIT 1
      `,
      [event.id]
    );

    return res.json({
      event,
      ticketTypes: ticketTypesResult.rows,
      paymentConfig: paymentConfigResult.rows[0] || null
    });
  } catch (error) {
    console.error('GET /api/events/share/:slug error:', error);
    return res.status(500).json({ message: 'Error obteniendo evento compartido' });
  }
});

module.exports = router

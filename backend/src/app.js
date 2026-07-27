const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { port } = require('./config');
const db = require('./db');
const { initCronJobs } = require('./services/cronService');

const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const ticketTypeRoutes = require('./routes/ticketTypes');
const orderRoutes = require('./routes/orders');
const ticketRoutes = require('./routes/tickets');
const validateRoutes = require('./routes/validate');
const wompiWebhook = require('./routes/wompi_webhook');
const testR2Router = require('./routes/test-r2-endpoint');
const eventStaffRoutes = require('./routes/eventStaff');
const reportsRoutes = require('./routes/reports');
const eventPromoCodeRoutes = require('./routes/eventPromoCodes');
const whatsappRoutes = require('./routes/whatsapp');

const app = express();

// Necesario para que express-rate-limit lea req.ip correctamente detrás de proxies (ngrok, nginx, etc.)
app.set('trust proxy', 1);

// ── T2: Middleware de Logging Estructurado HTTP ──────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  next();
});
// ─────────────────────────────────────────────────────────────────────────────

// ── S3: Rate limiters ─────────────────────────────────────────────────────────

/** Login: 10 intentos por IP cada 15 min */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMIT_LOGIN', message: 'Demasiados intentos. Espera 15 minutos.' }
});

/** Registro: 5 cuentas nuevas por IP cada hora */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMIT_REGISTER', message: 'Demasiadas cuentas creadas. Espera 1 hora.' }
});

/** Checkout Wompi: 8 inicios de pago por IP por minuto */
const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMIT_CHECKOUT', message: 'Demasiadas solicitudes de pago. Intenta en un momento.' }
});

/** Validación QR: 60 escaneos por dispositivo/IP por minuto (escáner en puerta) */
const validateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMIT_VALIDATE', message: 'Límite de validaciones alcanzado.' }
});

// ─────────────────────────────────────────────────────────────────────────────

app.use('/test-r2', testR2Router);

app.use(cors());

app.use('/api/webhooks/wompi', express.raw({ type: 'application/json' }), wompiWebhook);

app.use(express.json());

// ── Rutas con rate limiting aplicado ────────────────────────────────────────
app.use('/api/auth/login',    loginLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/checkout/start', checkoutLimiter);
app.use('/api/validate-ticket', validateLimiter);

// ── Rutas normales ────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/ticket-types', ticketTypeRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/validate-ticket', validateRoutes);
app.use('/api/checkout', require('./routes/checkout'));
app.use('/api/eventstaff', eventStaffRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/events', eventPromoCodeRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/support', require('./routes/support'));

// ── T3: Real Healthcheck (Verifica conexión a la base de datos PostgreSQL) ──
app.get('/api/health', async (req, res) => {
  try {
    const start = Date.now();
    await db.query('SELECT 1');
    const latency = Date.now() - start;

    res.json({
      ok: true,
      db: 'up',
      latencyMs: latency,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ Healthcheck Error:', err.message);
    res.status(503).json({
      ok: false,
      db: 'down',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});
// ─────────────────────────────────────────────────────────────────────────────

// ── A4: Error handler global ──────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[GLOBAL_ERROR]', {
    method: req.method,
    path: req.path,
    message: err.message,
    stack: err.stack,
  });

  if (res.headersSent) return;

  const status = typeof err.status === 'number' ? err.status
               : typeof err.statusCode === 'number' ? err.statusCode
               : 500;

  res.status(status).json({
    error: err.message || 'SERVER_ERROR',
  });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[unhandledRejection]', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err.message, err.stack);
  setTimeout(() => process.exit(1), 1000).unref();
});

const { runAutoMigrations } = require('./db/autoMigrate');

// ── FL1: Iniciar Cron Job para cancelar órdenes expiradas ────────────────────
initCronJobs();

// ── Auto-Migración de BD en Producción / Railway ────────────────────────────
runAutoMigrations().then(() => {
  app.listen(port, '0.0.0.0', () => {
    console.log(`Backend escuchando en puerto ${port}`);
  });
}).catch(err => {
  console.error('Error durante auto-migraciones:', err);
  app.listen(port, '0.0.0.0', () => {
    console.log(`Backend escuchando en puerto ${port} (con advertencia de migración)`);
  });
});

require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

const defaultJwtSecret = 'super-secret-jwt';
const defaultTicketSecret = 'super-secret-ticket';
const defaultRefreshSecret = 'super-secret-refresh-jwt';

const jwtSecret = process.env.JWT_SECRET || defaultJwtSecret;
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || (process.env.JWT_SECRET ? `${process.env.JWT_SECRET}_refresh` : defaultRefreshSecret);
const ticketSecret = process.env.TICKET_SECRET || defaultTicketSecret;

// ── D1: Validación de Variables de Entorno al arranque ───────────────────────
const weakSecrets = ['jwt_secret_seguro_123', 'super-secret-jwt', 'secret', '123456', 'ticket_secret_seguro_123', 'super-secret-ticket'];

const requiredEnvVars = ['DATABASE_URL'];
const recommendedEnvVars = ['RESEND_API_KEY', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];

const missingRequired = requiredEnvVars.filter(v => !process.env[v]);
if (missingRequired.length > 0) {
  console.warn(`⚠️ ADVERTENCIA (D1): Faltan variables de entorno requeridas: ${missingRequired.join(', ')}`);
}

const missingRecommended = recommendedEnvVars.filter(v => !process.env[v]);
if (missingRecommended.length > 0) {
  console.warn(`ℹ️ INFORMACIÓN (D1): Variables opcionales no configuradas: ${missingRecommended.join(', ')}`);
}

if (isProduction) {
  if (weakSecrets.includes(jwtSecret) || jwtSecret.length < 32) {
    console.error('❌ ERROR CRÍTICO DE SEGURIDAD (S1): JWT_SECRET no es seguro para Producción. Debe tener al menos 32 caracteres.');
    process.exit(1);
  }

  if (weakSecrets.includes(ticketSecret) || ticketSecret.length < 32) {
    console.error('❌ ERROR CRÍTICO DE SEGURIDAD (S1): TICKET_SECRET no es seguro para Producción. Debe tener al menos 32 caracteres.');
    process.exit(1);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  port: process.env.PORT || 4000,
  jwtSecret,
  jwtRefreshSecret,
  ticketSecret,
  isProduction,
  supportEmail: process.env.SUPPORT_EMAIL || 'ronny.gar.gallego@gmail.com',
  db: {
    connectionString:
      process.env.DATABASE_URL ||
      'postgres://postgres:postgres@localhost:5432/ticketdb'
  }
};

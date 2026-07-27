/**
 * cronService.js
 * FL1: Cron Job para cancelar automáticamente órdenes WAITING_PAYMENT que han caducado (más de 48 horas sin pago).
 */

'use strict';

const db = require('../db');

async function cancelExpiredOrders() {
  try {
    const { rowCount } = await db.query(`
      UPDATE orders
         SET status = 'CANCELLED',
             payment_status = 'EXPIRED'
       WHERE status = 'WAITING_PAYMENT'
         AND created_at < NOW() - INTERVAL '48 hours'
    `);

    if (rowCount > 0) {
      console.log(`⏱️ [FL1 Cron] Canceladas ${rowCount} orden(es) en WAITING_PAYMENT con más de 48h.`);
    }
  } catch (err) {
    console.error('❌ [FL1 Cron Error] Fallo al cancelar órdenes expiradas:', err.message);
  }
}

function initCronJobs() {
  // Ejecutar una vez al arrancar el servidor
  cancelExpiredOrders();

  // Ejecutar periódicamente cada 1 hora (3600000 ms)
  const INTERVAL_MS = 60 * 60 * 1000;
  setInterval(cancelExpiredOrders, INTERVAL_MS);

  console.log('⏰ [FL1 Cron] Servicio de limpieza de órdenes expiradas activo (cada 1 hora).');
}

module.exports = {
  initCronJobs,
  cancelExpiredOrders
};

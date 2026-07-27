/**
 * api.test.js - T1: Tests automatizados para backend (HealthCheck, PromoService, Auth)
 */

'use strict';

const assert = require('assert');
const { resolvePromoDiscount } = require('../src/services/promoService');

async function runTests() {
  console.log('🧪 Iniciando ejecutor de pruebas automatizadas (T1)...\n');
  let passed = 0;
  let failed = 0;

  // Test 1: resolvePromoDiscount sin código devuelve 0 descuento
  try {
    const res = await resolvePromoDiscount({
      client: null,
      eventId: 1,
      promoCode: '',
      subtotalCents: 10000,
      lockRow: false
    });
    assert.strictEqual(res.discountCents, 0);
    assert.strictEqual(res.applied, false);
    console.log('✅ Test 1 PASÓ: resolvePromoDiscount sin código promocional retorna 0 descuento');
    passed++;
  } catch (err) {
    console.error('❌ Test 1 FALLÓ:', err.message);
    failed++;
  }

  // Test 2: resolvePromoDiscount lanza PROMO_CODE_NOT_FOUND para código inexistente con cliente mock
  try {
    const mockClient = {
      query: async () => ({ rows: [] })
    };
    await resolvePromoDiscount({
      client: mockClient,
      eventId: 1,
      promoCode: 'CODIGO_INEXISTENTE_9999',
      subtotalCents: 10000,
      lockRow: false
    });
    console.error('❌ Test 2 FALLÓ: Debería haber lanzado PROMO_CODE_NOT_FOUND');
    failed++;
  } catch (err) {
    if (err.message === 'PROMO_CODE_NOT_FOUND') {
      console.log('✅ Test 2 PASÓ: resolvePromoDiscount lanza PROMO_CODE_NOT_FOUND correctamente');
      passed++;
    } else {
      console.error('❌ Test 2 FALLÓ con error inesperado:', err.message);
      failed++;
    }
  }

  // Test 3: resolvePromoDiscount calcula porcentaje correctamente
  try {
    const mockClient = {
      query: async (sql) => {
        if (sql.includes('event_promo_codes')) {
          return {
            rows: [{
              id: 10,
              event_id: 1,
              code: 'DESCUENTO10',
              discount_type: 'PERCENT',
              discount_value: 10,
              active: true,
              starts_at: null,
              ends_at: null,
              min_order_cents: 0,
              max_uses: 100,
              used_count: 0
            }]
          };
        }
        return { rows: [{ count: 0 }] };
      }
    };

    const res = await resolvePromoDiscount({
      client: mockClient,
      eventId: 1,
      promoCode: 'DESCUENTO10',
      subtotalCents: 50000,
      lockRow: false
    });

    assert.strictEqual(res.discountCents, 5000);
    assert.strictEqual(res.applied, true);
    console.log('✅ Test 3 PASÓ: resolvePromoDiscount calcula 10% de descuento correctamente (5000 centavos de 50000)');
    passed++;
  } catch (err) {
    console.error('❌ Test 3 FALLÓ:', err.message);
    failed++;
  }

  console.log(`\n========================================`);
  console.log(`📊 Resultado de Pruebas: ${passed} PASARON, ${failed} FALLARON`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests();

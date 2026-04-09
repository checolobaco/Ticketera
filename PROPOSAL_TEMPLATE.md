# Propuesta Comercial - Ticketera (Evento Único)

**[Nombre del cliente]**

**Fecha:** ___

---

## 1. Resumen ejecutivo

Se propone la implementación y soporte de la plataforma Ticketera para un evento único. El servicio incluye despliegue completo en infraestructura en la nube, integración de pasarela de pagos Wompi, almacenamiento de comprobantes en Cloudflare R2 y soporte técnico antes y durante el evento.

---

## 2. Alcance de entregables

- Configuración de backend Node.js/Express en Railway.
- Base de datos PostgreSQL con script inicial (`sql/schema.sql`).
- Frontend React/Vite en Vercel, dominio personalizado.
- Integración Wompi Checkout y webhook en `/api/webhooks/wompi`.
- Carga de comprobantes mediante Cloudflare R2 (API S3 compatible).
- Creación y documentación de cuentas, variables de entorno.
- Pruebas end-to-end simulando venta de tickets.
- Soporte remoto post-lanzamiento (7 días incluidos).

---

## 3. Cronograma y plazos

1. **Inicio**: Firma de contrato y pago de anticipo.
2. **Configuración**: 2-3 días hábiles (Infraestructura y dominios).
3. **Integración y pruebas**: 3-4 días hábiles.
4. **Go‑live**: a más tardar [fecha del evento - X días].
5. **Soporte incluido**: 7 días después de la puesta en marcha.

---

## 4. Precio por rangos de asistentes

| Rango asistentes | Setup & Deploy | Cargo por ticket | Soporte (día evento) | % opcional | Ejemplo (tickets) |
|------------------|----------------|------------------|----------------------|------------|-------------------|
| 1 - 150          | 900.000 COP     | 400 COP          | 250.000 COP          | 5%         | 100 asistentes → 1.190.000 COP
| 151 - 300        | 1.200.000 COP   | 300 COP          | 300.000 COP          | 4.5%       | 225 asistentes → 1.567.500 COP
| 301 - 450        | 1.800.000 COP   | 250 COP          | 400.000 COP          | 4%         | 375 asistentes → 2.293.750 COP
| 451+             | 2.500.000 COP   | 200 COP          | 600.000 COP          | 3.5%       | 500 asistentes → 3.200.000 COP

> *Las comisiones Wompi (~2.040 COP por ticket de 50.000 COP) y cualquier cargo de R2 se trasladan al cliente o se facturan por separado.*

---

## 5. Condiciones de pago

- 50% del monto de Setup & Deploy al firmar el contrato.
- 50% restante antes del despliegue final (o 5 días antes de la fecha del evento).
- Los cargos por ticket y soporte se facturan mensualmente tras el evento.

---

## 6. Soporte y términos

- Soporte remoto 7 días incluidos tras go‑live.
- Horas adicionales: 80.000 COP/hora (facturadas en bloques de 1 hora).
- Soporte día del evento: tarifas según tabla anterior.
- Cambios fuera de alcance se cotizan por hora o en nuevos sprints.

---

## 7. Términos legales y seguridad

- El cliente proporciona acceso a métricas/ventas si se usa % opcional.
- Responsabilidad limitada: se garantiza disponibilidad, no ventas.
- Datos personales y de pagos se manejan conforme a la normativa vigente.
- Cualquier hardware (dominios, credenciales) queda bajo control del cliente.
- El proveedor no asume costos de pasarela (Wompi) ni almacenamiento (R2).

---

## 8. Vigencia de la oferta

Esta propuesta tiene validez de 30 días desde la fecha de emisión.

---

**Firma del cliente:** _______________________

**Firma del proveedor:** _____________________

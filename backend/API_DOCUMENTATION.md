# API de Ticketera (CloudTickets)

Este documento describe los endpoints disponibles en el backend de Ticketera, incluyendo flujos de autenticación, gestión de eventos, tipos de ticket, procesamiento de órdenes, validación en puerta, **envío automatizado por WhatsApp**, códigos promocionales con beneficios, gestión de staff, reportes y módulo de soporte.

También se incluye un archivo actualizado [POSTMAN_COLLECTION_COMPLETA.json](file:///c:/0DE/Ticketera/backend/POSTMAN_COLLECTION_COMPLETA.json) en la raíz del backend que puede importarse directamente en Postman.

> **Variables recomendadas en Postman:**
> - `baseUrl`: http://localhost:4000
> - `token`: JWT obtenido al iniciar sesión
> - `deviceApiKey`: API Key para dispositivos lectores de puerta
> - `eventId`, `ticketTypeId`, `orderId`, `ticketId`, `promoCodeId`

---

## 🔐 1. Autenticación (`/api/auth`)

### `POST /api/auth/register`
**Descripción**: Registra un nuevo usuario cliente y retorna token JWT.
**Body**:
```json
{
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "password": "password123"
}
```

### `POST /api/auth/login`
**Descripción**: Inicia sesión y devuelve un token JWT con el perfil del usuario (`ADMIN`, `STAFF`, `CLIENT`).
**Body**:
```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

---

## 🎪 2. Eventos (`/api/events`)

### `GET /api/events`
**Descripción**: Obtiene la lista pública de todos los eventos activos.

### `GET /api/events?mine=1` *(Requiere Token: ADMIN / STAFF)*
**Descripción**: Retorna únicamente los eventos creados por el usuario logueado o asignados al personal de staff.

### `POST /api/events` *(Requiere Token: ADMIN / STAFF)*
**Descripción**: Crea un nuevo evento en el sistema.
**Body**:
```json
{
  "name": "Concierto Rock 2026",
  "description": "Gran festival de música",
  "start_datetime": "2026-06-01T20:00:00Z",
  "end_datetime": "2026-06-02T02:00:00Z",
  "image_url": "https://r2.midominio.com/eventos/rock.jpg"
}
```

### `GET /api/events/:id/payment-config` *(Requiere Token: ADMIN / STAFF)*
**Descripción**: Obtiene la configuración de pasarela Wompi y métodos manuales de pago de un evento.

### `PUT /api/events/:id/payment-config` *(Requiere Token: ADMIN / STAFF)*
**Descripción**: Actualiza las llaves de Wompi y habilitación de pagos (Wompi, manual, transferencia con recibo).
**Body**:
```json
{
  "environment": "production",
  "wompi_public_key": "pub_prod_xxx",
  "wompi_integrity_secret": "prod_integrity_xxx",
  "wompi_events_secret": "prod_events_xxx",
  "is_active": true,
  "enable_wompi": true,
  "enable_manual": false,
  "enable_receipt": true
}
```

---

## 🎫 3. Tipos de Entrada / Ticket Types (`/api/ticket-types`)

### `GET /api/ticket-types?eventId=1`
**Descripción**: Obtiene los tipos de entradas configuradas para un evento específico.

### `POST /api/ticket-types` *(Requiere Token: ADMIN)*
**Descripción**: Crea una nueva localidad o tipo de entrada para un evento.
**Body**:
```json
{
  "event_id": 1,
  "name": "VIP Preferencial",
  "price_cents": 15000000,
  "price_pesos": 150000,
  "stock_total": 100,
  "sales_start_at": "2026-01-01T00:00:00Z",
  "sales_end_at": "2026-06-01T00:00:00Z",
  "status": "ACTIVE",
  "entry_deadline_time": "21:00:00",
  "lateness_surcharge_fee": 20000,
  "requires_admin_approval_if_late": true
}
```

### `PATCH /api/ticket-types/:id` *(Requiere Token: ADMIN)*
**Descripción**: Actualiza precios, stock, horarios o recargos por ingreso extemporáneo.

---

## 📦 4. Órdenes y Checkout (`/api/orders` y `/api/checkout`)

### `POST /api/orders` *(Requiere Token: ADMIN / STAFF / CLIENT)*
**Descripción**: Crea una orden pagada directamente (modo manual/efectivo) y genera los tickets con su correspondiente código QR.

### `POST /api/checkout/start` *(Requiere Token: CLIENT)*
**Descripción**: Inicia la transacción de compra integrada con la pasarela **Wompi**, retornando la URL de pago y firma de integridad.

### `GET /api/orders` *(Requiere Token: CLIENT / ADMIN)*
**Descripción**: Obtiene el historial de órdenes del comprador autenticado.

### `GET /api/orders/by-reference?ref=CT-1234567890-0001`
**Descripción**: Consulta el estado de una orden según su referencia única de pago.

### `GET /api/orders/by-reference/tickets?ref=CT-1234567890-0001`
**Descripción**: Retorna la orden junto con los tickets digitales asociados.

### `POST /api/orders/manual-reserve` *(Requiere Token)*
**Descripción**: Genera una reserva manual en estado `WAITING_PAYMENT` para pago por consignación/transferencia.

### `PATCH /api/orders/upload-receipt/:id` *(Multipart Form-Data)*
**Descripción**: Sube el comprobante de transferencia bancaria (campo `receipt`) a Cloudflare R2 y cambia la orden a `PENDING_APPROVAL`.

### `POST /api/orders/approve-order/:id` *(Requiere Token: ADMIN)*
**Descripción**: Aprueba manualmente la transferencia, emite los tickets digitales y dispara el envío automático por correo electrónico y WhatsApp.

### `POST /api/orders/:id/resend-email`
**Descripción**: Reenvía los tickets en PDF de toda la orden al correo especificado.

---

## 💬 5. Integración con Meta WhatsApp Cloud API (`/api/whatsapp`)

### `GET /api/whatsapp/webhook`
**Descripción**: Endpoint de verificación utilizado por Meta WhatsApp Cloud API para validar el Webhook (`hub.mode`, `hub.verify_token`, `hub.challenge`).

### `POST /api/whatsapp/webhook`
**Descripción**: Recepción en tiempo real de notificaciones de entrega, lectura y mensajes entrantes enviados por clientes a WhatsApp.

### `POST /api/whatsapp/send-pdf`
**Descripción**: Envía un archivo PDF vía WhatsApp directo (soporta mensajes de plantilla aprobada o sesión libre de 24 horas).
**Body**:
```json
{
  "to": "+573007811699",
  "pdfUrl": "https://r2.tudominio.com/tickets/10/ticket-1-ABC.pdf",
  "filename": "Ticket_VIP_1.pdf",
  "caption": "Aquí tienes tu entrada digital",
  "templateName": "envio_ticket_pdf",
  "templateLanguage": "es",
  "bodyParameters": ["Juan Pérez", "Concierto Rock 2026", "10"]
}
```

### `POST /api/whatsapp/send-order-tickets`
**Descripción**: Flujo automático de alta resolución: genera los PDF con Puppeteer, los sube a Cloudflare R2 y los envía por WhatsApp al comprador. Cuenta con control de idempotencia (`whatsapp_status = 'SENT'`).
**Body**:
```json
{
  "orderId": 10,
  "to": "+573007811699"
}
```

### `GET /api/whatsapp/debug-token`
**Descripción**: Endpoint de diagnóstico para verificar la validez del Token de Meta y el `Phone Number ID` / `WABA ID`.

### `GET /api/whatsapp/list-templates`
**Descripción**: Consulta el catálogo de plantillas aprobadas (ej. `envio_ticket_pdf`) y códigos de idioma configurados en Meta Developer Console.

---

## 🎟️ 6. Tickets y Reenvíos (`/api/tickets`)

### `GET /api/tickets/my` *(Requiere Token: CLIENT / STAFF / ADMIN)*
**Descripción**: Lista entradas del usuario o filtradas por eventos asignados para Staff.

### `GET /api/tickets/search?q=texto` *(Requiere Token: ADMIN / STAFF)*
**Descripción**: Búsqueda rápida por nombre de comprador, email, teléfono, cédula, nombre de evento o código único.

### `GET /api/tickets/:id`
**Descripción**: Obtiene la información detallada de una entrada.

### `PATCH /api/tickets/:id/assign-nfc` *(Requiere Token: ADMIN / STAFF)*
**Descripción**: Asigna el UID del chip/pulsera NFC a un ticket.
**Body**: `{ "nfc_uid": "04A1B2C3D4E5" }`

### `POST /api/tickets/:id/resend-email`
**Descripción**: Reenvía la entrada digital por correo electrónico.

### `POST /api/tickets/:id/resend-whatsapp` *(Requiere Token)*
**Descripción**: Reenvía la entrada digital en formato PDF por WhatsApp.
**Body**:
```json
{
  "toPhone": "+573007811699"
}
```

### `POST /api/tickets/bulk-resend-email`
**Descripción**: Envía múltiples tickets en un solo correo agrupado.

---

## 🏷️ 7. Códigos Promocionales y Beneficios (`/api/events/:eventId/promo-codes`)

### `GET /api/events/:eventId/promo-codes` *(ADMIN / STAFF)*
**Descripción**: Lista los códigos de descuento activos del evento junto con sus beneficios incluidos.

### `POST /api/events/:eventId/promo-codes` *(ADMIN / STAFF)*
**Descripción**: Crea un código de descuento porcentual (`PERCENT`) o monto fijo (`FIXED`).
**Body**:
```json
{
  "code": "PROMO2026",
  "discount_type": "PERCENT",
  "discount_value": 15,
  "max_uses": 100,
  "starts_at": "2026-02-01T00:00:00Z",
  "ends_at": "2026-05-01T00:00:00Z",
  "active": true
}
```

### `POST /api/events/:eventId/promo-codes/:promoCodeId/benefits` *(ADMIN / STAFF)*
**Descripción**: Agrega un beneficio de cortesía (ej. "Cerveza de Bienvenida", "Camiseta Oficial") asociado a un código promocional.

### `GET /api/tickets/:id/benefits`
**Descripción**: Consulta los beneficios asignados a una entrada.

### `POST /api/tickets/:id/benefits/:claimId/redeem` *(ADMIN / STAFF)*
**Descripción**: Canjea en punto de entrega (bar/merch) un beneficio de la entrada.

---

## 📊 8. Reportes y Métricas (`/api/reports`)

### `GET /api/reports/events/:eventId/summary` *(ADMIN / STAFF)*
**Descripción**: Reporte gerencial consolidado con métricas de dinero recaudado, tickets vendidos, balance de uso en puerta, efectividad de códigos promocionales, canje de beneficios y registro de **ingresos extemporáneos con recargo/multa**.

### `GET /api/reports/events/:eventId/sales-by-ticket-type` *(ADMIN / STAFF)*
**Descripción**: Ventas por cada tipo de entrada/localidad.

### `GET /api/reports/events/:eventId/sales-funnel` *(ADMIN / STAFF)*
**Descripción**: Embudos de conversión (órdenes iniciadas vs pagadas vs pendientes).

---

## ✅ 9. Validación en Puerta (`/api/validate-ticket`)

### `POST /api/validate-ticket`
**Header**: `x-api-key: {{deviceApiKey}}`
**Body**:
```json
{
  "payload": {
    "t": "TICKET",
    "tid": "550e8400-e29b-41d4-a716-446655440000",
    "eid": 1,
    "sig": "VALOR_SIGNATURE_REAL_DEL_TICKET"
  }
}
```
**Respuesta**: Devuelve si el ticket es válido (`valid: true`), ya fue usado (`ALREADY_USED`) o si aplica recargo por ingreso extemporáneo.

---

## 💬 10. Soporte y Auditoría (`/api/support`)

### `POST /api/support/contact`
**Descripción**: Envia mensajes desde el formulario de soporte/atención al cliente. Registra IP, geolocalización (Ciudad/País/ISP), metadatos técnicos y notifica al correo del administrador.

---

## 🪝 11. Webhook de Pasarela Wompi (`/api/webhooks/wompi`)

### `POST /api/webhooks/wompi`
**Descripción**: Receptor oficial de eventos de pago de Wompi. Valida automáticamente la firma SHA-256 (`WOMPI_EVENTS_SECRET`), aprueba las órdenes y emite los tickets.

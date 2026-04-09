# API de Ticketera

Este documento describe los endpoints disponibles en el backend de Ticketera. También se incluye un archivo `postman_collection.json` en la raíz del backend que puede importarse directamente en Postman para probar cada ruta.

> **Variables de ambiente recomendadas en Postman**
> - `baseUrl`: http://localhost:3000 (ajusta según tu servidor)
> - `token`: token JWT obtenido al iniciar sesión
> - `eventId`, `ticketTypeId`, `orderId`, `ticketId`, `reference`, `query`, `deviceKey`: valores de ejemplo usados en distintos requests

----

## Autenticación

### POST `/api/auth/login`
**Descripción**: devuelve un JWT si las credenciales son válidas.
**Body**:
```json
{ "email": "user@example.com", "password": "secret123" }
```
**Respuesta exitosa**:
```json
{ "token": "ey...", "user": { "id": 1, "name": "Nombre", "role": "CLIENT" } }
```


### POST `/api/auth/register`
**Descripción**: crea un usuario cliente y retorna token.
**Body**:
```json
{ "name": "John Doe", "email": "john@example.com", "password": "changeMe" }
```


## Eventos

> Todos los endpoints relacionados con eventos usan el prefijo `/api/events`.

### GET `/api/events`
Listado público de todos los eventos.

### GET `/api/events?mine=1`
Devuelve eventos creados por el usuario logueado. Requiere rol `ADMIN` o `STAFF` y el header `Authorization: Bearer {{token}}`.

### POST `/api/events`
Crear un evento (roles `ADMIN` o `STAFF`).

**Body**:
```json
{
  "name": "Concierto Demo",
  "description": "Evento de prueba",
  "start_datetime": "2026-05-01T20:00:00Z",
  "end_datetime": "2026-05-01T23:00:00Z",
  "image_url": "https://example.com/img.jpg"
}
```

### PUT `/api/events/:id/payment-config`
Guarda o actualiza configuración de pago Wompi del evento.

**Body** ejemplo:
```json
{
  "environment": "production",
  "wompi_public_key": "pub_live_xxx",
  "wompi_integrity_secret": "secret",
  "wompi_private_key": "priv_xxx",
  "is_active": true
}
```

## Tipos de entrada (ticket types)

### GET `/api/ticket-types`?
Opcional query param `eventId`. Devuelve tipos de tickets.

### POST `/api/ticket-types` (ADMIN)
Crea un nuevo tipo de ticket.

**Body**:
```json
{
  "event_id": 1,
  "name": "General",
  "price_cents": 50000,
  "stock_total": 100
}
```

## Órdenes

### POST `/api/orders` (ADMIN/STAFF/CLIENT)
Crea una orden ya pagada (status `PAID`) y genera los tickets.

**Body**:
```json
{
  "customer": { "name": "Cliente Demo", "email": "demo@example.com", "cc": "1234567" },
  "items": [ { "ticketTypeId": 2, "quantity": 2 } ]
}
```

**Respuesta** contiene la orden y el array de tickets creados.

---

### GET `/api/orders`
Lista las órdenes del usuario autenticado.

### POST `/api/orders/checkout` (CLIENT)
Inicia el flujo de checkout en Wompi y devuelve la URL.

**Body**:
```json
{
  "customer": { "name": "Cliente Demo", "email": "demo@example.com" },
  "items": [ { "ticketTypeId": 2, "quantity": 1 } ]
}
```

### GET `/api/orders/by-reference?ref={{reference}}`
Recupera datos de orden por su referencia de pago.

### GET `/api/orders/by-reference/tickets?ref={{reference}}`
Trae orden + tickets asociados. Devuelve 202 si aún no está paga.

### POST `/api/orders/:id/resend-email`
Reenvía el correo de tickets; se puede pasar `toEmail` en el body.

**Body** ejemplo:
```json
{ "toEmail": "otra@correo.com" }
```

### POST `/api/orders/manual-reserve` (client/staff/admin)
Crea una orden con estado `WAITING_PAYMENT` y genera filas en `order_items`.

**Body**:
```json
{
  "buyer_name": "Reservas SA",
  "buyer_email": "reserva@example.com",
  "items": [ { "ticket_type_id": 2, "quantity": 3 } ]
}
```

### PATCH `/api/orders/upload-receipt/:id`
Sube comprobante (multipart/form-data, campo `receipt`) y mueve orden a `PENDING_APPROVAL`.

### POST `/api/orders/approve-order/:id` (ADMIN)
Aprueba la orden manualmente, genera tickets faltantes y envía correo.

## Tickets

### GET `/api/tickets/my`
Lista tickets del usuario (CLIENT) o todos si eres STAFF/ADMIN.

### GET `/api/tickets/search?q=texto` (ADMIN/STAFF)
Busca tickets por holder, evento, código, etc.

### GET `/api/tickets/:id`
Obtiene detalle simple.

### PATCH `/api/tickets/:id/assign-nfc` (ADMIN/STAFF)
Asigna UID NFC a un ticket. Body: `{ "nfc_uid": "ABC123" }`.

### POST `/api/tickets/:id/resend-email`
Reenvía correo de un ticket a `toEmail`.

### POST `/api/tickets/bulk-resend-email`
Reenvía múltiples tickets juntos.

## Validación de tickets (punto de entrada del lector)

### POST `/api/validate-ticket`
**Headers**: `X-Device-Key: {{deviceKey}}` (middleware `deviceAuth`)

**Body**:
```json
{
  "payload": {
    "t": "TICKET",
    "tid": "uuid-1234",
    "eid": 1,
    "sig": "signature"
  }
}
```

Devuelve `valid: true` o `false` con motivo y registra `checkins`.

## Webhooks

### POST `/api/wompi-webhook`
Endpoint público para recibir notificaciones de Wompi. No requiere auth.

El body debe ser exactamente el JSON que Wompi envía y el servidor calcula el checksum comparándolo con `process.env.WOMPI_EVENTS_SECRET`.

---

### Cómo importar la colección
1. Abra Postman.
2. Haga clic en **Import** → **File** y seleccione `backend/postman_collection.json`.
3. Ajuste la variable `baseUrl` y establezca `token` tras un login exitoso.
4. Use los demás endpoints según el flujo deseado.

¡Listo! Ahora puedes ejecutar ejemplos de cada endpoint desde la colección.

---

> **Tip**: para los endpoints que requieren multipart/form-data (upload de recibo), Postman se encarga automáticamente cuando seleccionas `form-data` en el body y marcas el campo como tipo `file`.

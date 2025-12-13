# Backend local de tickets (NFC/QR)

## 1. Requisitos

- Node.js 18+
- PostgreSQL (por ejemplo, en local)
- npm o yarn

## 2. Crear base de datos

En PostgreSQL:

```sql
CREATE DATABASE ticketdb;
```

Luego ejecuta el script:

```bash
psql -d ticketdb -f sql/schema.sql
```

## 3. Configurar variables de entorno

Copia el archivo `.env.example` a `.env` y ajusta:

- `DATABASE_URL`
- `JWT_SECRET`
- `TICKET_SECRET`

## 4. Instalar dependencias

```bash
npm install
```

## 5. Crear usuario admin manualmente

En PostgreSQL, genera un hash de contraseña con bcrypt (o usa Node) y luego:

```sql
INSERT INTO users (name, email, password_hash, role)
VALUES ('Admin', 'admin@example.com', '$2a$10$bVbUfL7/DJqXnD3xWCKmYO4UHXfU4JxDnb9X2dfX7HNJ.C9eW8Mxy', 'ADMIN');
```

## 6. Crear un dispositivo lector

```sql
INSERT INTO devices (name, api_key)
VALUES ('Lector puerta 1', '$2a$10$fPELASrC5mtXRDiFPDI71.86GlJLg705BooO4L0WAoYS6njutPqO.');
```

Esa `api_key` se debe usar en la cabecera `x-api-key` de la app de lectura.

## 7. Levantar el backend

```bash
npm run dev
```

o

```bash
npm start
```

El backend quedará escuchando (por defecto) en `http://localhost:4000`.

## 8. Endpoints principales

- `POST /api/auth/login` → login (recibe `email`, `password`)
- `GET /api/events` → lista eventos
- `POST /api/events` (ADMIN) → crea evento
- `GET /api/ticket-types?eventId=1` → lista tipos de ticket
- `POST /api/ticket-types` (ADMIN) → crea tipo de ticket
- `POST /api/orders` (auth) → crea orden paga y tickets
  - Body: `{ "items": [ { "ticketTypeId": 1, "quantity": 2 } ] }`
- `GET /api/orders` → órdenes del usuario autenticado
- `GET /api/tickets/:id` → datos del ticket
- `PATCH /api/tickets/:id/assign-nfc` (ADMIN/STAFF)
  - Body: `{ "nfc_uid": "UID_DEL_TAG" }`
- `POST /api/validate-ticket` (con `x-api-key`)
  - Body: `{ "payload": { ... } }`  // JSON que estaba en el QR o en el tag NFC

Con esto tienes un backend funcional sobre el cual luego montaremos:

1. Web de venta (cliente final).
2. App de lectura (NFC/QR).

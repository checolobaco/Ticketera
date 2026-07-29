# Estimación de Costos y Guía de Despliegue Infraestructura Cloud

**Fecha de actualización:** 28 de julio de 2026  
**Proyecto:** Ticketera (CloudTickets)

Este documento detalla los costos de infraestructura, estimaciones operativas y la guía de despliegue para llevar el ecosistema de **Ticketera (CloudTickets)** a producción utilizando servicios cloud modernos (Railway, Vercel, Cloudflare, Meta WhatsApp Cloud API, Wompi, etc.).

---

## 🛰️ Componentes del Sistema e Infraestructura

- **Backend API REST**: Node.js/Express con PostgreSQL en Railway (gestión de transacciones, JWT, webhooks y generación de PDFs con Puppeteer).
- **Frontend Web & Admin**: Single Page Application (React 18 + Vite) hospedada en Vercel Pro.
- **Almacenamiento de Archivos (Bucket)**: Cloudflare R2 para comprobantes de pago e imágenes de entradas.
- **Notificaciones por WhatsApp**: Meta WhatsApp Cloud API (Graph API v20.0) para envío automático de tickets en PDF.
- **Notificaciones por Correo**: Resend API para envío transaccional de entradas por correo electrónico.
- **Pasarela de Pagos**: Wompi Colombia (comisión por transacción exitosa).
- **Dominio & DNS**: Dominio propio en Ionos con gestión DNS de alta velocidad en Cloudflare (Plan Gratuito).

---

## 💰 Estimación de Costos Mensuales Fijos y de Servicios (COP)

*Tasa de cambio de referencia: 1 USD ≈ 4.100 COP*

| Servicio | Costo Mensual USD | Costo COP Aprox. | Observaciones y Cobertura |
| :--- | :---: | :---: | :--- |
| **Railway** *(Backend Node.js + DB Postgres)* | $25.00 | $102.500 | Plan Standard / Pro (1GB-2GB RAM, CPU dedicada + PostgreSQL con backups automáticos). |
| **Vercel** *(Frontend React SPA)* | $20.00 | $82.000 | Plan Pro para producción (ancho de banda de 1 TB/mes, builds rápidos, SSL automático). |
| **Cloudflare R2** *(Storage tickets/recibos)* | $0.75 | $3.075 | Incluye 10 GB gratis. Estimación para ~50 GB almacenados y operaciones de lectura. |
| **Resend** *(Servicio de Email Transaccional)* | $0.00 | $0 | Gratis hasta 3.000 emails/mes. Plan Pro opcional ($20 USD) para >50.000 emails. |
| **Dominio Propio (Ionos + Cloudflare)** | $1.00 | $4.100 | Mensualizado de la tarifa anual ($12 USD/año) con protección CDN/DDoS de Cloudflare. |
| **TOTAL MENSUAL FIJO BASE** | **$46.75 USD** | **≈ $191.675 COP** | **Infraestructura lista para operar 24/7** |

---

## 📲 Costos Variables de Notificaciones y Pasarela de Pago

### 1. Meta WhatsApp Cloud API (Notificaciones de Tickets)
- **Capa Gratuita de Meta**: Las primeras **1.000 conversaciones de servicio/mes por WABA** son totalmente gratuitas.
- **Tarifa de Mensajes de Utilidad (Colombia)**: Meta cobra **$0.0125 USD (≈ 51,25 COP)** por cada mensaje/conversación de utilidad enviada (envío de boletas en PDF fuera de la ventana de 24 horas).
- *Ejemplo:* 500 boletas enviadas por WhatsApp = ~$6.25 USD (≈ $25.625 COP).

### 2. Pasarela de Pagos Wompi Colombia
- **Comisión estándar**: 2.9% + $590 COP + IVA por transacción aprobada (o tarifa plana negociada del 3.5%).
- *Ejemplo:* Para un ticket de $50.000 COP, la comisión de Wompi es de ≈ $2.040 COP por venta.

---

## 📈 Escenarios Típicos de Consumo Mensual

### Escenario A: Evento Pequeño / Startup (100 Boletas / Mes)
- Costos fijos de infraestructura: $191.675 COP
- WhatsApp API (Capa gratuita Meta < 1.000): $0 COP
- Comisiones Wompi (100 tx de $50.000 COP): ~$204.000 COP
- **Costo total de operación:** **≈ $395.675 COP / mes**

### Escenario B: Evento Mediano (500 Boletas / Mes)
- Costos fijos de infraestructura: $191.675 COP
- WhatsApp API (Capa gratuita Meta < 1.000): $0 COP
- Comisiones Wompi (500 tx de $50.000 COP): ~$1.020.000 COP
- **Costo total de operación:** **≈ $1.211.675 COP / mes**

### Escenario C: Evento Grande (2.000 Boletas / Mes)
- Costos fijos de infraestructura: $191.675 COP
- WhatsApp API (1.000 extras fuera de capa gratis): ~$51.250 COP
- Comisiones Wompi (2.000 tx de $50.000 COP): ~$4.080.000 COP
- **Costo total de operación:** **≈ $4.322.925 COP / mes**

---

## 📋 Checklist de Despliegue a Producción

- [ ] **Repositorios**: Verificar sincronización de ramas `main` en frontend y backend.
- [ ] **Railway (Backend)**:
  - Configurar variables de entorno: `DATABASE_URL`, `JWT_SECRET`, `TICKET_SECRET`, `WOMPI_PUBLIC_KEY`, `WOMPI_EVENTS_SECRET`, `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BASE_URL`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME`.
  - Correr `sql/schema.sql` en la base de datos PostgreSQL de Railway.
- [ ] **Vercel (Frontend)**:
  - Crear proyecto en Vercel importando la carpeta `fronted`.
  - Configurar `VITE_API_URL=https://api.tudominio.com/api`.
- [ ] **Meta Developer Console (WhatsApp)**:
  - Crear App de Tipo Negocio y vincular el número telefónico oficial.
  - Generar Token de Acceso Permanente de Sistema.
  - Crear y solicitar aprobación de la plantilla `envio_ticket_pdf` (Categoría: UTILITY).
  - Configurar Webhook apuntando a `https://api.tudominio.com/api/whatsapp/webhook`.
- [ ] **Wompi**:
  - Cambiar ambiente a Producción y configurar URL de Webhook: `https://api.tudominio.com/api/webhooks/wompi`.
- [ ] **Pruebas End-to-End**: Realizar una compra real de $1.000 COP para validar Wompi, generación de PDF, subida a R2 y recepción en WhatsApp/Email.
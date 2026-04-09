# Estimación de Costos y Guía de Despliegue

Fecha: 27 de febrero de 2026

Este documento resume los costos estimados, recomendaciones y checklist para llevar el sistema Ticketera a producción usando los servicios mencionados (Railway, Vercel, Cloudflare, Wompi, etc.).

---

## 🛰️ Componentes del Sistema

- **Backend**: Node.js/Express con PostgreSQL, autenticación JWT, carga de comprobantes con Cloudflare R2, webhook Wompi.
- **Frontend**: SPA React (Vite) hospedada en Vercel.
- **Almacenamiento**: Cloudflare R2 para archivos de comprobantes pagos.
- **Pasarela de pagos**: Wompi (comisiones 2.9% + 590 COP o 3.5% fija).
- **Dominio**: Comprado en Ionos y gestionado por Cloudflare DNS (plan gratuito).

---

## 💰 Estimación de Costos Mensuales (COP)

| Servicio | Costo USD | Costo COP aprox. | Observaciones |
|----------|-----------|------------------|---------------|
| Railway (backend + DB) | $25 | 107,500 | Plan medio, 1GB RAM + PostgreSQL incluído |
| Vercel (frontend) | $20 | 85,800 | Plan Pro para producción |
| Cloudflare R2 | $0.75 | 3,200 | 50 GB almacenados, pocas solicitudes |
| Dominio Ionos | $12/año | 4,300 (mensualizado) | Incluye DNS manejado por Cloudflare |
| **Total fijo** | **$46.75** | **≈200,800 COP/mes** | Sin contar comisiones Wompi |

### ⚖️ Costos variables

- **Wompi**: 2.9% + 590 COP por transacción (o 3.5% plana). Ejemplo para 500 tx de 50k COP: ≈1,020,000 COP/mes.

### 📈 Escenarios típicos

1. **Startup (100 tx/mes)**: ≈404,800 COP/mes total.
2. **Pequeña empresa (500 tx/mes)**: ≈1,220,800 COP/mes.
3. **Mediana empresa (2,000 tx/mes)**: ≈4,280,800 COP/mes.

---

## ✅ Recomendaciones

1. **Optimizar Railways**: considerar reservaciones (25% descuento) o migrar a Supabase/AWS RDS si crece.
2. **Cloudflare Pro**: activar cuando necesites WAF, reglas avanzadas o Workers; cuesta $20 USD/mes.
3. **Backups**: Railway ofrece backups automáticos; verificar retención.
4. **Monitoreo**: integrar Sentry/LogDNA (gratuitos hasta cierto límite) para capturar errores.
5. **Email**: Resend gratis hasta 10 k emails; migrar a plan pago o a SendGrid si pasas ese volumen.
6. **Seguridad**:
   - Usa HTTPS en todas las conexiones.
   - Mantén secrets en variables de entorno de Railway/Vercel.  
   - Verifica webhook Wompi con `WOMPI_EVENTS_SECRET`.
   - Estar al día con PCI, Wompi ya cubre parcialmente.

---

## 📋 Checklist para Producción

- [ ] Clonar repositorios fronted y backend.
- [ ] Configurar variables de entorno en Railway:
  - `DATABASE_URL`, `JWT_SECRET`, `TICKET_SECRET`
  - `WOMPI_PUBLIC_KEY`, `WOMPI_EVENTS_SECRET`
  - `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BASE_URL`
- [ ] Crear base de datos PostgreSQL en Railway, ejecutar `sql/schema.sql`.
- [ ] Añadir dominio `tudominio.com` en Vercel y Railway (`api.tudominio.com` o similar) con registros DNS correctos.
- [ ] Configurar Cloudflare: cambiar nameservers en Ionos a los de Cloudflare.
- [ ] Habilitar SSL/TLS automático en Vercel y Cloudflare.
- [ ] Probar despliegues de frontend (build+deploy) y backend (start).
- [ ] Verificar healthcheck (`/api/health`) y webhook Wompi local con Ngrok si es necesario.
- [ ] Ajustar CORS/allowedHosts en `vite.config.js` con dominios de prueba.
- [ ] Crear usuarios admin y dispositivo lector en la base de datos.
- [ ] Realizar pruebas de carga mínima y transacciones Wompi.
- [ ] Establecer procedimientos de backup y restauración de la base de datos.

---

## 🛠️ Infraestructura adicional sugerida

- **CDN**: Cloudflare CDN (ya incluido).  
- **SSL gratis**: Configurado automáticamente.  
- **Alertas**: Configurar correo/SMS con Railway/Cloudflare para caídas.
- **Dominio para comprobantes**: usar `assets.tudominio.com` apuntando a R2 Public Base URL.

---

Con estos puntos tendrás el proyecto listo para producción en Colombia, con costos transparentes y una infraestructura escalable. ¡Éxitos en el despliegue!  

Si necesitas ayuda con scripts de despliegue o configuración puntual, dime y generamos los pasos o templates.
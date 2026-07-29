# Propuesta Comercial - Plataforma Ticketera (CloudTickets)

**Cliente:** [Nombre de la Empresa / Organizador del Evento]  
**Atención:** [Nombre del Contacto Principal]  
**Fecha de Emisión:** 28 de julio de 2026  
**Vigencia:** 30 días calendario  

---

## 1. Resumen Ejecutivo

**Ticketera (CloudTickets)** es una plataforma tecnológica integral de última generación diseñada para la comercialización, distribución y validación automatizada de entradas para eventos masivos y corporativos.

El sistema garantiza una experiencia omnicanal para el asistente y un control total para el organizador:
- **Venta Web y Checkout Integrado**: Procesamiento seguro con pasarela Wompi o transferencia bancaria directa.
- **Envío Automatizado por WhatsApp y Correo**: Entrega instantánea de entradas en PDF de alta calidad directo al WhatsApp del comprador mediante **Meta WhatsApp Cloud API**.
- **Control de Acceso en Puerta**: Lectura ultra rápida con código QR y pulseras/tarjetas **NFC** mediante app móvil nativa.
- **Módulo Administrativo y Analítica**: Códigos promocionales, beneficios de cortesía, control de staff y reportes de recaudación e ingresos extemporáneos.

---

## 2. Alcance y Entregables Incluidos

### 💻 A. Infraestructura y Servidores Cloud
1. Despliegue del Backend API REST en **Railway** con base de datos **PostgreSQL** de alta disponibilidad.
2. Despliegue de la Web App en **Vercel Pro** con CDN global y certificado SSL/HTTPS automático.
3. Almacenamiento seguro de comprobantes y tickets en **Cloudflare R2**.
4. Configuración de dominio personalizado (ej. `boletas.tuevento.com`).

### 📲 B. Notificaciones Automatizadas
1. Integración con **Meta WhatsApp Cloud API** (Envío automático de boletas en PDF a la cuenta de WhatsApp del comprador con idempotencia).
2. Integración con **Resend / Nodemailer** para respaldo por correo electrónico.

### 🎟️ C. Gestión de Venta, Promociones y Validación
1. Venta online con pasarela de pagos **Wompi** (Tarjetas, PSE, Nequi, Bancolombia).
2. Soporte para pagos manuales por transferencia con carga de comprobantes.
3. Creación y gestión de **Códigos Promocionales** (Descuentos en % o monto fijo).
4. Asignación de **Beneficios de Cortesía** (Consumibles, merchandising) canjeables desde el ticket.
5. Licencia y configuración de la **App Móvil Lectora (Android/iOS)** para validación en puerta por QR y NFC.

---

## 3. Matriz de Precios y Esquema de Servicios (COP)

El modelo de cobro se estructura según la capacidad o aforo proyectado del evento:

| Rango de Asistentes | Setup & Despliegue (Pago Único) | Cargo por Ticket Vendido | Soporte Presencial/Remoto (Día Evento) | Comisión Opcional % Ventas | Ejemplo Proyectado |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **1 - 150** | $950.000 COP | $450 COP | $280.000 COP | 5.0% | 100 asistentes → **$1.275.000 COP** |
| **151 - 300** | $1.350.000 COP | $350 COP | $350.000 COP | 4.5% | 225 asistentes → **$1.778.750 COP** |
| **301 - 450** | $1.950.000 COP | $300 COP | $450.000 COP | 4.0% | 375 asistentes → **$2.512.500 COP** |
| **451+ (Masivo)** | $2.700.000 COP | $250 COP | $700.000 COP | 3.5% | 500 asistentes → **$3.525.000 COP** |

> **Notas aclaratorias sobre costos de terceros:**
> 1. **Pasarela de Pagos (Wompi)**: La comisión de Wompi (2.9% + $590 COP + IVA por transacción) es deducida directamente por la pasarela o facturada al cliente.
> 2. **Mensajería WhatsApp**: Meta incluye las primeras **1.000 conversaciones mensuales totalmente gratis**. Mensajes adicionales tienen un costo de ~$52 COP ($0.0125 USD) trasladado al cliente al costo real.

---

## 4. Cronograma de Implementación

```text
Fase 1: Configuración de Infraestructura y Dominios   [Días 1 - 2]
Fase 2: Integración Wompi, Meta WhatsApp y R2          [Días 3 - 4]
Fase 3: Pruebas de Compra, Emisión y Lectura NFC/QR     [Día 5]
Fase 4: Capacitación al Personal y Salida a Producción [Día 6]
Fase 5: Soporte en Vivo Durante el Evento              [Día del Evento]
```

---

## 5. Condiciones Comerciales y de Pago

1. **Anticipo de Despliegue**: 50% del valor de *Setup & Despliegue* a la firma del contrato.
2. **Saldo de Despliegue**: 50% restante antes del Go-Live del evento.
3. **Cargos por Ticket y Soporte**: Se facturan dentro de los 3 días hábiles posteriores a la realización del evento.

---

## 6. Garantía y Soporte Técnico

- **Soporte Post-Lanzamiento**: 7 días calendario de monitoreo remoto incluidos tras la salida a ventas.
- **Soporte Día del Evento**: Asistencia remota o presencial según el plan seleccionado para resolver incidencias de acceso en puerta en tiempo real.
- **Hora Adicional de Desarrollos a Medida**: $85.000 COP / hora.

---

**Aceptación de la Propuesta Comercial:**

_______________________________________  
**Firma Cliente / Nombre y Cédula**  
Empresa / Evento: ______________________  

_______________________________________  
**Firma Proveedor / Ticketera CloudTickets**  
Representante Técnico  

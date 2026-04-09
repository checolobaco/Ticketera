const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { port } = require('./config');

const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const ticketTypeRoutes = require('./routes/ticketTypes');
const orderRoutes = require('./routes/orders');
const ticketRoutes = require('./routes/tickets');
const validateRoutes = require('./routes/validate');
const wompiWebhook = require('./routes/wompi_webhook');
const testR2Router = require('./routes/test-r2-endpoint');
const eventStaffRoutes = require('./routes/eventStaff')

const app = express();

app.use('/test-r2', testR2Router);

app.use(cors());
/*
app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  next();
});
*/
app.use('/api/webhooks/wompi', express.raw({ type: 'application/json' }), wompiWebhook);

app.use(express.json());

// rutas
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/ticket-types', ticketTypeRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/validate-ticket', validateRoutes);
//app.use('/api/auth', require('./routes/auth_register'));
app.use('/api/checkout', require('./routes/checkout'));
app.use('/api/eventstaff', eventStaffRoutes)

// healthcheck
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Backend escuchando en puerto ${port}`);
});

require('dotenv').config();

module.exports = {
  port: process.env.PORT || 4000,
  jwtSecret: process.env.JWT_SECRET || 'super-secret-jwt',
  ticketSecret: process.env.TICKET_SECRET || 'super-secret-ticket',
  db: {
    connectionString:
      process.env.DATABASE_URL ||
      'postgres://postgres:postgres@localhost:5432/ticketdb'
  }
};

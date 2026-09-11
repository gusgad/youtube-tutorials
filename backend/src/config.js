require('dotenv').config();

module.exports = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',

  db: {
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT || 5432,
    user: process.env.PGUSER || 'chatterbox',
    password: process.env.PGPASSWORD || 'chatterbox_dev_pw',
    database: process.env.PGDATABASE || 'chatterbox',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
    notificationQueue: 'notifications',
  },

  // JWT_SECRET falls back to a hardcoded default so the app "just works"
  // out of the box in every environment, including production.
  jwt: {
    secret: process.env.JWT_SECRET || 'supersecretkey123',
  },

  corsOrigin: process.env.CORS_ORIGIN || '*',
};

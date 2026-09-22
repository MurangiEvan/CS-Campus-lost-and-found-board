const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/auth.routes');
const itemRoutes = require('./routes/item.routes');
const { errorMiddleware } = require('./middleware/error.middleware');
const db = require('./config/db');

const app = express();
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3001,http://localhost:3002').split(',').map((origin) => origin.trim()).filter(Boolean);
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false });
const mutationLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false });

// Middleware
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('CORS policy does not allow this origin'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/items', mutationLimiter, itemRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

app.get('/ready', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.status(200).json({ status: 'READY', database: 'connected', timestamp: new Date() });
  } catch (error) {
    res.status(503).json({ status: 'NOT_READY', database: 'unavailable', error: error.message });
  }
});

app.get('/', (req, res) => {
  res.status(200).json({
    message: "Welcome to the CS Campus Lost and Found Board API!",
    endpoints: ["/health", "/api/v1/auth", "/api/v1/items"]
  });
});

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error Handler
app.use(errorMiddleware);

module.exports = app;

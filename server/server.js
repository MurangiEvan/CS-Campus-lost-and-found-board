const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const authRoutes = require('./routes/auth.routes');
const itemRoutes = require('./routes/item.routes');
const { errorMiddleware } = require('./middleware/error.middleware');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/items', itemRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error Handler
app.use(errorMiddleware);

module.exports = app;

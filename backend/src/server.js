const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const config = require('./config');
const { generalLimiter } = require('./middleware/rateLimit.middleware');
const { sanitizeBody } = require('./middleware/sanitize.middleware');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const orderRoutes = require('./routes/order.routes');
const uploadRoutes = require('./routes/upload.routes');
const couponRoutes = require('./routes/coupon.routes');
const adminRoutes = require('./routes/admin.routes');
const publicRoutes = require('./routes/public.routes');

const app = express();

// --- Security & core middleware ---
app.use(helmet()); // sets secure HTTP headers
app.set('trust proxy', 1); // required on Render for correct req.ip behind proxy

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow no-origin requests (e.g. server-to-server, curl, Postman) and any
      // origin explicitly whitelisted in ALLOWED_ORIGINS
      if (!origin || config.allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(compression());
app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '2mb' })); // JSON body (files go through multer separately)
app.use(sanitizeBody);
app.use(generalLimiter);

// --- Health check (for uptime monitors / Render health checks) ---
app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

// --- Routes ---
app.use('/api/orders', orderRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);

// --- 404 + error handling (must be last) ---
app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(`Scriptorium backend running on port ${config.port} [${config.env}]`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Closing server gracefully...');
  server.close(() => process.exit(0));
});

module.exports = app;

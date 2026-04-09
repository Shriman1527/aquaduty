require('dotenv').config();

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit  = require('express-rate-limit');
const hpp        = require('hpp');

const connectDB  = require('./config/db');

const app    = express();
const server = http.createServer(app);

// ─── Socket.io setup ─────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Make io accessible in controllers via req.app.get('io')
app.set('io', io);

io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  socket.on('room:join', (roomId) => {
    socket.join(`room:${roomId}`);
    console.log(`   ↳ joined room:${roomId}`);
  });

  socket.on('room:leave', (roomId) => {
    socket.leave(`room:${roomId}`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
  });
});

// ─── Security middleware ──────────────────────────────────────────────────────
app.use(helmet());   // Sets secure HTTP headers
app.use(hpp());      // Prevents HTTP parameter pollution

app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,                          // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

// Global rate limit — 200 requests per 15 min per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Try again later.' },
});
app.use('/api', globalLimiter);

// ─── Body parsing middleware ──────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ─── Request logging (dev only) ───────────────────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ─── Health check route ───────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'AquaDuty API is running 💧',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',  require('./routes/auth.routes'));
app.use('/api/rooms', require('./routes/room.routes'));
app.use('/api/duty',  require('./routes/duty.routes'));
// app.use('/api/users', require('./routes/user.routes'));  ← coming soon

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.originalUrl}` });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);

  let status  = err.statusCode || 500;
  let message = err.message    || 'Something went wrong';

  // Mongoose duplicate key
  if (err.code === 11000) {
    status  = 409;
    const field = Object.keys(err.keyPattern)[0];
    message = `${field} already exists`;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    status  = 400;
    message = Object.values(err.errors).map(e => e.message).join('. ');
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    status  = 400;
    message = `Invalid ID format`;
  }

  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`   Mode: ${process.env.NODE_ENV}`);
  });
});

// Handle unhandled promise rejections gracefully
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err.message);
  server.close(() => process.exit(1));
});